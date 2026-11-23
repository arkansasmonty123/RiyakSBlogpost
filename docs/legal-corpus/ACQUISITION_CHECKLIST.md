# Source acquisition checklist & import staging (D-005 / D-011)

> **Status (2026-11-23): PIPELINE READY — CORPUS BLOCKED.**
> This is process/tooling documentation. **No official legal text has been acquired, ingested or
> verified.** No statutory provision, judgment, reporter citation or procedural rule appears here.
> The only example values are internal/fictional or explicitly marked `TEMPLATE`. The named
> reviewer assignment and the formal versioning policy are still recorded as `Unknown` in
> [`../DECISIONS.md`](../DECISIONS.md); do not write a policy or a reviewer name from memory.

This checklist is the human workflow that turns an official publication into a validated corpus
record. It complements [`README.md`](./README.md) (folder layout + manifest format) and
[`../LEGAL_SOURCE_VERIFICATION.md`](../LEGAL_SOURCE_VERIFICATION.md) (no-fabrication rules + sign-off
log). The runtime never reads these files; the validator only checks that attestations are present
and well formed. It cannot confirm that a reviewer actually checked the text.

## 0. Stop conditions — do not start if any of these is true

- No legal content owner / named reviewer has been assigned for D-005/D-011.
- The versioning / effective-date policy is still unresolved in `DECISIONS.md`.
- The project does not hold the rights to reproduce the text you intend to store.
- You are working from memory, an AI stub, a search snippet, a wiki, a blog or another game's data.

If any applies, leave the corpus `blocked`, keep `reviewedOfficialIdentifiers` empty and stop. Do not
"temporarily" fill a real-looking citation or URL — placeholders must be labeled as such.

## 1. Source acquisition checklist

Copy this block into your intake notes and tick each item **only when a human has actually done it**.

```text
[ ] 1. Reviewer assigned: name = ______, date = YYYY-MM-DD (must not be TBD/auto/AI/system)
[ ] 2. Official publisher identified (official gazette / court / rule-making body);
       publication identifier and edition recorded verbatim: ______
[ ] 3. Exact text obtained from that official publication — copied verbatim, never from memory
       or AI output; nothing paraphrased into a "citation"
[ ] 4. Retrieval date recorded (YYYY-MM-DD) and version/edition noted; checked for corrections
       or a superseding version
[ ] 5. Rights to reproduce confirmed; basis recorded (official public text, licensed reporter
       with the license identified, or text supplied by the content owner)
[ ] 6. Stable INTERNAL id assigned (not a legal citation): ______
[ ] 7. Record drafted in intake/unverified/ with verificationStatus "unverified" (or
       "placeholder" for a stand-in); provenance names the publication and retrieval date
[ ] 8. Known-unknowns listed: anything not confirmed stays blank or labeled placeholder
[ ] 9. Validator run on the draft (npm run validate:legal-corpus -- <manifest>) — exit 0
[ ] 10. Human review of exact wording, citation, jurisdiction, effective date/version and rights
[ ] 11. Sign-off recorded (§3) and, for a specific-looking citation, exact identifier allowlisted (§6)
[ ] 12. Checked text moved to intake/reviewed/ and imported per §7; validator re-run — exit 0
```

## 2. Per-record provenance fields (every `sources[]` record)

| Field                | Required                                | Rule                                                                                    |
| -------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `id`                 | always                                  | Unique stable internal id. Reuse is rejected (`DUPLICATE_SOURCE_ID`).                   |
| `title`              | always                                  | Player-facing label. A `TEMPLATE`/`EXAMPLE`/`SAMPLE` label can never be `verified`.     |
| `sourceName`         | always                                  | Source name as published, never an invented title.                                      |
| `citation`           | always                                  | Exact reviewed citation or an internal identifier. Never invent one.                    |
| `sourceType`         | always                                  | `statute`, `judgment`, `rule`, `commentary`, `summary`.                                 |
| `jurisdiction`       | always                                  | `India` or `Fictional`.                                                                 |
| `verificationStatus` | always                                  | `verified`, `unverified`, `placeholder`.                                                |
| `provenance`         | always                                  | Publisher/publication, retrieval date and version. Non-authoritative trace note only.   |
| `sourceUrl`          | verified authority or specific citation | Official publisher URL (`http(s)`). Internal fictional summaries may omit it (warning). |
| `effectiveDate`      | when the authority has one              | `YYYY-MM-DD` date the provision/rule took effect.                                       |
| `verifiedBy`         | `verified` only                         | Named human/content owner. `TBD`/`auto`/`AI`/`system`/`unknown` are rejected.           |
| `verificationDate`   | `verified` only                         | `YYYY-MM-DD` review date.                                                               |
| `excerpt`, `notes`   | optional                                | Non-authoritative; always labeled as such in the UI.                                    |

