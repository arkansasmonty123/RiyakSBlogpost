# Legal Source Verification Workflow (D-005 / D-011)

> **Status (2026-11-22): WORKFLOW + TOOLING COMPLETE — CORPUS BLOCKED.**
> The deterministic validator, CLI, checklist and sign-off process below are implemented and
> tested. **No official legal corpus has been supplied, ingested or verified.** No real
> statutory provision, judgment, reporter citation or procedural rule has been entered. Real
> ingestion remains blocked until the legal/content owner (the owner of D-005/D-011) supplies
> official text and signs off on it. The reviewer-assignment and versioning-policy decisions
> remain `Unknown` in [`DECISIONS.md`](./DECISIONS.md).

## 1. Scope

This document is the process a human content owner follows to add real legal material to THE
BAR. It covers how provenance is recorded, how records are checked, and who may sign off. It is
not itself a source of law and creates no legal content.

The game runtime never performs this workflow. Player **Source Intake** only ever creates
`unverified` or `placeholder` records, and the human `markSourceVerified` domain step (not a
player action) enforces the same gate described here.

## 2. Non-negotiables (read first)

- **No fabrication.** Never write a statutory provision, section/article number, judgment
  name, reporter citation, effective date, procedural rule or official URL from memory, from
  an AI stub, or by extrapolation. Copy exact text only from an official publication and keep
  a record of which publication and date/version it came from.
- **No invented identifiers or URLs.** If the exact citation or official URL is not known,
  leave the record `unverified` or `placeholder`. A `example.invalid` URL is fine in tests and
  examples; it is never acceptable in a verified corpus record.
- **No self-verification, no auto-verification.** `intakeSource` rejects a requested
  `verified` status. Only a named human content owner may verify, and only after the steps in
  §6. The validator checks the *presence* of an attestation; it cannot confirm that the
  reviewer actually checked the text. That honesty is the reviewer's responsibility.
- **Never promote stand-ins.** `placeholder` and `unverified` records can never be cited as
  authoritative. Excerpts and summaries are non-authoritative by construction and must stay
  labeled as such wherever they are displayed.
- **No real citations in test/example data.** Tests use clearly fictional or internal
  identifiers. Strings that look like real citations appear only in tests that verify they are
  *rejected*.
- THE BAR is an educational simulation, not legal advice or a substitute for legal education,
  qualification or supervised practice.

## 3. Roles

| Role | Responsibility |
|---|---|
| Ingest operator (engineering) | Obtains text from an official source, records exact metadata, runs the validator, prepares the change. Does **not** sign off legal accuracy. |
| Legal content owner / named reviewer | Confirms the exact text, citation, jurisdiction, effective date and version against the official publication; signs off with name and date; authorises adding the identifier to the reviewed allowlist. |
| Maintainer | Commits the corpus change together with the sign-off log entry (§8) and keeps the allowlist limited to reviewed identifiers. |

The named reviewer is the owner of D-005/D-011. That owner is not yet assigned; until then the
reviewer field in §8 stays empty and no real corpus record may be marked verified.

## 4. Required fields

Every record must provide the first group. The second group is required **in addition** when
`verificationStatus` is `verified`.

| Field | When required | Meaning / rule |
|---|---|---|
| `id` | always | Stable internal record id (not a legal citation). |
| `title` | always | Player-facing label. |
| `sourceName` | always | Name of the source as published; never an invented title. |
| `citation` | always | Citation or stable identifier. Never invent one; use an internal placeholder id until the real one is known. |
| `sourceType` | always | `statute`, `judgment`, `rule`, `commentary`, `summary`. |
| `jurisdiction` | always | `India` or `Fictional`. |
| `verificationStatus` | always | `verified`, `unverified`, `placeholder`. |
| `provenance` | always | Non-authoritative note: where/how the record was obtained (publisher, publication, date/version retrieved). |
| `sourceUrl` | verified real-world authority or specific-looking citation | Official publisher URL (`http(s)`). Internal fictional summaries may omit it (a warning is emitted). |
| `effectiveDate` | when the authority has one | `YYYY-MM-DD` date on which the provision/rule took effect. |
| `verifiedBy` | **verified only** | Name of the human/content owner who reviewed the exact text. |
| `verificationDate` | **verified only** | `YYYY-MM-DD` date of that human review. |
| `excerpt`, `notes` | optional | Non-authoritative; labeled as such in the UI. |
| `intake` | optional | `seed` for content-owner supplied records, `player-draft` for in-game drafts. |

A record whose `title`, `sourceName` or `citation` is marked as a `placeholder` can **never** be
`verified`. A `citation` that matches a specific-citation pattern (a `Section`/`Article`
number, `AIR <year>`, `<year> SCC/SCR/CLR`, or an `X v. Y` case name) can only be `verified`
once its exact identifier appears in the reviewed allowlist (§6, step 6). The allowlist is empty
by default.

## 5. Acceptable official sources

Use only material whose authority can be traced to the publisher:

- The official legislature/gazette publication for central or state legislation (including the
  official gazette portal and any official corrected/reprinted text).
- The official court or judiciary website for judgments, rules and procedural directions.
- Official notifications/reprints published by the body that made the rule.
- A licensed commercial reporter **only** where the project holds the necessary rights to
  reproduce text and the citation, with the license recorded in `provenance`.
- Text supplied directly by the content owner, with `provenance` naming the official
  publication it was checked against.

