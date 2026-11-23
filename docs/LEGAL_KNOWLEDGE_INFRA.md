# THE BAR — Legal Knowledge Infrastructure (Track D Contract)

> **Status (2026-11-23): PIPELINE + SCHEMA + VALIDATORS IMPLEMENTED; NO REAL LEGAL TEXT INGESTED.**
> The provenance model, human-review workflow, manifest schema and deterministic validators exist and
> pass in-repo. What does **not** exist is a verified corpus of real law: every shipped record is either
> official **publication metadata** (name/identifier/URL only, no provision text) or an original
> **internal educational summary** (explicitly non-authoritative). The named legal content owner and the
> formal versioning/effective-date policy for real law are still `Unknown` in
> [`DECISIONS.md`](./DECISIONS.md) (D-005, D-011). Nothing here is legal advice, and nothing here makes
> any record a statement of the law of any real jurisdiction.

**Companion documents**

| Document                                                                           | Role                                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`LEGAL_SOURCE_VERIFICATION.md`](./LEGAL_SOURCE_VERIFICATION.md)                   | No-fabrication rules, acceptable official sources, step-by-step verification, sign-off log |
| [`legal-corpus/README.md`](./legal-corpus/README.md)                               | Intake folder layout, manifest field contract, validator commands                          |
| [`legal-corpus/ACQUISITION_CHECKLIST.md`](./legal-corpus/ACQUISITION_CHECKLIST.md) | Human acquisition checklist, rights, versioning note, allowlist, staging                   |
| [`AI_GATEWAY_ARCHITECTURE.md`](./AI_GATEWAY_ARCHITECTURE.md)                       | Track C contract: layer 2 (verified legal knowledge base) and RAG gating                   |
| [`DECISIONS.md`](./DECISIONS.md)                                                   | D-005 (corpus scope), D-011 (verification workflow + provenance schema), D-013 (AI safety) |

This document is the Track D contract: it states the intended model, what is implemented today, and what
is deliberately deferred. It is documentation only — no runtime code reads it and no runtime behaviour
is defined by it.

---

## 1. Provenance, versioning, effective-date and amendment tracking

### 1.1 Model

Every unit of legal knowledge is a **`LegalSource` record** (`src/domain/types.ts`). A record never
contains a legal assertion on its own; it describes **where** a statement came from and **how** it was
checked. Authority is a property of the review state, not of the text being present in the repo.

Three verification states exist and are the only ones the runtime understands
(`SourceVerificationStatus`):

| State         | Meaning                                                                                                                                                   | Citable as authoritative                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `verified`    | Traceable provenance confirmed by a named human; for real authority, an official URL and (for specific-looking citations) an allowlisted exact identifier | Yes, only if `canCiteAsAuthoritative` also passes |
| `unverified`  | Drafted/ingested, not yet confirmed                                                                                                                       | No                                                |
| `placeholder` | Explicit stand-in, often a citation-shaped string                                                                                                         | **Never** — the gate is unconditional             |

Two corpus kinds are supported by the manifest validator (`CORPUS_KINDS` in
`src/domain/sourceValidation.ts`):

- `internal-educational-summary` — original teaching text; must declare `authority: "non-authoritative"`,
  a disclaimer, `assertsRealCitation: false`, only `summary` records, no specific-looking citations and an
  empty allowlist.
- `official-source-metadata` — metadata/provenance records pointing at real official publications; must
  declare `authority: "official-publication-metadata"`, `assertsRealCitation: true`, an official
  `sourceUrl` per record, and must **not** reproduce provision/judgment text (excerpts capped at 240
  characters and treated as metadata notes).

The two kinds are deliberately disjoint: a corpus cannot be "half authoritative". Metadata about an Act
and the text of that Act are different artifacts with different verification burdens.

### 1.2 Versioning and effective dates — implemented surface

