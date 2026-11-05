import crypto from "node:crypto";
import path from "node:path";
import { METHOD_VERSION, tokenize } from "./tokens.js";

const SKIP_DIRS = new Set([".git", "node_modules", "vendor", "dist", "build", ".next", "coverage"]);
const TEXT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".yml", ".yaml", ".toml", ".py", ".go", ".rs", ".java", ".sh"]);
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 1024 * 1024;

function classify(file) {
  const p = file.toLowerCase();
  if (/(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\.[^.]+$/.test(p)) return "test";
  if (/\.(ya?ml|toml|json)$/.test(p) || /(^|\/)(dockerfile|makefile)$/.test(p)) return "configuration";
  if (/\.(md|mdx|txt)$/.test(p)) return "documentation";
  return "implementation";
}

function extractReadmeClaims(readme) {
  if (!readme) return [];
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

/**
 * Analyze an immutable GitHub tree snapshot without cloning or executing it.
 * GitHub blob SHAs are retained as Git object identities; they are not mislabeled
 * as SHA-256. The caller must supply the commit SHA and the matching tree.
 */
export function analyzeRepositorySnapshot({ repository, commitSha, tree, readmeContent = "" } = {}) {
  if (!repository?.full_name || !commitSha || !tree?.sha || !Array.isArray(tree.tree)) {
    throw new Error("A full repository name, commit SHA, and complete Git tree are required.");
  }
  if (tree.truncated) throw new Error("Git tree is truncated; refusing to issue a complete inference report.");
  const evidence = tree.tree
    .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
    .filter((entry) => !entry.path.split("/").some((part) => SKIP_DIRS.has(part)))
    .filter((entry) => TEXT_EXTENSIONS.has(path.extname(entry.path).toLowerCase()))
    .filter((entry) => Number.isFinite(entry.size) && entry.size <= MAX_FILE_BYTES)
    .slice(0, MAX_FILES)
    .map((entry) => ({
      path: entry.path,
      category: classify(entry.path),
      size_bytes: entry.size,
      git_blob_sha: entry.sha
    }));
  const claims = extractReadmeClaims(readmeContent).map((claim) => ({ ...claim, ...scoreClaim(claim.text, evidence) }));
  const manifestHash = crypto.createHash("sha256")
    .update(evidence.map((item) => item.path + "\0" + item.git_blob_sha + "\n").join(""))
    .digest("hex");
  return {
    schema: "evidenceos-inference-report/v1",
    method: METHOD_VERSION,
    trace_id: "eos-" + manifestHash.slice(0, 20),
    generated_at: new Date().toISOString(),
    repository: {
      full_name: repository.full_name,
      default_branch: repository.default_branch || null,
      commit_sha: commitSha,
      tree_sha: tree.sha,
      files_analyzed: evidence.length,
      file_limit_reached: evidence.length >= MAX_FILES,
      manifest_sha256: manifestHash
    },
    claims,
    evidence,
    gaps: claims.flatMap((claim) => claim.gaps.map((gap) => ({ claim_id: claim.id, claim: claim.text, gap }))),
    limitations: [
      "Claims are extracted only from selected README.md lines.",
      "Scoring is lexical overlap against repository paths, not semantic code understanding.",
      "Git blob SHA values identify Git objects and are not SHA-256 content digests.",
      "File presence and hashes do not prove that code executes or tests pass.",
      "Tests are identified by path conventions; they are not executed.",
      "Only repository tree metadata and README content are analyzed; source file contents are not semantically inspected.",
      "A human must inspect supporting artifacts before treating a claim as verified."
    ]
  };
}
