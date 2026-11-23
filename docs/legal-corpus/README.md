# Legal corpus intake pipeline (D-005 / D-011)

> **Status (2026-11-22): PIPELINE READY — CORPUS BLOCKED.**
> The folder layout, manifest format, deterministic validator and human verification checklist
> below are implemented and tested. **No official legal source has been supplied, ingested or
> verified.** No real statutory provision, judgment, reporter citation or procedural rule has
> been entered. Real ingestion remains blocked until the legal/content owner of D-005/D-011 is
> assigned, supplies official text and signs off on it. The reviewer assignment and the
> versioning policy are still recorded as `Unknown` in [`../DECISIONS.md`](../DECISIONS.md).

This directory is a **process/tooling scaffold**, not a corpus. Nothing in it is a source of law.
The runtime never reads these files; they exist so a human content owner has a deterministic,
reviewable path from official publication to a validated record.

## 1. Non-negotiables (read first)

- **No fabrication.** Never write a statutory provision, section/article number, judgment name,
  reporter citation, effective date, procedural rule or official URL from memory, from an AI
  stub, or by extrapolation. Copy exact text only from an official publication and record which
  publication and version/date it came from.
- **No real legal text here yet.** The only files shipped are this README and a clearly marked
  `manifest.template.json` whose example records are fictional/internal stand-ins.
- **Templates are not corpora.** `manifest.template.json` carries `"template": true`; the
  validator **rejects** it by design (`npm run validate:legal-corpus -- --template` must exit 1).
  Copying the template and leaving real-looking text in it does not make anything verified.
- **No self-auto-verification.** The validator only proves that the required metadata and human
  attestation are _present_. It cannot confirm a reviewer actually checked the text; that is the
  named reviewer's responsibility.
- **Placeholders stay non-authoritative.** `placeholder` and `unverified` records can never be
  cited as authoritative. Excerpts and summaries are non-authoritative by construction.
- **No real citations in test/example data.** Tests use fictional/internal identifiers. Strings
  that look like real citations appear only in tests that prove they are _rejected_.

See [`../LEGAL_SOURCE_VERIFICATION.md`](../LEGAL_SOURCE_VERIFICATION.md) for the full
no-fabrication rules, acceptable official sources and sign-off log.

## 2. Intake folder structure

```text
docs/legal-corpus/
├── README.md                 # this document (process + blocked status)
├── manifest.template.json    # TEMPLATE / NOT LEGAL AUTHORITY — never ingestible
├── manifest.json             # NOT SHIPPED — created only after human review and sign-off
└── intake/
    ├── unverified/           # raw drafts; non-authoritative; .gitkeep only
    └── reviewed/             # human-checked text + sign-off notes; .gitkeep only
```

- `intake/unverified/` — working drafts copied from official material, with retrieval notes.
  Nothing here is authoritative. These files are ordinary JSON/text and are not read by the app.
- `intake/reviewed/` — exact text the named reviewer has checked, together with the reviewer's
  name, review date and the publication/version checked. Only material that passes §5 may be
  promoted into a manifest's `sources` array.
- `manifest.json` — the single file the validator checks. It is intentionally absent from the
  repository while D-005/D-011 are blocked; create it only from the template **after** the
  workflow in §4 and §5 is complete.

## 3. Manifest format

A manifest is a JSON object. Example shape (fictional values only — do not copy as real law):

```json
{
  "schemaVersion": 1,
  "corpusId": "INTERNAL-CORPUS-ID",
  "status": "draft",
  "owner": "Named human content owner",
  "intakeFolder": "intake/",
  "reviewedOfficialIdentifiers": [],
  "sources": [
    {
      "id": "stable-internal-id",
      "title": "Player-facing label",
      "sourceName": "Source name as published",
      "citation": "Internal identifier until a real one is reviewed",
      "sourceType": "summary",
      "jurisdiction": "Fictional",
      "verificationStatus": "unverified",
      "provenance": "Where/how this record was obtained, with publication and retrieval date"
    }
  ]
}
```