| Concern                               | Implemented field                                             | Location                                          | Limit                                                       |
| ------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Effective date of a provision/rule    | `effectiveDate` (`YYYY-MM-DD`, single value)                  | `LegalSource`; validated `INVALID_EFFECTIVE_DATE` | One date per record; no `effectiveTo`, no amendment list    |
| Corpus-level version note             | `versionPolicy.{effectiveDatePolicy, asOf, note, supersedes}` | manifest                                          | `supersedes` is a free-text identifier, not a resolved link |
| When the record was reviewed          | `verificationDate` (`YYYY-MM-DD`)                             | `LegalSource`; `VERIFIED_WITHOUT_DATE`            | Per record only                                             |
| Which publication version was checked | `provenance` free text                                        | `LegalSource`; required                           | Human-written; not machine-comparable                       |
| Allowlist freshness                   | `allowlistPolicy.{maintainedBy, lastReviewed, policyNote}`    | manifest                                          | Manual; warning-only                                        |

**There is no formal versioning policy yet.** `versionPolicy` is an attestation block whose fields are
free text plus one date; the validator only checks shape (`NO_VERSION_POLICY` warning on an approved
corpus). Do not treat any value shipped today as an agreed policy.

### 1.3 Amendment tracking — target model (proposed, not implemented)

Recommended model, to be adopted only when a legal content owner signs off on the policy (D-011):

1. **Immutable versions.** A verified record is never edited in place. A change creates a new record
   version with its own `versionId`, leaving the prior version intact and marked superseded.
2. **Interval, not a point.** Each version carries `effectiveFrom` and `effectiveTo` (or
   `supersededBy`), so a query can resolve "the law as of date X" instead of reading the latest row.
3. **Amendment provenance.** Each version records `amendmentSource` (amending Act/notification/judgment
   identifier + official URL), `retrievedAt` and a `changeSummary` written by the reviewer.
4. **Exact-text integrity.** Store a `checksum` (e.g. SHA-256) of the exact reviewed text and the
   `publicationEdition`/`asOfDate` it was copied from, so drift is detectable.
5. **Current-view resolution.** "Current" is computed from the intervals at read time; no record is
   overwritten, so a historical citation stays reproducible.
6. **Re-review triggers.** Upstream amendment detected, upstream URL 404/redirect, or `nextReviewDue`
   elapsed → the record is flagged `stale` and loses citable authority until re-signed.

Until that exists, the honest position is: a record is verified **as of** the date in
`verificationDate`, and any later amendment is unverified by default. This is why `provenance` must
name the publication version and retrieval date.

---

## 2. Reviewer workflow (human verification before authority)

### 2.1 Roles

Defined in [`LEGAL_SOURCE_VERIFICATION.md`](./LEGAL_SOURCE_VERIFICATION.md) §3:

| Role                                 | Responsibility                                                                                                  | May sign off legal accuracy      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Ingest operator (engineering)        | Obtain text from an official source, record metadata, run validators, prepare the change                        | **No**                           |
| Legal content owner / named reviewer | Confirm exact text, citation, jurisdiction, effective date, version and rights against the official publication | **Yes** — the only role that may |
| Maintainer                           | Commit corpus + allowlist + sign-off log together; keep the allowlist limited to reviewed identifiers           | **No**                           |

The legal content owner is also the owner of D-005/D-011 and **is not yet assigned**. Until that changes,
no real-corpus record may be `verified`.

### 2.2 State machine

```text
intake/unverified/  ──acquire + draft + validator exit 0──▶  intake/reviewed/
      │                                                             │
      │  status: blocked/draft                       human review of exact text,
      │  authority: none                             citation, jurisdiction,
      │                                              effective date, version, rights
      ▼                                                             ▼
manifest status: in-review ──sign-off + allowlist + validator exit 0──▶ approved
                                                                        │
                                                          staging: promoted (citable)
```

`staging.stage` is `unverified` → `reviewed` → `promoted` (`CORPUS_MANIFEST_STAGES`). The validator warns
on incoherent combinations: `STAGE_STATUS_MISMATCH` (`promoted` without `approved`),
`UNSTAGED_VERIFIED_SOURCES` (`unverified` stage holding verified records).

### 2.3 Gates a record must pass before it can be cited

1. **Structural** — required fields present (`validateSourceRecord`): `id`, `title`, `sourceName`,
   `citation`, `provenance`; `sourceType`/`jurisdiction`/`verificationStatus` in range.
2. **Provenance** — `validateSourceProvenance`: citation non-empty, provenance or official URL present;
   placeholders can never be verified; a specific-looking citation requires an official URL.
3. **Human attestation** — named reviewer (`verifiedBy`, rejecting `TBD`/`auto`/`AI`/`system`/`unknown`)
   and `verificationDate` in `YYYY-MM-DD`.
