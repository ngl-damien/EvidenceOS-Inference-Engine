# EvidenceOS Inference Engine

**Status:** Initial runnable implementation · experimental  
**Spec version:** 0.10 (implementation baseline 0.1.0)  
**Owner:** No-Gas-Labs-Official

## What this is

An inference engine for **repository intelligence**: it extracts a bounded set of claims from a repository README, matches discriminating claim terms against traceable repository paths, classifies supporting artifacts, and emits machine-readable evidence and gaps.

It implements the EvidenceOS design orientation:

- Prefer primary artifacts over narrative
- Separate what a repository claims from what its visible structure supports
- Attach every inferred support item to a path and content hash
- Emit gaps and limitations rather than filling them with invented conclusions
- Keep the method deterministic and versioned

## Run

Requires Node.js 22 or newer. No third-party runtime dependencies are required.

```sh
npm test
node src/cli.js analyze /path/to/repository --out report.json
node src/cli.js score report.json --claim "implements flash loan execution"
```

Optional analysis arguments:

- `--label name`: stable human-readable repository label
- `--claim "text"`: include a score for one additional claim in the report
- `--out file.json`: write JSON to a file instead of standard output

## Report contract

The analyzer emits `evidenceos-inference-report/v1` with:

- `claims[]`: extracted README claim, origin path/line, score, matched terms, supporting paths, and gaps
- `evidence[]`: repository-relative path, artifact class, byte size, and SHA-256
- `gaps[]`: explicit claim/evidence gaps
- `method`: versioned method identifier
- `trace_id`: digest derived from the sorted evidence manifest
- `limitations[]`: current method boundaries

## Scoring method 0.1.0

The initial scorer is deliberately modest and deterministic. It compares claim terms to repository paths, weights implementation/test/configuration/documentation paths differently, and emits a 0–100 path-support heuristic.

**The score is not a probability, semantic confidence, or proof.** File presence does not prove that code works. Test files are not executed. See [docs/METHOD.md](docs/METHOD.md).

## Security and boundaries

- Skips symbolic links and common generated/dependency directories.
- Reads only allowlisted text/code file extensions.
- Ignores files larger than 1 MiB and caps the inventory at 20,000 files.
- Does not execute repository code, install dependencies, or make network requests.
- Do not analyze secret-bearing trees unless they are intentionally approved for local inspection.

## Current limitations

- Automatic claims are extracted only from README lines containing a small set of verbs.
- Evidence matching is lexical and path-based, not semantic source analysis.
- Tests are identified by path convention but are not run.
- It does not inspect runtime behavior, deployments, Git history, customer demand, unit economics, or legal/compliance status.
- Human review of underlying artifacts remains mandatory.

## Next implementation priorities

1. Expand fixture repositories with known claim/evidence pairs and adversarial cases.
2. Add stronger deterministic artifact classifiers and evidence scoring.
3. Validate the report contract against portfolio-level EvidenceOS consumers.
4. Add semantic analysis only behind explicit, separately testable methods with provenance and uncertainty.

---

*Evidence before narrative. Gaps are first-class outputs.*
