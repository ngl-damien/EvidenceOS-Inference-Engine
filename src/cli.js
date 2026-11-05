#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { analyzeRepository, scoreReportClaim } from "./analyzer.js";

function usage() {
  console.error("EvidenceOS Inference Engine\nUsage:\n  evidenceos analyze <repo-path> [--out report.json] [--label name]\n  evidenceos score <report.json> --claim \"claim text\" [--out score.json]");
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error("Missing value for " + name);
  return args[index + 1];
}

function writeOutput(value, outputPath) {
  const json = JSON.stringify(value, null, 2) + "\n";
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), json, { flag: "w" });
  else process.stdout.write(json);
}

try {
  const [command, target, ...args] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(command ? 0 : 2);
  }
  if (command === "analyze") {
    if (!target) throw new Error("Missing repository path.");
    const report = analyzeRepository(target, { label: option(args, "--label"), claim: option(args, "--claim") });
    writeOutput(report, option(args, "--out"));
  } else if (command === "score") {
    if (!target) throw new Error("Missing report path.");
    const claim = option(args, "--claim");
    if (!claim) throw new Error("score requires --claim.");
    const report = JSON.parse(fs.readFileSync(path.resolve(target), "utf8"));
    writeOutput(scoreReportClaim(report, claim), option(args, "--out"));
  } else {
    throw new Error("Unknown command: " + command);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