4. **Official URL** — required for real-world authority (`India` + `statute`/`judgment`/`rule`) or any
   specific-looking citation (`VERIFIED_WITHOUT_OFFICIAL_URL`).
5. **Allowlist** — a specific-looking citation (section/article number, `AIR <year>`, `<year> SCC/SCR/CLR`,
   `X v. Y`) must appear verbatim in `reviewedOfficialIdentifiers`, or the record is rejected
   (`UNREVIEWED_SPECIFIC_CITATION`). The allowlist is empty by default and is populated **only** by a
   human reviewer.
6. **Corpus-level** — `signoff.reviewer` + `signoff.date`, and `rights.status: "cleared"` with
   `basis` + `confirmedBy` for a gated corpus (`INCOMPLETE_SIGNOFF`, `NON_HUMAN_SIGNOFF_REVIEWER`,
   `RIGHTS_CLEARANCE_INCOMPLETE`).

Runtime enforcement of the same rule is `canCiteAsAuthoritative(source)` — `verified` **and** not
placeholder-labelled **and** provenance valid. It is deliberately independent of how the record was
loaded, so a forged `verified` flag cannot be trusted on its own.

### 2.4 What the validator cannot do

The validators prove **that the required metadata and attestations are present and well formed**. They
cannot confirm that a human actually read the text. This is stated explicitly in
`docs/legal-corpus/README.md` §1 and must remain in the review instructions: a green validator run is a
precondition for review, never a substitute for it.

### 2.5 Stop conditions

Do not start acquisition if any of these holds (from `ACQUISITION_CHECKLIST.md` §0): no assigned content
owner; versioning policy unresolved; rights not held; or the text would come from memory, an AI stub, a
search snippet, a wiki/blog, or another game's data. Leave the corpus `blocked` and the allowlist empty.

---

## 3. Source manifest schema recommendations

### 3.1 Implemented corpus-level schema (schemaVersion 1)

```jsonc
{
  "schemaVersion": 1, // required; only 1 supported
  "corpusId": "INTERNAL-ID", // required; never a legal citation
  "corpusKind": "internal-educational-summary | official-source-metadata",
  "authority": "non-authoritative | official-publication-metadata",
  "assertsRealCitation": false, // true only for official-source-metadata
  "disclaimer": "non-empty string",
  "status": "blocked | draft | in-review | approved",
  "owner": "named human | null",
  "intakeFolder": "intake/",
  "template": false, // truthy ⇒ MANIFEST_IS_TEMPLATE (hard reject)
  "provenanceNote": "corpus provenance summary",
  "acquisition": {
    "checklistCompleted": true,
    "reviewerAssigned": true,
    "officialSources": ["..."],
    "retrievalDate": "YYYY-MM-DD",
  },
  "signoff": { "reviewer": "human name", "date": "YYYY-MM-DD", "scope": "...", "notes": "..." },
  "rights": {
    "status": "none | pending | cleared",
    "basis": "...",
    "license": "...",
    "confirmedBy": "human",
    "confirmedDate": "YYYY-MM-DD",
  },
  "versionPolicy": {
    "effectiveDatePolicy": "...",
    "asOf": "YYYY-MM-DD",
    "note": "...",
    "supersedes": "prior corpus id",
  },
  "allowlistPolicy": { "maintainedBy": "human", "lastReviewed": "YYYY-MM-DD", "policyNote": "..." },
  "staging": {
    "stage": "unverified | reviewed | promoted",
    "unverifiedFolder": "intake/unverified/",
    "reviewedFolder": "intake/reviewed/",
    "importNote": "...",
  },
  "reviewedOfficialIdentifiers": [],
  "sources": [],
}
```

### 3.2 Implemented per-record schema

Required: `id`, `title`, `sourceName`, `citation`, `sourceType`, `jurisdiction`, `verificationStatus`,
`provenance`.
Conditional: `sourceUrl` (real authority / specific citation), `effectiveDate` (when the authority has
one), `verifiedBy` + `verificationDate` (verified only).
Optional: `excerpt`, `notes`, `intake` (`seed` | `player-draft`), and the honesty markers `category`,
`authority`, `assertsRealCitation`, `disclaimer`.

