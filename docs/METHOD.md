# Inference method 0.1.0

## Purpose

The first runnable version turns selected README implementation claims into
traceable machine-readable hypotheses and matches discriminating claim terms
against repository file paths. It is deterministic and deliberately limited.

## Evidence classes

- **implementation**: source-code paths
- **test**: paths under test/tests/specs/__tests__ or files ending in .test/.spec
- **configuration**: JSON, YAML, TOML, Dockerfile, Makefile
- **documentation**: Markdown and text

## Score

For a claim with N discriminating terms, lexical coverage is the fraction of
those terms appearing in at least one matched path. The score is:

`min(100, round(65 × coverage + 20 × implementation_present + 10 × test_present + 5 × configuration_present))`

The score is a path-support heuristic, not a probability, semantic confidence,
or proof. A high score can still be wrong; a low score can miss valid code.

## Reproducibility and provenance

Every included file is SHA-256 hashed. A sorted manifest of relative paths and
file hashes produces the report trace ID. The report includes the method version,
claim origin line, evidence paths, and explicit gaps. File timestamps are not
used in the trace ID.

## Safety boundaries

- Symbolic links are skipped.
- .git, node_modules, vendor, build output, and common generated directories are skipped.
- Only allowlisted text/code extensions are read.
- Individual files are limited to 1 MiB; total inventory is limited to 20,000 files.
- No network access, shell execution, package installation, or repository code execution occurs.
- Never analyze secret-bearing trees unless intentionally approved for local inspection.

## Known limitations

- Only README.md is used for automatic claim extraction.
- Claim parsing uses a small verb pattern, not natural-language understanding.
- Evidence matching is lexical and path-based.
- Tests are not run.
- The analyzer does not inspect Git history, runtime behavior, deployments,
  dependencies, market demand, cost, or legal/compliance status.
- Manual review and fixture expansion are required before relying on scores.
