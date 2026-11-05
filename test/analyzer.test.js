import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRepository, scoreReportClaim } from "../src/analyzer.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidenceos-fixture-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "test"), { recursive: true });
  fs.writeFileSync(path.join(root, "README.md"), "# Fixture\n\n- Implements flash loan execution with repayment validation.\n");
  fs.writeFileSync(path.join(root, "src", "flashLoan.js"), "export function executeFlashLoan() {}\n");
  fs.writeFileSync(path.join(root, "test", "flashLoan.test.js"), "test('flash loan', () => {});\n");
  return root;
}

test("extracts README claims and returns traceable evidence paths", () => {
  const root = fixture();
  try {
    const report = analyzeRepository(root);
    assert.equal(report.schema, "evidenceos-inference-report/v1");
    assert.equal(report.claims.length, 1);
    assert.equal(report.claims[0].origin.path, "README.md");
    assert.ok(report.claims[0].supporting_evidence.some((item) => item.path === "src/flashLoan.js"));
    assert.ok(report.claims[0].supporting_evidence.some((item) => item.path === "test/flashLoan.test.js"));
    assert.equal(report.evidence.length, 3);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("claim scoring is deterministic for an unchanged evidence manifest", () => {
  const root = fixture();
  try {
    const report = analyzeRepository(root);
    const first = scoreReportClaim(report, "implements flash loan execution");
    const second = scoreReportClaim(report, "implements flash loan execution");
    assert.deepEqual(first, second);
    assert.ok(first.score > 0);
    assert.equal(first.trace_id, report.trace_id);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("missing repository path fails clearly", () => {
  assert.throws(() => analyzeRepository("/definitely/not/a/repository"), /not a readable directory/);
});

test("invalid report schema is rejected", () => {
  assert.throws(() => scoreReportClaim({}, "some claim"), /not an EvidenceOS inference report/);
});

test("README without selected claim verbs yields no inferred claims", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidenceos-empty-"));
  try {
    fs.writeFileSync(path.join(root, "README.md"), "# Project\n\nA project description without explicit implementation verbs.\n");
    const report = analyzeRepository(root);
    assert.deepEqual(report.claims, []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