Field caps (`MAX_SOURCE_FIELDS`): title/sourceName 200, citation 300, provenance/sourceUrl/excerpt/notes
≤ 1000/500/1000/1000 characters. Over-cap values warn (`FIELD_TOO_LONG`) because the app truncates them.

### 3.3 Recommended additions (proposed — not implemented, no code changes implied)

Ordered by value. None of these may be added to runtime types without a separate approved change; the
schemaVersion bump and validator update are prerequisites.

| #   | Field                                                            | Level            | Why                                                                                                                                                                             |
| --- | ---------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `verificationScope`: `metadata \| text \| summary`               | record + corpus  | Today `verified` conflates "the publication exists" (metadata), "I read the exact text" and "I reviewed an internal summary". This is the single most important disambiguation. |
| 2   | `textStatus`: `metadata-only \| excerpt \| full-text`            | record           | Makes it machine-checkable that no provision text is stored unless explicitly intended.                                                                                         |
| 3   | `versionId`, `effectiveFrom`, `effectiveTo` / `supersededBy`     | record           | Enables point-in-time resolution and amendment chains (§1.3).                                                                                                                   |
| 4   | `publicationEdition`, `retrievedAt`, `checksum`                  | record           | Detects upstream drift and proves which artifact was reviewed.                                                                                                                  |
| 5   | `amendmentRefs[]` (`{ identifier, officialUrl, effectiveDate }`) | record           | Links an amendment to the version it produced.                                                                                                                                  |
| 6   | `reviewerId` (stable id, not just a display name)                | record + signoff | Free-text names cannot be tied to an accountable person or a two-person rule.                                                                                                   |
| 7   | `nextReviewDue`                                                  | record + corpus  | Turns "re-verify eventually" into a date the tooling can report.                                                                                                                |
| 8   | `license` + `rightsBasis` per record                             | record           | Rights are corpus-level today; a mixed corpus (public statute + licensed reporter) cannot be expressed.                                                                         |
| 9   | `language`, `court`/`bench`, `neutralCitation`, `provisionPath`  | record           | Needed for section-level retrieval and citation matching beyond regex.                                                                                                          |
| 10  | `stale` state (or `verificationStatus: "stale"`)                 | record           | A record whose source changed must lose authority automatically, not by human memory.                                                                                           |

### 3.4 Matching and normalization rules (implemented)

Allowlist matching normalizes by trim + lowercase + whitespace collapse
(`normalizeIdentifier`). It is a **string check**, not a legal-identity check: it cannot tell that two
different strings denote the same provision, and it never makes a citation real. Duplicate record `id`s
are rejected (`DUPLICATE_SOURCE_ID`); the first occurrence wins. A stale allowlist entry that matches no
source warns (`UNUSED_REVIEWED_IDENTIFIER`) so it cannot silently lend authority to a future record.

---

## 4. Boundaries (non-negotiable)

1. **No fabricated provisions, judgments or quotes.** Never write a section/article number, case name,
   reporter citation, effective date or official URL from memory, an AI stub, a search snippet or
   extrapolation. Copy exact text only from an official publication and record which publication and
   version it came from. This applies to docs, tests, seed data and UI copy alike; citation-shaped strings
   appear in tests only to prove they are rejected.
2. **Internal summaries are non-authoritative by construction.** Any `summary` or `excerpt` is teaching
   material, is labelled as such wherever shown, and can never be promoted to a verified statutory or
   judgment citation. `internal-educational-summary` corpora are structurally barred from holding
   `statute`/`judgment`/`rule` records or specific-looking citations
   (`EDUCATIONAL_CORPUS_NON_SUMMARY`, `EDUCATIONAL_CORPUS_SPECIFIC_CITATION`,
   `EDUCATIONAL_CORPUS_WITH_ALLOWLIST`).
3. **Official metadata is not official text.** `official-source-metadata` records assert that a
   publication exists at an official URL; they do not reproduce or vouch for its content. Excerpts are
   capped at 240 characters and treated as metadata notes.
4. **Production RAG only after a verified corpus.** Retrieval today is `RAG-lite`: keyword overlap over
   approved **internal summaries** only, ≤ 2 sources, ≤ 600-character excerpts, every block prefixed
   `NON-AUTHORITATIVE`. `isApprovedInternalSummary` requires `intake === 'seed'`,
   `verificationStatus === 'verified'`, `sourceType === 'summary'` and no canonical-truth markers. Any
   embedding index, vector store or provider-backed retrieval over real law is gated on the corpus being
   text-verified and the policy agreed (D-005/D-011) — not on engineering convenience.
