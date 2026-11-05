import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRepositorySnapshot } from "../src/snapshot.js";

const tree = {
  sha: "tree-abc123",
  truncated: false,
  tree: [
    { type: "blob", path: "README.md", sha: "blob-readme", size: 80 },
    { type: "blob", path: "src/flashLoan.js", sha: "blob-source", size: 120 },
    { type: "blob", path: "test/flashLoan.test.js", sha: "blob-test", size: 90 },
    { type: "blob", path: "node_modules/flash/index.js", sha: "blob-vendor", size: 20 },
    { type: "tree", path: "src", sha: "tree-src" }
  ]
};

test("analyzes a pinned GitHub tree and binds report to repository commit", () => {
  const report = analyzeRepositorySnapshot({
    repository: { full_name: "acme/loans", default_branch: "main" },
    commitSha: "commit-123",
    tree,
    readmeContent: "# Loans\n\n- Implements flash loan execution with repayment validation.\n"
  });
  assert.equal(report.repository.full_name, "acme/loans");
  assert.equal(report.repository.commit_sha, "commit-123");
  assert.equal(report.repository.tree_sha, "tree-abc123");
  assert.equal(report.claims.length, 1);
  assert.ok(report.claims[0].supporting_evidence.some((item) => item.path === "src/flashLoan.js"));
  assert.ok(report.evidence.every((item) => item.git_blob_sha && !("sha256" in item)));
  assert.equal(report.evidence.some((item) => item.path.includes("node_modules")), false);
});

test("refuses truncated GitHub trees instead of claiming complete coverage", () => {
  assert.throws(() => analyzeRepositorySnapshot({
    repository: { full_name: "acme/loans" },
    commitSha: "commit-123",
    tree: { ...tree, truncated: true },
    readmeContent: ""
  }), /truncated/);
});

test("requires immutable repository and tree provenance", () => {
  assert.throws(() => analyzeRepositorySnapshot({ repository: { full_name: "acme/loans" }, tree }), /commit SHA/);
});