A record whose `title`, `sourceName` or `citation` contains `placeholder` is rejected as verified
(`PLACEHOLDER_CANNOT_BE_VERIFIED`); `template`/`example`/`sample`/`TBD`/`do-not-use` markers are
rejected as verified too (`TEMPLATE_OR_EXAMPLE_CANNOT_BE_VERIFIED`). Stand-ins remain non-authoritative.

## 3. Reviewer sign-off fields

A real manifest records sign-off in **two places**, both optional for backward compatibility but
required by this workflow before `status: "approved"`:

| Manifest field     | Type / rule                 | Meaning                                                    |
| ------------------ | --------------------------- | ---------------------------------------------------------- |
| `owner`            | `null` or non-empty string  | Named human content owner of the corpus.                   |
| `signoff.reviewer` | non-empty human name        | The person who checked exact text against the publication. |
| `signoff.date`     | `YYYY-MM-DD`                | Date of that review.                                       |
| `signoff.scope`    | non-empty string (optional) | Which records/identifiers the review covered.              |
| `signoff.notes`    | non-empty string (optional) | Caveats, corrections or unresolved questions.              |

Per record, `verifiedBy` and `verificationDate` carry the same human/date pair. A `signoff` block
that is present but missing the reviewer or date is a hard error (`INCOMPLETE_SIGNOFF`); an absent
signoff on an `in-review`/`approved` corpus is a warning (`MISSING_SIGNOFF`). Append the §8 log row in
[`../LEGAL_SOURCE_VERIFICATION.md`](../LEGAL_SOURCE_VERIFICATION.md) at the same time.

## 4. Rights / licensing / corpus provenance

| Field                  | Values / rule                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `provenanceNote`       | Non-empty corpus-level provenance summary (optional).                                                  |
| `rights.status`        | `none` (no reproduction rights), `pending` (being checked), `cleared` (confirmed).                     |
| `rights.basis`         | Why reproduction is allowed: official public publication, identified license, or content-owner supply. |
| `rights.license`       | License identifier/reference when a licensed source is used (optional).                                |
| `rights.confirmedBy`   | Named human who confirmed rights.                                                                      |
| `rights.confirmedDate` | `YYYY-MM-DD` date rights were confirmed.                                                               |

`rights.status: "cleared"` is an explicit claim: it is rejected without `basis` and `confirmedBy`
(`RIGHTS_CLEARANCE_INCOMPLETE`). A gated corpus without cleared rights warns (`RIGHTS_NOT_CLEARED`).
Never record a license or rights basis you have not seen; leave the record pending/blocked.

## 5. Version / effective-date policy note

There is **no agreed formal policy yet** (D-011 is `Unknown`). Record facts, not a fabricated policy:

| Field                               | Rule                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `versionPolicy.effectiveDatePolicy` | Note how effective dates are treated for this corpus (optional string). |
| `versionPolicy.asOf`                | `YYYY-MM-DD` "checked as of" date (optional).                           |
| `versionPolicy.note`                | Free-text note; e.g. that the formal policy is still open.              |
| `versionPolicy.supersedes`          | Identifier of a prior version this corpus replaces (optional).          |

Per record, `effectiveDate` must use `YYYY-MM-DD`; do not guess it. If a provision may have been
amended, treat it as unverified until a human confirms the current version and records the check
date in `provenance`. An approved corpus with no version note warns (`NO_VERSION_POLICY`).

## 6. Allowlist workflow (`reviewedOfficialIdentifiers`)

The allowlist is the **only** machine-readable record that a human checked an exact citation.

1. It starts empty and stays empty while `status` is `blocked` (`BLOCKED_WITH_REVIEWED_IDS` warns
   if identifiers appear too early).