5. **`verified` ≠ legal advice.** The product is an educational simulation. Verified status means a named
   human checked provenance and text against an official publication; it does not mean the material is
   applicable to a player's situation, current, or a substitute for qualified advice.
6. **No self-verification.** The game never infers that a drafted source is real law: `intakeSource`
   rejects `requestedStatus: "verified"`, specific-looking citations are downgraded to `placeholder`, and
   verification is only reachable through `markSourceVerified` with a named human and a strict record
   validation pass.
7. **No runtime ingestion.** The app never reads `docs/legal-corpus/`; those files are a human workflow
   artifact. Corpus promotion to the runtime seed is a deliberate, reviewed commit, not a build step.

---

## 5. Current implemented state vs deferred

### 5.1 Implemented (verified in repo, 2026-11-23)

| Capability                  | Evidence                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provenance model + statuses | `LegalSource`, `SourceVerificationStatus` in `src/domain/types.ts`                                                                                                                                        |
| Runtime citation gate       | `canCiteAsAuthoritative`, `validateSourceProvenance` (`src/domain/legalSources.ts`); `checkDraftCitations` (`src/domain/guards.ts`) applied in `submitDraftForFeedback` (`src/domain/draftSubmission.ts`) |
| Non-auto-verifying intake   | `intakeSource` (rejects `verified`; downgrades specific-looking citations to `placeholder`)                                                                                                               |
| Human verification step     | `markSourceVerified` (named reviewer + ISO date + strict `validateSourceRecord`)                                                                                                                          |
| Deterministic validators    | `validateSourceRecord`, `validateSourceRecords`, `validateCorpusManifest` (`src/domain/sourceValidation.ts`)                                                                                              |
| CLIs                        | `npm run validate:sources`, `npm run validate:legal-corpus` (`scripts/validate-sources.ts`, `scripts/validate-legal-corpus.ts`); exit 0/1/2                                                               |
| Template rejection          | `manifest.template.json` → `MANIFEST_IS_TEMPLATE` by design                                                                                                                                               |
| Internal educational corpus | `docs/legal-corpus/manifest.json`: 4 original summaries, `status: draft`, validator **exit 0**, 1 warning (`ACQUISITION_CHECKLIST_INCOMPLETE`)                                                            |
| Official metadata corpus    | `docs/legal-corpus/official-sources.manifest.json`: 6 metadata records (4 Acts/Constitution + 2 Supreme Court neutral citations), `status: in-review`, validator **exit 0**, 0 warnings                   |
| In-app registry             | `src/domain/seed.ts`: 7 `verified` seed records (6 official metadata + 1 internal summary `ls-4`), all `intake: 'seed'`                                                                                   |
| Retrieval gate              | `isApprovedInternalSummary` + `retrieveApprovedInternalSummaries` (`src/domain/ai/retrieval.ts`) — only `ls-4` is currently retrievable                                                                   |
| Tests                       | `legalSources`, `sourceValidation`, `legalCorpusManifest`, `guards`, `draftSubmission`, `ai_retrieval` suites in `src/tests/`                                                                             |

### 5.2 Deferred / absent

| Gap                                                              | Consequence                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| No real provision, judgment or procedural-rule **text** ingested | Corpus is metadata + internal summaries only; no section-level citation exists        |
| No assigned legal content owner                                  | D-005/D-011 remain `Unknown`; no real record can be `verified`                        |
| No formal versioning/effective-date policy                       | `versionPolicy` is free text; no point-in-time resolution                             |
| No amendment tracking                                            | Single `effectiveDate`; no `effectiveTo`, amendment list, checksum or staleness state |
| No per-record version history                                    | Verified records would be edited in place; citations are not reproducible             |
| No reviewer identity system                                      | Names are free-text; no auth, roles, signatures or two-person rule                    |
| No rights enforcement in code                                    | `rights` is attestation only; no license field per record                             |
| No stale-record detection                                        | Upstream amendment/404 is caught only by human re-reading                             |
| No corpus persistence/ingestion pipeline                         | Corpus files are never read at runtime; promotion is a manual seed commit             |
| No production RAG                                                | No embeddings, vector store or provider-backed retrieval; keyword overlap only        |
| No automated re-review scheduling                                | `allowlistPolicy.lastReviewed` is the only recency signal                             |

