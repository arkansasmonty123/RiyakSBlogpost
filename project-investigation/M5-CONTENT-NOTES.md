# M5 Wave A — Content Notes (Perspective Engine)

> Task `M5-CONTENT`. Additive, teaching-only content. No canonical truth, no
> hidden material, no answer to any case, no verdict/progression coupling.
> See `project-management/M5-SOURCE-NOTES.md` for the bibliographic inputs and
> `M5-FOUNDATION-NOTES.md` for the migration-009 contract.

## What changed

| File | Change |
|---|---|
| `src/perspectives/frameworks.ts` | Replaced the 7 foundation lenses with the 7 specified lens keys/domains. Each has 5 core questions, 8 key concepts, a substantive method, 4 limitations, 4 misconceptions, 3 internal differences and relevant disciplines. |
| `src/perspectives/types.ts` | Added optional `verificationNotes` to `PerspectiveSource` so provenance notes survive the DTO projection (DTO reads `verificationNotes`/`verification_notes`). |
| `src/perspectives/experiences/source-helpers.ts` | New conservative `bibliographicSource()` helper: `pending_review`, `sourceVerified: false`, `url: null`, no quote by default. |
| `src/perspectives/experiences/*.ts` (12 files) | 12 authored `ExperienceDefinition` modules, ~3.4–4.0k chars of `detailedExplanation` each, 3 substantive sections each. |
| `src/perspectives/experiences/index.ts` | Registers and exports all 12 experiences and their keys. |
| `src/perspectives/registry.ts` | Exports `listPerspectiveCategories` and `curatedOpeningQuestions` for the API/UI waves. |
| `src/perspectives/case-bridges.ts` | Remapped to the 7 new lens keys; genre bridges now match the case genres actually in the database plus generic mystery/crime/detective/historical/philosophical; showcase-case bridges kept title-only and fact-free. |
| `src/perspectives/discovery.ts` | Added `listPerspectiveCategories()` and `curatedOpeningQuestions()` — a curated browsable library derived from authored framework questions, explicitly not a short-form feed. |
| `src/perspectives/recommendations.ts` | Reason-code basis text rewritten as generic advisory language; recommender remains pure, non-mutating and canonical-free. |
| `src/perspectives/specialist-context.ts` | Added explicit epistemic labels (established / interpretation / contested / tradition perspective / personal perspective), bounded to 3 breakdown entries per experience. |
| `scripts/seed-perspectives.ts` | Retires (never deletes) superseded framework rows before upserting; now fails loudly if fewer than 12 experiences are registered. Still idempotent. |
| `scripts/validate-perspectives.ts` | Hard-fails below 12 experiences by default (env override), validates unique keys/titles/purposes, 1500-char explanations, 3 sections, question punctuation, tradition scope, epistemic breakdown, provenance notes, framework coverage, format diversity and resolution of related keys and published case titles. Still read-only (SELECT only). |

## Framework mapping (7 keys, fixed by spec)

1. `scientific_reasoning` — Scientific reasoning
2. `psychological_reasoning` — Psychological reasoning
3. `philosophical_reasoning` — Philosophical reasoning
4. `historical_interpretation` — Historical interpretation
5. `ethical_reasoning` — Ethical reasoning
6. `sociological_reasoning` — Sociological reasoning
7. `religious_spiritual_traditions` — Religious and spiritual traditions

Note: the foundation's `skeptical_inquiry`, `legal_reasoning`, `cognitive_psychology`,
`philosophical_ethics` and `systems_thinking` lenses were superseded. The seed
marks those rows `retired` rather than deleting them, preserving any reflection
provenance while the public API lists only the 7 published lenses.

## 12-experience inventory

| # | Key | Framework | Format | Knowledge class | Distinct intellectual purpose |
|---|---|---|---|---|---|
| 1 | `platos-allegory-of-the-cave` | philosophical_reasoning | philosophical_parable | philosophical | Examine what would justify revising one's picture of things and how standpoint limits evidence. |
| 2 | `ship-of-theseus` | philosophical_reasoning | thought_experiment | philosophical | Expose the criteria hidden in a claim that something persists as "the same" over time. |
| 3 | `problem-of-induction` | scientific_reasoning | scientific_controversy | contested_scientific | Separate the practical success of an inference from the justification offered for it. |
| 4 | `confirmation-bias` | psychological_reasoning | psychological_demonstration | established_scientific | Turn a bias label into concrete search/interpretation/retention checks. |
| 5 | `the-trolley-problem` | ethical_reasoning | ethical_dilemma | philosophical | Make conflicting moral principles visible and require reasons rather than preferences. |
| 6 | `blind-men-and-the-elephant` | religious_spiritual_traditions | philosophical_parable | religious_spiritual | Compare how Buddhist/Jain/Hindu retellings differ and why partial accuracy is not relativism. |
| 7 | `stoic-dichotomy-of-control` | philosophical_reasoning | spiritual_teaching | philosophical | Locate what is genuinely within one's governance without conflating it with indifference. |
| 8 | `dependent-origination` | religious_spiritual_traditions | spiritual_teaching | religious_spiritual | Compare Theravada/Mahayana/Tibetan/Zen readings of conditioned arising. |
| 9 | `scientific-method-and-falsifiability` | scientific_reasoning | competing_arguments | contested_scientific | Compare demarcation accounts including underdetermination and Kuhnian history. |
| 10 | `historical-source-reliability` | historical_interpretation | historical_episode | historical | Classify a source by provenance, genre and purpose; distinguish record from inference. |
| 11 | `moral-responsibility` | ethical_reasoning | competing_arguments | philosophical | Distinguish causal, legal and moral responsibility and examine moral luck. |
| 12 | `collective-memory` | sociological_reasoning | historical_episode | contested_scientific | Ask how institutions select and transmit a group's account of the past. |