2. Only after §1–§4, a named reviewer adds the **exact** citation identifier — no normalization on
   legal meaning, no inference, no AI output, no bulk import from a list of "known" citations.
3. Matching is by trimmed, lowercased, whitespace-collapsed text (e.g. `"  section 999   of the
fictional act  "` matches `"Section 999 of the Fictional Act"`). This is purely a string check;
   it does **not** make a citation real. That fictional string appears only to demonstrate the gate.
4. A specific-looking citation that is not allowlisted cannot be verified
   (`UNREVIEWED_SPECIFIC_CITATION`). A verified record that needs an allowlist entry but whose
   allowlist entry matches no source warns (`UNUSED_REVIEWED_IDENTIFIER`) — stale entries must be
   removed so they can never lend authority to a future, unchecked citation.
5. Record who maintains the list and when: `allowlistPolicy.maintainedBy`, `allowlistPolicy.lastReviewed`
   (`YYYY-MM-DD`), `allowlistPolicy.policyNote`. The validator warns when identifiers exist without
   this policy (`REVIEWED_IDS_WITHOUT_ALLOWLIST_POLICY`).

## 7. Import staging flow

Material moves through three stages; only the last stage is eligible for gameplay citation.

| `staging.stage` | Status usually    | Folder               | Authority                                          |
| --------------- | ----------------- | -------------------- | -------------------------------------------------- |
| `unverified`    | `blocked`/`draft` | `intake/unverified/` | None — working draft.                              |
| `reviewed`      | `in-review`       | `intake/reviewed/`   | Still non-authoritative until sign-off + approval. |
| `promoted`      | `approved`        | manifest `sources[]` | May be cited only after human sign-off.            |

`staging` also accepts `unverifiedFolder`, `reviewedFolder` and `importNote` (all optional strings).
`staging.stage: "promoted"` with a non-`approved` status warns (`STAGE_STATUS_MISMATCH`); a corpus
still staged `unverified` that already contains verified records warns (`UNSTAGED_VERIFIED_SOURCES`).

```text
intake/unverified/  --[acquire §1, draft §2, validate]-->  intake/reviewed/
    --[human review §3-§5, allowlist §6]-->  manifest.json sources[]
    --[status approved + validator exit 0]-->  promoted (eligible for citation)
```

The app does not read any of these files. A saved record with broken provenance is demoted on load.

## 8. Manifest metadata reference (all new fields optional)

| Field                                                    | Type                                     | Validation                                                                     |
| -------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `provenanceNote`                                         | non-empty string                         | `INVALID_CORPUS_PROVENANCE`                                                    |
| `acquisition.checklistCompleted`                         | boolean                                  | `INVALID_ACQUISITION_CHECKLIST` / warning if not `true`                        |
| `acquisition.reviewerAssigned`                           | boolean                                  | `INVALID_ACQUISITION_CHECKLIST`                                                |
| `acquisition.officialSources`                            | array of non-empty strings               | `INVALID_ACQUISITION_SOURCES`                                                  |
| `acquisition.retrievalDate`                              | `YYYY-MM-DD`                             | `INVALID_ACQUISITION_DATE`                                                     |
| `signoff.reviewer` / `signoff.date`                      | human name / `YYYY-MM-DD`                | `INVALID_SIGNOFF_REVIEWER` / `INVALID_SIGNOFF_DATE`                            |
| `signoff.scope` / `signoff.notes`                        | non-empty strings                        | `INVALID_SIGNOFF_SCOPE` / `INVALID_SIGNOFF_NOTES`                              |
| `rights.status`                                          | `none` \| `pending` \| `cleared`         | `INVALID_RIGHTS_STATUS` / `RIGHTS_STATUS_MISSING` (warning)                    |
| `rights.basis` / `rights.license` / `rights.confirmedBy` | non-empty strings                        | `INVALID_RIGHTS_BASIS` / `INVALID_RIGHTS_LICENSE` / `INVALID_RIGHTS_CONFIRMER` |
| `rights.confirmedDate`                                   | `YYYY-MM-DD`                             | `INVALID_RIGHTS_DATE`                                                          |
| `versionPolicy.*`                                        | strings (`asOf` is `YYYY-MM-DD`)         | `INVALID_VERSION_POLICY` / `INVALID_VERSION_POLICY_AS_OF`                      |
| `allowlistPolicy.maintainedBy` / `policyNote`            | non-empty strings                        | `INVALID_ALLOWLIST_POLICY`                                                     |
| `allowlistPolicy.lastReviewed`                           | `YYYY-MM-DD`                             | `INVALID_ALLOWLIST_POLICY_DATE`                                                |
| `staging.stage`                                          | `unverified` \| `reviewed` \| `promoted` | `INVALID_STAGING_STAGE` / `MISSING_STAGING_STAGE`                              |
| `staging.*Folder` / `staging.importNote`                 | non-empty strings                        | `INVALID_STAGING`                                                              |

