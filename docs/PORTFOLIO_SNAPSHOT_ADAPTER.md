# Portfolio snapshot adapter

`analyzeRepositorySnapshot()` accepts a GitHub repository tree fetched at an immutable commit SHA and emits the same report envelope as the local analyzer.

```js
import { analyzeRepositorySnapshot } from "./src/snapshot.js";

const report = analyzeRepositorySnapshot({
  repository: { full_name: "owner/repo", default_branch: "main" },
  commitSha: "<immutable-commit-sha>",
  tree: { sha: "<tree-sha>", truncated: false, tree: [/* Git tree entries */] },
  readmeContent: "<README bytes decoded as UTF-8>"
});
```

The adapter uses the GitHub tree's blob SHA as a Git object identity. It does not relabel Git SHA-1 as SHA-256. The manifest digest is SHA-256 over the sorted path/blob-identity pairs. The report binds the repository full name, default branch, commit SHA, and tree SHA.

The adapter reads no source-file contents. It uses README text for claim extraction and file paths for evidence matching. This keeps the first integration cheap and read-only, but does not constitute semantic analysis. A truncated tree is rejected. The caller must obtain the tree at the exact commit SHA and fetch the README from the same tree's blob.
