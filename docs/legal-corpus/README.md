# Legal corpus intake pipeline (D-005 / D-011)

> **Status (2026-11-23): INTERNAL ORIGINAL EDUCATIONAL CORPUS PRESENT — REAL OFFICIAL CORPUS STILL PENDING EXTERNAL VERIFICATION.**
> The folder layout, manifest format, deterministic validator and human verification checklist
> below are implemented and tested. `manifest.json` now ships, but it contains **only original
> internal educational summaries** written for THE BAR prototype. Every record is explicitly
> marked `internal-educational-summary`, `non-authoritative`, "not legal advice", uses an internal
> identifier only, and asserts no real citation. **No official legal source has been supplied,
> ingested or verified.** No real statutory provision, judgment, reporter citation or procedural
> rule has been entered. Real official ingestion remains blocked until a legal/content owner is
> assigned, supplies official text and signs off on it; the reviewer assignment and versioning
> policy for real law are still recorded as `Unknown` in [`../DECISIONS.md`](../DECISIONS.md).

This directory holds an **internal educational corpus plus the process/tooling scaffold**.
Nothing in it is a source of law. The runtime never reads these files; they exist so a human
content owner has a deterministic, reviewable path from official publication to a validated
record.

The step-by-step human workflow (acquisition checklist, reviewer sign-off, rights/licensing,
version/effective-date notes, allowlist workflow and import staging) is in
[`ACQUISITION_CHECKLIST.md`](./ACQUISITION_CHECKLIST.md). It is the companion to this folder-layout /
manifest-format reference and to [`../LEGAL_SOURCE_VERIFICATION.md`](../LEGAL_SOURCE_VERIFICATION.md).

## 1. Non-negotiables (read first)

- **No fabrication.** Never write a statutory provision, section/article number, judgment name,
  reporter citation, effective date, procedural rule or official URL from memory, from an AI
  stub, or by extrapolation. Copy exact text only from an official publication and record which
  publication and version/date it came from.
- **No real legal text here yet.** The files shipped are this README, a clearly marked
  `manifest.template.json` whose records are non-authoritative examples, and a real (non-template)
  `manifest.json` containing **only original internal educational summaries**. Those summaries
  are teaching material written for the prototype: they quote no official text and assert no real
  provision, judgment, citation or rule. They are non-authoritative and are not legal advice.
- **Templates are not corpora.** `manifest.template.json` carries `"template": true`; the
  validator **rejects** it by design (`npm run validate:legal-corpus -- --template` must exit 1).
  Copying the template and leaving real-looking text in it does not make anything verified. The
  real `manifest.json` is not a template; it passes validation precisely because its records are
  original, clearly marked internal educational summaries with no real citations.
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
├── README.md                 # this document (folder layout + manifest format)
├── ACQUISITION_CHECKLIST.md  # human acquisition, sign-off, rights, version, allowlist, staging
├── manifest.template.json    # TEMPLATE / NOT LEGAL AUTHORITY — never ingestible (rejected)
├── manifest.json             # REAL (non-template): internal ORIGINAL educational summaries only,
│                             #   non-authoritative, not legal advice, no real citations.
└── intake/
    ├── unverified/           # raw drafts; non-authoritative; .gitkeep only
    └── reviewed/             # human-checked text + sign-off notes; .gitkeep only