Not acceptable: blogs, wikis, tutorial/answer sites, social media, search snippets, AI output,
another game's data, unverified secondary commentary, or anything reproduced without rights.
A non-authoritative summary may be stored as `commentary`/`summary`, but it must never be
promoted to a verified statutory or judgment citation.

## 6. Step-by-step verification

1. **Acquire.** Download/copy the exact text from an acceptable official source (§5). Record
   the publisher, publication identifier and retrieval date/version in your working notes.
2. **Draft the record.** Add it to a corpus JSON file using
   [`docs/examples/legal-sources.example.json`](./examples/legal-sources.example.json) as a
   shape template. Start with `verificationStatus: "unverified"` and a faithful `provenance`.
   Never fill `verifiedBy`/`verificationDate` at this stage.
3. **Run the validator (must PASS before review):**
   ```bash
   npm run validate:sources -- path/to/corpus.json
   # or check the shipped in-app seed:
   npm run validate:sources -- --seed
   ```
   Exit code `0` = all records pass, `1` = at least one record failed, `2` = usage/IO error.
   Fix every `ERROR` before proceeding. `WARN` lines are informational but must be understood.
4. **Human review.** The named content owner checks, against the official publication:
   exact wording of any quoted excerpt; the citation/identifier; source name; jurisdiction;
   effective date and version; and that the text is within the project's rights. If anything
   cannot be confirmed, stop and leave the record `unverified`/`placeholder`.
5. **Record sign-off.** Set `verifiedBy` to the reviewer's name and `verificationDate` to the
   `YYYY-MM-DD` review date. Add the official `sourceUrl` for real-world authority or a
   specific-looking citation. Add the §8 sign-off entry.
6. **Allowlist the identifier (only if specific-looking).** If the citation matches a specific
   citation pattern, the reviewer must add its exact identifier to
   `reviewedOfficialIdentifiers` in the corpus file. This list is the sole machine-readable
   record of "a human checked this exact identifier" and must never be populated from intake,
   AI output or inference. Internal fictional summaries do not need an allowlist entry.
7. **Re-run the validator.** It must still return exit code `0` with the sign-off fields and
   allowlist entry present.
8. **Commit and version.** Commit the corpus file, the allowlist change and the §8 sign-off
   together. Record the text version/retrieval date in `provenance` so a future reviewer can
   detect a superseded provision. Only now may the record carry `verificationStatus: "verified"`
   and be cited as authoritative in gameplay.
9. **In-app equivalent.** For a player-drafted record, the human step is `markSourceVerified`,
   which applies the same gate and is not exposed as a player action. A saved record whose
   provenance is later broken is demoted on load and can no longer be cited.

## 7. Tooling reference

| Surface | Location |
|---|---|
| Single-record validator | `validateSourceRecord(source, options?)` in `src/domain/sourceValidation.ts` |
| Whole-corpus validator | `validateSourceRecords(input, options?)` in `src/domain/sourceValidation.ts` |
| CLI / npm script | `scripts/validate-sources.ts`, run via `npm run validate:sources -- <args>` |
| Runtime human step | `markSourceVerified` in `src/domain/legalSources.ts` |

Key error codes emitted by the validator:

| Code | Meaning |
|---|---|
| `INVALID_RECORD` | Input was not a JSON object. |
| `MISSING_ID`, `MISSING_TITLE`, `MISSING_SOURCE_NAME`, `MISSING_CITATION`, `MISSING_PROVENANCE` | Required provenance field absent. |
| `INVALID_SOURCE_TYPE`, `INVALID_JURISDICTION`, `INVALID_VERIFICATION_STATUS`, `INVALID_INTAKE` | Value outside the allowed set. |
| `INVALID_SOURCE_URL`, `INVALID_EFFECTIVE_DATE`, `INVALID_VERIFICATION_DATE` | Malformed URL or `YYYY-MM-DD` date. |
| `VERIFIED_WITHOUT_REVIEWER`, `VERIFIED_WITHOUT_DATE` | Missing human sign-off on a verified record. |
| `VERIFIED_WITHOUT_OFFICIAL_URL` | Real-world authority/specific citation lacks an official URL. |
| `UNREVIEWED_SPECIFIC_CITATION` | Specific-looking citation not in the reviewed allowlist. |
| `PLACEHOLDER_CANNOT_BE_VERIFIED` | A stand-in was marked verified. |
| `FIELD_TOO_LONG` (warning) | Field exceeds the app's cap and would be truncated. |

## 8. Reviewer sign-off log

No real source has been reviewed. This table is the human audit trail; append one row per
reviewed corpus change.

| Date (YYYY-MM-DD) | Reviewer name | Corpus file / commit | Identifiers reviewed | Official publication checked | Result |
|---|---|---|---|---|---|
| — | — | — | — | — | No real corpus reviewed yet (D-005/D-011 blocked) |

## 9. Current corpus status

- The in-app seed contains three explicit statutory **placeholders** and one **verified internal
  fictional educational summary** (not a real legal authority). All four pass the ingestion
  validator. The summary's `verifiedBy` value is an internal prototype-review designation —
  **not** a legal content-owner sign-off — and it emits only a `NO_OFFICIAL_URL` warning, which
  is expected for internal fictional material. No person is recorded as having verified real
  law.
- The shipped reviewed-identifier allowlist is empty.
- No real legal text, provision, judgment, citation or procedural rule has been ingested or
  fabricated.