Mapping notes for the two cross-lens entries:
- Stoicism is authored under `philosophical_reasoning` (Hellenistic philosophical
  school) with `format: spiritual_teaching`, `knowledgeClass: philosophical`,
  and cross-links to `dependent-origination`, `blind-men-and-the-elephant` and
  `the-trolley-problem`. Its `traditionScope` names the religious/spiritual lens
  explicitly rather than misclassifying Stoicism as a religion.
- The problem of induction and scientific method are `contested_scientific`,
  not `established_scientific`, because the justification and demarcation
  disputes are live; the confirmation-bias entry is `established_scientific`
  with explicit context/replication caveats.

Format diversity: 8 of the 10 allowed formats are used (no `mistaken_assumption`
or `real_world_case`, which are reserved for future authored entries).

## Source / provenance policy applied

- Every real-world source is a bibliographic-style citation using
  `bibliographicSource()`: `verificationStatus: 'pending_review'`,
  `sourceVerified: false`, `url: null`, `quote: ''` (so <= 240 chars).
- `verificationNotes` states what is unverified (edition, translation, page or
  link). No URL, DOI, quotation, author or precise page was invented.
- Ancient/public-domain works (Plato, Plutarch, Aristotle, Epictetus, Marcus
  Aurelius, Hume, Pali canon, Nāgārjuna, Valla) are summarised, never quoted.
- Modern copyrighted works (Popper, Kuhn, Duhem, Wason, Nickerson, Foot,
  Thomson, Nagel, Howell/Prevenier, Halbwachs, Nora, Anderson) are summarised
  only; no excerpts.
- Jain/Hindu retellings are labelled as "specific source pending verification"
  rather than given a fabricated citation.
- `dto.ts` continues to withhold every URL unless `sourceVerified === true`
  and `verificationStatus === 'verified'`; the validator asserts both sides.
- Tradition differences are represented internally (Theravada/Mahayana/Tibetan/Zen,
  Buddhist/Jain/Hindu, early/middle/late Stoa, Popperian/Bayesian/Kuhnian) and
  devotional or metaphysical claims are labelled as tradition perspectives, not
  empirical findings.
- `epistemicBreakdown` on each experience labels established knowledge,
  interpretations, contested arguments, tradition/personal perspectives and
  bounded investigation use.

## Verification (executed in `project-investigation/`)

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run db:seed:perspectives` | PASS — 7 published frameworks, 12 experiences; 6 superseded framework rows retired |
| `npm run perspectives:validate` | PASS — no failures, no warnings |
| `npm run test:smoke` | PASS (`smoke-db: ok`) |
| `npm run test:http` | PASS — 102 passed, 0 failed (with `AUTH_RATE_MAX=5000`; see note) |
| `npm run build --prefix frontend` | PASS |

Note on the HTTP run: the default auth budget is 500 registrations per 15
minutes. While two agents were running the HTTP suite concurrently the shared
budget was exhausted and some registrations returned 429, so the run was
repeated with the environment-only override `AUTH_RATE_MAX=5000`. The final
run was 102/102 with no failures. This is a harness/environment constraint, not
a content regression; no source file outside the assigned scope was changed.

## Risks / TODOs for later waves

- **API wave (in progress by another builder):** should import only from
  `src/perspectives/registry.ts` and the migration-009 DB functions; suggestions
  must remain advisory and must never write verdict, progression or evidence
  state. The new `curatedOpeningQuestions()` / `listPerspectiveCategories()`
  exports are available for the discovery payload.
- **UI wave:** render summary vs detail DTOs; show the `verificationNotes` and
  "pending_review" badge for sources, never a URL for an unverified source;
  reflect the epistemic labels rather than presenting a lens as a finding.
- **Source verification:** all references remain `pending_review`. A human
  researcher should verify editions, page numbers and URLs before any source
  is promoted to `verified`.
- **Content follow-up:** formats `mistaken_assumption` and `real_world_case`
  are unused; more experiences can be added by dropping a file into
  `experiences/` and registering it in `experiences/index.ts`.
- **Out of scope / pre-existing:** `scripts/ci-schema.sql` and
  `migrations/000_baseline.sql` have a legacy FK ordering issue on a completely
  empty database (flagged in `M5-FOUNDATION-NOTES.md`); not introduced or
  modified here.