```

- `intake/unverified/` — working drafts copied from official material, with retrieval notes.
  Nothing here is authoritative. These files are ordinary JSON/text and are not read by the app.
- `intake/reviewed/` — exact text the named reviewer has checked, together with the reviewer's
  name, review date and the publication/version checked. Only material that passes §5 may be
  promoted into a manifest's `sources` array.
- `manifest.json` — the single file the validator checks. It **is** present, but only as an
  internal original educational corpus: four original summaries, each marked
  `internal-educational-summary` / `non-authoritative` / not legal advice, with internal identifiers
  and no real citation. It is not the real official corpus; that must still be created from the
  template **after** the workflow in §4 and §5 is complete, with official text and sign-off.

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

| Field                               | Required | Meaning / rule                                                                                                                    |
| ----------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                     | yes      | Must be `1`. Missing or unsupported values are rejected (`MISSING_SCHEMA_VERSION` / `UNSUPPORTED_SCHEMA_VERSION`).                |
| `corpusId`                          | yes      | Stable internal id for the manifest (not a legal citation).                                                                       |
| `status`                            | no       | One of `blocked`, `draft`, `in-review`, `approved`. Defaults semantically to `blocked` while the corpus is gated.                 |
| `owner`                             | no       | `null` until a named human content owner is assigned; then their name.                                                            |
| `intakeFolder`                      | no       | Path to the intake folder (e.g. `intake/`).                                                                                       |
| `reviewedOfficialIdentifiers`       | no       | Human-reviewed allowlist of exact citation identifiers. Empty by default; never populated by intake, AI or inference.             |
| `sources`                           | yes      | Array of `LegalSource` records (the shape in [`../examples/legal-sources.example.json`](../examples/legal-sources.example.json)). |
| `template`                          | no       | If truthy, the whole manifest is **rejected** as a template (`MANIFEST_IS_TEMPLATE`). The shipped template sets this to `true`.   |
| `corpusKind`                        | no       | `internal-educational-summary` when present; the only shipped kind. Declares original internal teaching content, never law.       |
| `authority`                         | no       | `non-authoritative` when present; no shipped corpus is legal authority.                                                           |
| `disclaimer`, `assertsRealCitation` | no       | Non-empty disclaimer text and `false`; both are mandatory for a declared internal educational corpus.                             |

Each `sources[]` record must carry `id`, `title`, `sourceName`, `citation`, `sourceType`,
`jurisdiction`, `verificationStatus` and `provenance`. A `verified` record additionally requires
`verifiedBy` (named human), `verificationDate` (`YYYY-MM-DD`) and — for real-world authority or a
specific-looking citation — an official `sourceUrl`. Specific-looking citations (a
`Section`/`Article` number, `AIR <year>`, `<year> SCC/SCR/CLR`, or `X v. Y`) also require an exact
allowlist entry. A record whose `title`, `sourceName` or `citation` contains `placeholder` can
never be `verified`. Full field contract and error codes:
[`../LEGAL_SOURCE_VERIFICATION.md`](../LEGAL_SOURCE_VERIFICATION.md).

**Internal educational markers.** A corpus declaring `corpusKind: "internal-educational-summary"`
is held to stricter, honesty-preserving rules: `authority: "non-authoritative"`, a non-empty
`disclaimer`, `assertsRealCitation: false`, an empty `reviewedOfficialIdentifiers`, and **only**
`summary` records that carry `category: "internal-educational-summary"`,
`authority: "non-authoritative"`, `assertsRealCitation: false` and an internal (non-specific-
looking) citation. This is what lets the shipped `manifest.json` be a real manifest without
fabricating any law; violations are hard errors (`EDUCATIONAL_CORPUS_*`,
`MISSING_*_DECLARATION`, `INVALID_CORPUS_KIND`, etc.). A `verified` status inside this corpus means
only that the project owner reviewed the text as original internal educational material — never
that any law was verified.

### Optional pipeline metadata (all new fields are optional / backward compatible)

These fields carry the human attestations from
[`ACQUISITION_CHECKLIST.md`](./ACQUISITION_CHECKLIST.md). A present-but-malformed field is an error;
an absent/incomplete attestation on an `in-review`/`approved` corpus is a warning.

| Field             | Meaning / rule                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `provenanceNote`  | Non-empty corpus-level provenance summary.                                                                  |
| `acquisition`     | `{ checklistCompleted, reviewerAssigned, officialSources, retrievalDate }` — exact-text acquisition record. |
| `signoff`         | `{ reviewer, date, scope?, notes? }` — named human + `YYYY-MM-DD`; `TBD`/`auto`/`AI` are rejected.          |
| `rights`          | `{ status: none\|pending\|cleared, basis?, license?, confirmedBy?, confirmedDate? }` — reproduction rights. |
| `versionPolicy`   | `{ effectiveDatePolicy?, asOf?, note?, supersedes? }` — version/effective-date facts (policy still open).   |
| `allowlistPolicy` | `{ maintainedBy?, lastReviewed?, policyNote? }` — who maintains `reviewedOfficialIdentifiers`.              |
| `staging`         | `{ stage: unverified\|reviewed\|promoted, unverifiedFolder?, reviewedFolder?, importNote? }`.               |

`rights.status: "cleared"` requires `basis` and `confirmedBy`. A `signoff` block requires both a
human `reviewer` and a `date`. Duplicate record `id`s are rejected (`DUPLICATE_SOURCE_ID`).
No real values are shipped: the template uses `TEMPLATE`/`null` placeholders and is always rejected.

## 4. Verification workflow (summary)

1. **Acquire** exact text from an acceptable official source (§5 of the verification doc);
   work through the [`ACQUISITION_CHECKLIST.md`](./ACQUISITION_CHECKLIST.md) items and record
   publisher, publication identifier and retrieval date/version in the intake notes.
2. **Draft** a source record in `intake/unverified/` with `verificationStatus: "unverified"` and
   faithful `provenance`. Never fill `verifiedBy`/`verificationDate` at this stage.
3. **Run the validator** against a working manifest containing the draft (do not overwrite the
   shipped `manifest.json`, which is the internal educational corpus):
   `npm run validate:legal-corpus -- <path-to-working-manifest.json>` (exit `0` required before
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

# Validate the shipped REAL (non-template) internal educational manifest (expected exit 0):
npm run validate:legal-corpus -- docs/legal-corpus/manifest.json

# Record-only validator, unchanged and backwards compatible:
npm run validate:sources -- --seed
npm run validate:sources -- docs/examples/legal-sources.example.json

# Help / usage:
npm run validate:legal-corpus -- --help
```

## 6. Current status (2026-11-23)

- An internal original educational corpus **is present**: `manifest.json` is a real, non-template
  manifest with four original summaries, each marked `internal-educational-summary`,
  `non-authoritative`, not legal advice, with internal identifiers and no real citation. Its
  signoff names the project owner and is dated 2026-11-23; rights are recorded as original internal
  work. `npm run validate:legal-corpus -- docs/legal-corpus/manifest.json` exits `0`.
- **The real official legal corpus is still pending external verification.** No official text has
  been acquired, ingested or verified; no person is recorded as having verified real law.
- `manifest.template.json` remains a **template**, rejected by the validator by design
  (`npm run validate:legal-corpus -- --template` exits 1). It is the starting point for a future
  real corpus, not a corpus itself.
- The in-app seed contains explicit statutory placeholders and one verified internal fictional
  educational summary (not legal authority).
- The reviewed-identifier allowlist is intentionally empty, the official-source acquisition
  checklist is not complete (no official text exists to acquire), and the reviewer/versioning
  decisions for real law remain `Unknown` ([`../DECISIONS.md`](../DECISIONS.md), D-005/D-011).
- The real corpus unblocks only when a legal content owner is assigned, supplies official text with
  confirmed rights, agrees the versioning policy and signs off using the documented workflow —
  never by filling the template from memory or AI output.
