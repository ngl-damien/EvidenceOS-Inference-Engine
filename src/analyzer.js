import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { METHOD_VERSION, tokenize } from "./tokens.js";

const SKIP_DIRS = new Set([".git", "node_modules", "vendor", "dist", "build", ".next", "coverage"]);
const TEXT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".yml", ".yaml", ".toml", ".py", ".go", ".rs", ".java", ".sh"]);
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 1024 * 1024;

function walk(root, current = root, found = []) {
  if (found.length >= MAX_FILES) return found;
  const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (found.length >= MAX_FILES) break;
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(root, absolute, found);
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const stat = fs.statSync(absolute);
      if (stat.size <= MAX_FILE_BYTES) found.push({
        absolute, relative: path.relative(root, absolute).split(path.sep).join("/"), size: stat.size
      });
    }
  }
  return found;
}

function classify(file) {
  const p = file.toLowerCase();
  if (/(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\.[^.]+$/.test(p)) return "test";
  if (/\.(ya?ml|toml|json)$/.test(p) || /(^|\/)(dockerfile|makefile)$/.test(p)) return "configuration";
  if (/\.(md|mdx|txt)$/.test(p)) return "documentation";
  return "implementation";
}

function extractReadmeClaims(readme) {
  const claims = [];
  const lines = readme.split(/\r?\n/);
  const pattern = /\b(implements?|supports?|provides?|includes?|enables?|contains?|uses?|integrates?|automates?|exposes?|validates?|generates?)\b/i;
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, "").trim();
    if (text.length >= 18 && text.length <= 500 && pattern.test(text) && !text.startsWith("```")) {
      claims.push({ id: "readme-" + (index + 1), text, origin: { path: "README.md", line: index + 1 }, status: "claim" });
    }
  }
  return claims;
}

function scoreClaim(claim, evidence) {
  const terms = tokenize(claim);
  if (!terms.length) return { score: 0, matched_terms: [], supporting_evidence: [], gaps: ["Claim contains no discriminating terms."] };
  const matches = evidence.map((item) => {
    const haystack = tokenize(item.path.replace(/[._/-]/g, " "));
    const matched = terms.filter((term) => haystack.includes(term));
    const weight = { implementation: 1, test: 0.85, configuration: 0.55, documentation: 0.2 }[item.category];
    return { ...item, matched_terms: matched, contribution: matched.length ? weight * matched.length / terms.length : 0 };
  }).filter((item) => item.matched_terms.length)
    .sort((a, b) => b.contribution - a.contribution || a.path.localeCompare(b.path));
  const best = matches.slice(0, 10);
  const matchedTerms = [...new Set(best.flatMap((item) => item.matched_terms))];
  const coverage = matchedTerms.length / terms.length;
  const implementationMatches = best.filter((item) => item.category === "implementation").length;
  const testMatches = best.filter((item) => item.category === "test").length;
  const configMatches = best.filter((item) => item.category === "configuration").length;
  const score = Math.round(Math.min(100, coverage * 65 + (implementationMatches ? 20 : 0) + (testMatches ? 10 : 0) + (configMatches ? 5 : 0)));
  const gaps = [];
  if (!implementationMatches) gaps.push("No matching implementation path found.");
  if (!testMatches) gaps.push("No matching test path found.");
  if (coverage < 0.5) gaps.push("Less than half of the claim terms matched repository paths.");
  return {
    score, matched_terms: matchedTerms,
    supporting_evidence: best.map((item) => ({ path: item.path, category: item.category, matched_terms: item.matched_terms })),
    gaps
  };
}

export function analyzeRepository(repoPath, options = {}) {
  const root = path.resolve(repoPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error("Repository path is not a readable directory: " + root);
  const files = walk(root);
  const evidence = files.map((file) => ({
    path: file.relative,
    category: classify(file.relative),
    size_bytes: file.size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(file.absolute)).digest("hex")
  }));
  const readmeFile = files.find((file) => file.relative.toLowerCase() === "readme.md");
  const readme = readmeFile ? fs.readFileSync(readmeFile.absolute, "utf8") : "";
  const claims = extractReadmeClaims(readme).map((claim) => ({ ...claim, ...scoreClaim(claim.text, evidence) }));
  const manifestHash = crypto.createHash("sha256").update(evidence.map((item) => item.path + "\0" + item.sha256 + "\n").join("")).digest("hex");
  const report = {
    schema: "evidenceos-inference-report/v1",
    method: METHOD_VERSION,
    trace_id: "eos-" + manifestHash.slice(0, 20),
    generated_at: new Date().toISOString(),
    repository: { path_label: options.label || path.basename(root), files_analyzed: evidence.length, file_limit_reached: evidence.length >= MAX_FILES, manifest_sha256: manifestHash },
    claims, evidence,
    gaps: claims.flatMap((claim) => claim.gaps.map((gap) => ({ claim_id: claim.id, claim: claim.text, gap }))),
    limitations: [
      "Claim extraction is limited to README.md lines containing selected claim verbs.",
      "Scoring is lexical overlap against file paths, not semantic code understanding.",
      "File presence and hashes do not prove that code executes or tests pass.",
      "Tests are identified by path conventions; they are not executed.",
      "A human must inspect supporting artifacts before treating a claim as verified."
    ]
  };
  if (options.claim) report.requested_claim = { text: options.claim, ...scoreClaim(options.claim, evidence) };
  return report;
}

export function scoreReportClaim(report, claim) {
  if (report?.schema !== "evidenceos-inference-report/v1" || !Array.isArray(report.evidence)) throw new Error("Input is not an EvidenceOS inference report.");
  return { schema: "evidenceos-claim-score/v1", method: report.method, trace_id: report.trace_id, claim, ...scoreClaim(claim, report.evidence) };
}