| Field                         | Required | Meaning / rule                                                                                                                    |
| ----------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`               | yes      | Must be `1`. Missing or unsupported values are rejected (`MISSING_SCHEMA_VERSION` / `UNSUPPORTED_SCHEMA_VERSION`).                |
| `corpusId`                    | yes      | Stable internal id for the manifest (not a legal citation).                                                                       |
| `status`                      | no       | One of `blocked`, `draft`, `in-review`, `approved`. Defaults semantically to `blocked` while the corpus is gated.                 |
| `owner`                       | no       | `null` until a named human content owner is assigned; then their name.                                                            |
| `intakeFolder`                | no       | Path to the intake folder (e.g. `intake/`).                                                                                       |
| `reviewedOfficialIdentifiers` | no       | Human-reviewed allowlist of exact citation identifiers. Empty by default; never populated by intake, AI or inference.             |
| `sources`                     | yes      | Array of `LegalSource` records (the shape in [`../examples/legal-sources.example.json`](../examples/legal-sources.example.json)). |
| `template`                    | no       | If truthy, the whole manifest is **rejected** as a template (`MANIFEST_IS_TEMPLATE`). The shipped template sets this to `true`.   |

Each `sources[]` record must carry `id`, `title`, `sourceName`, `citation`, `sourceType`,
`jurisdiction`, `verificationStatus` and `provenance`. A `verified` record additionally requires
`verifiedBy` (named human), `verificationDate` (`YYYY-MM-DD`) and — for real-world authority or a
specific-looking citation — an official `sourceUrl`. Specific-looking citations (a
`Section`/`Article` number, `AIR <year>`, `<year> SCC/SCR/CLR`, or `X v. Y`) also require an exact
allowlist entry. A record whose `title`, `sourceName` or `citation` contains `placeholder` can
never be `verified`. Full field contract and error codes:
[`../LEGAL_SOURCE_VERIFICATION.md`](../LEGAL_SOURCE_VERIFICATION.md).

## 4. Verification workflow (summary)

1. **Acquire** exact text from an acceptable official source (§5 of the verification doc);
   record publisher, publication identifier and retrieval date/version in the intake notes.
2. **Draft** a source record in `intake/unverified/` with `verificationStatus: "unverified"` and
   faithful `provenance`. Never fill `verifiedBy`/`verificationDate` at this stage.
3. **Run the validator** against a manifest containing the draft:
   `npm run validate:legal-corpus -- docs/legal-corpus/manifest.json` (exit `0` required before
   review; `1` = validation failure, `2` = usage/IO error). Fix every `ERROR`; understand every
   `WARN`. For a quick record-only check, `npm run validate:sources -- --seed` validates the
   shipped in-app seed.
4. **Human review** by the named content owner: exact wording, citation, source name,
   jurisdiction, effective date/version and rights. If anything cannot be confirmed, stop.
5. **Record sign-off**: set `verifiedBy` and `verificationDate`, add the official `sourceUrl`,
   append the sign-off log row in the verification doc, and (for specific-looking citations) add
   the exact identifier to `reviewedOfficialIdentifiers`. Move the checked text to
   `intake/reviewed/`.
6. **Set manifest** `status: "in-review"` then `approved`, and fill `owner`.
7. **Re-run the validator** — it must still exit `0`.
8. **Commit** the manifest, reviewed notes, allowlist change and sign-off log together.

The in-app equivalent for a player draft is `markSourceVerified`, the same strict gate exposed as
a human step, never as a player action.

## 5. Commands

```bash
# Shape template must be rejected (expected exit code 1 — proves it is not ingestible):
npm run validate:legal-corpus -- --template

# Validate a real manifest once one exists (not shipped while blocked):
npm run validate:legal-corpus -- docs/legal-corpus/manifest.json

# Record-only validator, unchanged and backwards compatible:
npm run validate:sources -- --seed
npm run validate:sources -- docs/examples/legal-sources.example.json

# Help / usage:
npm run validate:legal-corpus -- --help
```

## 6. Current blocked status

- No real corpus manifest exists; `manifest.json` is intentionally not shipped.
- `manifest.template.json` is a **template**, rejected by the validator by design.
- The in-app seed contains explicit statutory placeholders and one verified internal fictional
  educational summary (not legal authority). No person is recorded as having verified real law.
- The reviewed-identifier allowlist is empty, and the reviewer/versioning decisions remain
  `Unknown` ([`../DECISIONS.md`](../DECISIONS.md), D-005/D-011).
- Unblocks only when the legal content owner is assigned, supplies official text with rights, and
  signs off using the documented workflow.