### 5.3 Known limits of the implemented gate (accepted, documented)

- The validator checks attestation **shape**, not truth; a determined operator could assert a false
  review. Mitigation is process (named owner, sign-off log, code review of corpus commits), not code.
- Allowlist matching is normalized string equality and cannot resolve citation aliases.
- Regex citation detection (`SPECIFIC_CITATION_PATTERNS`) is heuristic: it can miss unusual citation
  forms and can flag innocuous text. It is a guardrail, not a citation parser.
- Seed records are compiled into the client bundle. Acceptable for metadata and original summaries;
  **not** acceptable for licensed third-party text until a server-side corpus exists.

---

## 6. Recommended next actions (in order)

1. **Decide D-011 policy** (owner: legal content owner + architect): adopt §1.3 amendment/versioning
   model, `verificationScope`, and a re-review interval. This is the blocker for everything else.
2. **Assign the legal content owner** (D-005) and record the name in `DECISIONS.md` and the sign-off log.
3. **Ingest one minimal, text-verified provision** end-to-end through the existing pipeline as a pilot:
   exact official text, official `sourceUrl`, allowlisted exact citation, `verifiedBy`/`verificationDate`,
   sign-off row in the log, validator exit 0. (The explicit `verificationScope: text` marker is part of the
   §3.3 proposal and does not exist yet.) Do not widen scope until that pilot is signed.
4. **Only then** consider schema v2 with the §3.3 fields, a validator update and a migration of the two
   shipped manifests.
5. **Keep production RAG blocked** until at least one real, text-verified corpus exists and D-011 is
   approved; the current retrieval gate should not be relaxed in the meantime.

---

_Documentation only. No runtime code, schema or validator behaviour is changed by this document._

## 5.4 Knowledge Graph and Interdisciplinary Learning (Phase 8)

### 5.4.1 Connection Establishment (player actions, not AI)

Knowledge connections are established exclusively through player-driven actions within the game's deterministic systems. The flow is:

1. **Discovery**: When a player discovers or reviews evidence, the game may prompt the player to record an interdisciplinary link if the evidence type suggests a connection to a non-legal domain. This is a manual player choice — the system never auto-generates or infers connections.

2. **Notebook entry**: The player creates a notebook entry (kind: `research`, `theory`, `note`, etc.) that includes `knowledgeGraphIds?: string[]`. These IDs reference entries in the knowledge graph. The `InterdisciplinaryNotebookEntry` type extends `NotebookEntry` with a required `connection: KnowledgeConnection` field, establishing the explicit link between the notebook note and its interdisciplinary connection.

3. **Assignment integration**: Assignments may have `requiredNotebookKinds` that include interdisciplinary notes. When a player submits an assignment for review, the system checks that required `knowledgeGraphIds` are present on relevant notebook entries. The `reviewAssignment` function in `src/domain/progression.ts` verifies `requiredSourceIds` and `requiredNotebookKinds` — `knowledgeGraphIds` are checked similarly as part of the assignment completion gate.

4. **Review**: During senior review, the feedback may reference or validate the interdisciplinary connections. The review is deterministic — it checks that the `KnowledgeConnection` fields are properly populated with valid `KnowledgeDomain` values and `strength` assessments, all written by the player.

### 5.4.2 `knowledgeGraphIds` Flow Through the System

```
discovery → notebook entry (with knowledgeGraphIds) → assignment requirement → review validation
```

- **Discovery**: When evidence is discovered/reviewed, `knowledgeGraphIds` may be populated on the resulting notebook entry via player action.
- **Notebook**: `NotebookEntry` has `knowledgeGraphIds?: string[]` (line 200, `src/domain/types.ts`). `InterdisciplinaryNotebookEntry` adds `connection: KnowledgeConnection` (line 237-239).
- **Assignment**: Assignment completion gates check that required notebook kinds and their `knowledgeGraphIds` are present. The `missingA2Requirements` function (`src/domain/draftSubmission.ts`) and `reviewAssignment` (`src/domain/progression.ts`) both follow the same pattern of checking required notebook fields.
- **Review**: Senior review feedback references the connections; the review result is recorded as a notebook entry of kind `feedback`.

