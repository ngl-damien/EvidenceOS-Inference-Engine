# Integration contract: inference engine and portfolio decision layer

## Responsibility boundary

**EvidenceOS Inference Engine** is the repository-level evidence producer. It inspects one local repository tree and emits claims, path-linked evidence, gaps, a versioned method, and a content-manifest trace ID.

**Portfolio EvidenceOS** is the discovery and orchestration layer. It inventories repositories, records repository identity/revision/coverage, and invokes or consumes repository-level inference reports.

**The portfolio Decision Gate** belongs above this engine. It combines portfolio coverage and repository inference with independently sourced problem, demand, economic, delivery, and governance evidence. It must not be implemented by pretending that a repository path score proves a commercial opportunity.

## Contract

The inference engine emits `evidenceos-inference-report/v1`:

- `trace_id`: content-manifest-derived identifier
- `method`: scoring method and version
- `repository`: local label, file count, manifest digest
- `claims[]`: claim text, README origin, heuristic score, matched terms, supporting evidence paths, gaps
- `evidence[]`: path, artifact category, byte size, SHA-256
- `limitations[]`: explicit scope boundaries

A consuming portfolio system must preserve the report trace ID and method version. It must retain the repository identity and exact revision/tree identity supplied by the portfolio inventory; the local analyzer's content manifest is not a substitute for GitHub commit provenance.

## Non-equivalences

The following must never be conflated:

- A file path exists ≠ its code works.
- A test file exists ≠ the test passes.
- A README claim has matching path terms ≠ the claim is semantically supported.
- A high path-support score ≠ calibrated confidence.
- Repository capability ≠ user demand.
- User demand ≠ positive unit economics.
- Pilot eligibility ≠ authorization to spend, deploy, or scale.

## Next integration step

Add a portfolio adapter that supplies a checked-out repository tree and binds the resulting inference report to the repository's immutable commit SHA and EvidenceOS scan trace. Only after that provenance join is validated should the portfolio Decision Gate consume the result.