Unknown extra fields are ignored (forward compatible). A present non-object metadata block is
rejected (`INVALID_ACQUISITION`, `INVALID_SIGNOFF`, `INVALID_RIGHTS`, `INVALID_VERSION_POLICY`,
`INVALID_ALLOWLIST_POLICY`, `INVALID_STAGING`). The original record-level codes are listed in
[`../LEGAL_SOURCE_VERIFICATION.md`](../LEGAL_SOURCE_VERIFICATION.md#7-tooling-reference); the
hardening codes added with this checklist are:

| Code                                                                                                           | Meaning                                                             | Severity |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| `DUPLICATE_SOURCE_ID`                                                                                          | A record id was reused; only the first occurrence stands.           | error    |
| `TEMPLATE_OR_EXAMPLE_CANNOT_BE_VERIFIED`                                                                       | A self-labeled template/example/sample cannot be verified.          | error    |
| `NON_HUMAN_REVIEWER`                                                                                           | `verifiedBy` is TBD/auto/AI/system/unknown, not a named human.      | error    |
| `NON_HUMAN_SIGNOFF_REVIEWER`                                                                                   | `signoff.reviewer` is a non-human placeholder value.                | error    |
| `INCOMPLETE_SIGNOFF`                                                                                           | A signoff block lacks a human reviewer or a review date.            | error    |
| `RIGHTS_CLEARANCE_INCOMPLETE`                                                                                  | `rights.status` is `cleared` without a basis and a human confirmer. | error    |
| `INVALID_*` metadata codes                                                                                     | Present metadata field has the wrong shape/type/date/enum.          | error    |
| `UNUSED_REVIEWED_IDENTIFIER`                                                                                   | Allowlist entry matches no citation in this corpus (stale entry).   | warning  |
| `REVIEWED_IDS_WITHOUT_ALLOWLIST_POLICY`                                                                        | Allowlist is populated but has no recorded maintainer.              | warning  |
| `STAGE_STATUS_MISMATCH`                                                                                        | Staging stage and manifest status disagree.                         | warning  |
| `UNSTAGED_VERIFIED_SOURCES`                                                                                    | Corpus still staged `unverified` but contains verified records.     | warning  |
| `ACQUISITION_CHECKLIST_INCOMPLETE`                                                                             | Acquisition checklist is not marked complete.                       | warning  |
| `MISSING_SIGNOFF` / `RIGHTS_NOT_CLEARED` / `NO_VERSION_POLICY` / `NO_ACQUISITION_RECORD` / `NO_STAGING_RECORD` | Gated corpus is missing an attestation.                             | warning  |

## 9. Running the validator

```bash
# Shape template must be rejected (expected exit 1):
npm run validate:legal-corpus -- --template

# Real manifest (not shipped while blocked):
npm run validate:legal-corpus -- docs/legal-corpus/manifest.json

# Record-only check:
npm run validate:sources -- --seed
```

Exit codes: `0` = valid, `1` = validation failure, `2` = usage/IO error. The report prints a
`Summary` (errors/warnings), `STATUS: VALID` or `STATUS: BLOCKED`, and concrete `Next steps`
derived from the codes emitted. Nothing is ingested or verified by either CLI.

## 10. Blocked status (do not skip)

No real corpus manifest exists; `manifest.template.json` carries `template: true` and is rejected
by design; `reviewedOfficialIdentifiers` is empty; the in-app seed contains only labeled
placeholders and one internal fictional educational summary (not legal authority). Unblocks only
when the legal content owner is assigned, supplies official text with confirmed rights, agrees the
versioning policy and completes this checklist with a recorded sign-off.