The `knowledgeGraphIds` array is **preserved** through save round-trips via the `hydrateSave` → `trimNotebook` pipeline in `src/storage/save.ts`. Legacy saves (v1, v2) without the field default to `undefined` (treated as empty array behavior), and new saves include the field. The `capNotebook` function in `src/domain/notebook.ts` trims the notebook array to `MAX_NOTEBOOK_ENTRIES` (300), which also trims `knowledgeGraphIds` arrays in-situ.

### 5.4.3 UI Hints for Interdisciplinary Links

- **Notebook panel**: When a notebook entry has `knowledgeGraphIds` populated, the UI displays a "Interdisciplinary links" badge or chip group showing the `KnowledgeDomain` chips (forensic, medical, psychology, economics, accounting, cybersecurity, history, philosophy, sociology, technology). Clicking a chip could filter or highlight related entries.
- **Assignment panels**: When an assignment has `requiredNotebookKinds` that include interdisciplinary knowledge, the assignment UI shows a visual indicator that the player must produce an interdisciplinary-linked note before the assignment can be reviewed.
- **Research panel**: Source entries in the research panel may show a "Connect to discipline" affordance that, when clicked, opens a modal letting the player select a `KnowledgeDomain` and write a `relatedConcept` summary, creating a `KnowledgeConnection` record.
- **Knowledge domain chips**: Throughout the UI, `KnowledgeDomain` values render as tagged chips with domain-specific colors/icons, making interdisciplinary links visible at a glance.

### 5.4.4 Save Migration Path

The `knowledgeGraphIds` field is additive and backward-compatible:

- **Legacy saves** (v1, v2 without the field): When `hydrateSave` runs, `save.notebook[i].knowledgeGraphIds` is `undefined`. The `trimNotebook` function and notebook capping logic treat `undefined` the same as an empty array. No migration script is required — the field simply resolves to `[]` (empty) for old saves.
- **New saves**: `knowledgeGraphIds` is included when notebook entries are created via `addNotebookEntry`. The field is persisted in localStorage as part of the JSON save game.
- **Migration strategy**: If a future need arises to populate `knowledgeGraphIds` for existing saves, a one-time migration can be run via `npm run db:server` or a CLI script that iterates `save.notebook`, reads any stored interdisciplinary data, and sets `knowledgeGraphIds` based on the existing `KnowledgeConnection` records. Because the field is optional and the system treats its absence as "no interdisciplinary links," no data is lost and no existing entries are broken.
- **Deterministic derivers**: Any function that reads `knowledgeGraphIds` must handle `undefined` / missing field gracefully (e.g., `save.notebook[n]?.knowledgeGraphIds ?? []`). This is already the pattern used throughout the codebase for optional fields.

### 5.4.5 Deterministic Derivation Rules (no AI generation)

All knowledge graph behavior is deterministic and player-driven. The following rules are **never** AI-generated:

- **No auto-inference**: The system never infers or generates `KnowledgeConnection` records from evidence text, case facts, or player behavior. A player must explicitly create a notebook entry with a `connection: KnowledgeConnection` field.
- **Player-written descriptions**: The `description` field of `KnowledgeConnection` is always player-written. It is a `string` summarizing the connection — the game never populates it from domain models or external lookups.
- **Player-assigned strength**: The `strength: 'weak' | 'moderate' | 'strong'` field is player-assessed. The UI may provide hints, but the assignment is always a player choice.
- **Domain from predefined set**: The `domain: KnowledgeDomain` field must be one of the 10 predefined domains. The UI presents these as selectable chips; the game does not suggest or auto-complete domains.
- **ID references**: `knowledgeGraphIds?: string[]` contains IDs that the player or system has previously recorded. The game never generates new IDs; it only references existing ones.
- **Validation is structural**: Validators check that `KnowledgeConnection` fields have the correct shape (id, legalTopic, domain, relatedConcept, description, strength) but do not validate the semantic content of the connection. This is a player-quality gate, not a truth gate.
- **Save serialization**: When serializing/deserializing saves, `knowledgeGraphIds` is treated as a plain string array. No AI or domain logic is run during save load — the data is passed through deterministically.
