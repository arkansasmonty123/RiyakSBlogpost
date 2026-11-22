-- =============================================================================
-- PROD-007 canonical seed: "The Midnight Heist"
-- =============================================================================
-- Idempotent and additive. Preserves the case id used by smoke tests:
--   fba51632-6d0d-4736-8200-2fd6df5ba1cc
-- Existing character/evidence rows are UPDATEd in place (their ids stay stable);
-- new rows are INSERTed only when a row with the same key is absent.
--
-- Apply after migrations/001_prod007_canonical_truth.sql:
--   psql -d investigation -f migrations/001_prod007_canonical_truth.sql
--   psql -d investigation -f seed.sql
--
-- SECURITY: knowledge/beliefs/secrets (characters) and hidden_interpretation /
-- discovery_conditions / release_conditions / supported_hypotheses /
-- contradicted_hypotheses (evidence) are SERVER-ONLY. The API projections in
-- db.ts (toSafeEvidence) and server.ts (toPublicCharacter) never return them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Case metadata (briefing, objectives, library fields)
-- ---------------------------------------------------------------------------
UPDATE cases SET
  title       = 'The Midnight Heist',
  description = 'A priceless diamond vanishes from a museum gala during a twelve-minute blackout. Five suspects, one hidden passage, and a solution hidden in plain sight.',
  genre       = 'Heist',
  difficulty  = 'Standard',
  duration    = '4-7 days',
  publication_status = 'published',
  briefing    = 'The Star of the North, a 40-carat diamond on loan to the Grand Museum, disappeared from its case during the annual gala on the night of 15 November 2024. At 00:10 the motion sensors went dark for exactly twelve minutes. At 00:20 security guard Mills was found unconscious in the east wing. The diamond is still missing, and everyone who could have taken it has an alibi. Review the initial evidence, question the people involved, and reconstruct what really happened between 00:00 and 00:22.',
  objectives  = '["Reconstruct the twelve-minute blackout window","Explain the guard attack and why it happened","Identify who had access to the North Wing","Eliminate the competing inside-job theories","Name the culprit and explain how the diamond was removed"]',
  initial_facts = '["The alarm sensors were offline from 00:10 to 00:22","Guard Mills was found unconscious in the east wing at 00:20","Five people remain under investigation"]',
  case_version = '1.1',
  updated_at   = NOW()
WHERE id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc';

-- ---------------------------------------------------------------------------
-- 2. Canonical truth (SERVER-ONLY - never exposed by an API route in PROD-007)
-- ---------------------------------------------------------------------------
UPDATE canonical_truth SET
  culprit = 'Victor Sterling',
  motive  = 'Victor Sterling was quietly insolvent and stood to collect a 20 million dollar insurance payout through his shell company Sterling Holdings LLC, which held the policy on the Star of the North. The theft was a calculated insurance fraud, timed to a maintenance window he himself had arranged.',
  method  = 'Victor slipped away from the gala at 00:08 using a duplicate North Wing keycard (badge #0042) obtained from his sister Martha. He timed the theft to the hidden 12-minute sensor maintenance window (00:10-00:22), disabled the motion sensors with a compact laser cutter, lifted the diamond at 00:14, and escaped through a concealed service passage into the adjacent building he owns. He stunned guard Mills to draw attention to the east wing, planted a lifted fingerprint of Martha on the case and a coat resembling Jasper''s near the corridor, and hid the diamond in the hollow base of a silver trophy in his office.',
  timeline = '[
    {"time":"2024-11-15 19:00","event":"Annual gala begins; Victor Sterling attends as lead sponsor."},
    {"time":"2024-11-15 22:00","event":"Martha Sterling leaves the director''s office after a documented meeting."},
    {"time":"2024-11-15 00:08","event":"Victor leaves the gala hall on the pretext of a phone call."},
    {"time":"2024-11-15 00:09","event":"Badge #0042 opens the North Wing exhibit door."},
    {"time":"2024-11-15 00:10","event":"Motion sensors enter their scheduled 12-minute maintenance window."},
    {"time":"2024-11-15 00:12","event":"Laser cutter disables the sensor housing beside the case."},
    {"time":"2024-11-15 00:14","event":"The Star of the North is lifted from its case; corridor camera records a figure with a cane."},
    {"time":"2024-11-15 00:15","event":"Dr. Rhodes sees the figure enter the service corridor."},
    {"time":"2024-11-15 00:18","event":"Guard Mills is struck from behind with a stun gun in the east wing."},
    {"time":"2024-11-15 00:20","event":"Mills is found unconscious; attention shifts to the east wing."},
    {"time":"2024-11-15 00:22","event":"Sensors come back online; Victor has already returned to the gala."}
  ]'::jsonb,
  hidden_events = '[
    {"event":"A concealed service passage behind the North Wing exhibit connects to the building adjacent to the museum, owned by Victor Sterling.","known_by":["Victor Sterling","Martha Sterling"]},
    {"event":"The nightly 12-minute sensor blackout is a scheduled maintenance window introduced by a security audit Victor secretly funded.","known_by":["Victor Sterling","Jasper Vale"]},
    {"event":"The diamond is hidden in the hollow base of a silver trophy in Victor''s office.","known_by":["Victor Sterling"]}
  ]'::jsonb,
  solution_explanation = 'Victor Sterling did not act on impulse. Months earlier he funded a "security review" that introduced a nightly twelve-minute maintenance gap in the museum''s motion sensors, and he quietly obtained a spare North Wing keycard from his sister Martha by claiming he needed to check the exhibit during the gala. By November he was close to bankruptcy; the policy on the Star of the North, held by his shell company Sterling Holdings LLC, would pay out twenty million dollars if the diamond were stolen. At 00:08 he left the gala, used the spare badge at 00:09, disabled the sensors during the 00:10 maintenance window with a laser cutter donated to the museum by his own company, and took the diamond at 00:14. He escaped through a passage known only to him and Martha into his adjacent building, then returned to the gala before the sensors came back at 00:22. The attack on guard Mills was a diversion to pull everyone toward the east wing, not a struggle over the diamond. Martha''s fingerprint was lifted from a glass she used during setup and pressed onto the wiped case; the dark coat left near the corridor was chosen to resemble one Jasper Vale owns. Both were deliberate misdirection. Dr. Rhodes did see someone, but initially reported the wrong direction and held back the sponsor badge detail out of fear of publicity; in a follow-up interview she corrected the record, and the cane silhouette in the corridor footage matches Victor. Reading the blackout, the keycard time, the tool, the witness correction, and the insurance policy together leaves exactly one culprit: Victor Sterling. The diamond is in the hollow base of a silver trophy in his office.',
  red_herrings = '[
    {"label":"Martha''s fingerprint on the case","apparent_meaning":"The curator handled the case at midnight.","actual_explanation":"The print was lifted from a glass Martha used during daytime setup and pressed onto the already-wiped case; residue proves it was applied after 00:10.","resolved_by":"fingerprint analysis + keycard access log"},
    {"label":"Jasper Vale''s dark coat and getaway car","apparent_meaning":"A known ex-thief with a car and a matching coat must be the intruder.","actual_explanation":"Jasper was at a charity gala with dozens of witnesses from 21:00 to 00:30; the coat was planted to resemble his, and he owns no laser cutter.","resolved_by":"alarm system log + laser cutter debris + confirmed alibi"},
    {"label":"Mills''s missing patrol and staged attack","apparent_meaning":"The guard staged his own assault or was bribed.","actual_explanation":"Mills was struck from behind with a stun gun while investigating a noise in the east wing; the attack was a diversion from the North Wing.","resolved_by":"night guard log + medical evidence"},
    {"label":"Daphne Chen''s access to the insurance policy","apparent_meaning":"The broker who stood to gain from a payout engineered the theft.","actual_explanation":"Daphne was reviewing Sterling Holdings for fraud and gained nothing; her memo predates the gala and names Victor as the beneficiary.","resolved_by":"insurance policy + Daphne''s fraud memo"}
  ]'::jsonb,
  alternative_theories = '[
    {
      "title":"The Curator''s Inside Job",
      "summary":"Martha Sterling stole the diamond herself, using her keycard access and knowledge of the alarm schedule, then framed Jasper Vale.",
      "why_plausible":"Badge #0042 was issued to Martha, her fingerprint was on the case, she knew the maintenance window and the secret passage, and her private security contract hints at debt.",
      "disproven_by":["fingerprint analysis","keycard access log","laser cutter debris","insurance policy"],
      "resolution":"The fingerprint was planted after the case was wiped, the badge was given to Victor, the cutter traces to Victor''s sponsor gift, and only Sterling Holdings profits from the theft."
    },
    {
      "title":"Jasper Vale Returns to Steal",
      "summary":"The ex-thief and security consultant slipped out of the gala, bypassed the alarm he knew intimately, and fled in his getaway car.",
      "why_plausible":"Jasper understands lock bypass and blind spots, owns a car, has a criminal past, and a dark coat matching the camera footage was found nearby.",
      "disproven_by":["night guard log","alarm system log","laser cutter debris","corrected witness statement"],
      "resolution":"Multiple witnesses place Jasper at the charity gala throughout the blackout, the tool is a model he does not own, and the witness badge reads Sterling."
    }
  ]'::jsonb,
  clue_resolutions = '{
    "security footage":"Figure walks toward the service corridor with a cane - Victor, not a fleeing Jasper.",
    "night guard log":"The blank 00:00 entry fixes the diversion attack before the theft.",
    "alarm system log":"A scheduled maintenance window, not a random glitch, requires insider knowledge.",
    "witness statement":"Rhodes saw the figure but misjudged direction and withheld the badge.",
    "fingerprint analysis":"Planted print; Martha handled the glass during setup, not the case at midnight.",
    "keycard access log":"Badge #0042 was lent to Victor by Martha.",
    "laser cutter debris":"Tool donated by Victor''s company; serial traces to his account.",
    "CCTV footage":"Limp and cane silhouette match Victor; passage leads to his building.",
    "insurance policy":"Sterling Holdings, Victor sole beneficiary - motive for insurance fraud.",
    "corrected witness statement":"Badge reads Sterling; identification confirmed."
  }'::jsonb,
  actual_timeline = '[
    {"seq":1,"time":"00:08","event":"Victor leaves the gala","evidence":["keycard access log"]},
    {"seq":2,"time":"00:09","event":"Badge #0042 opens North Wing door","evidence":["keycard access log"]},
    {"seq":3,"time":"00:10","event":"Sensors enter maintenance window","evidence":["alarm system log"]},
    {"seq":4,"time":"00:12","event":"Laser cutter disables sensor housing","evidence":["laser cutter debris"]},
    {"seq":5,"time":"00:14","event":"Diamond lifted from case","evidence":["security footage","fingerprint analysis"]},
    {"seq":6,"time":"00:15","event":"Figure enters service corridor","evidence":["CCTV footage","corrected witness statement"]},
    {"seq":7,"time":"00:18","event":"Mills stunned in east wing diversion","evidence":["night guard log"]},
    {"seq":8,"time":"00:22","event":"Sensors restore; Victor back at gala","evidence":["alarm system log"]}
  ]'::jsonb,
  updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc';

-- Safety net: if canonical truth was never seeded, create it with the enriched fields.
INSERT INTO canonical_truth (
  case_id, culprit, motive, method, timeline, hidden_events,
  solution_explanation, red_herrings, alternative_theories, clue_resolutions, actual_timeline
)
SELECT
  'fba51632-6d0d-4736-8200-2fd6df5ba1cc',
  'Victor Sterling', 'Insurance fraud during a sensor blackout',
  'Keycard entry, laser cutter, concealed service passage',
  '[]'::jsonb, '[]'::jsonb, '', '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM canonical_truth WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc'
);

-- ---------------------------------------------------------------------------
-- 3. Characters - three fully developed suspects + witness already existed;
--    enrich all four in place and add two more suspects (5 suspects + 1 witness)
-- ---------------------------------------------------------------------------
UPDATE characters SET
  personality = 'Charming and composed in public; quietly calculating and desperate behind the smile.',
  background  = 'Wealthy businessman and lead sponsor of the museum gala. Publicly a philanthropist, privately insolvent. His shell company Sterling Holdings LLC holds the insurance policy on the Star of the North.',
  knowledge   = '{"alarmMaintenanceWindow":true,"secretPassage":true,"duplicateKeycard":true,"insurancePolicyDetails":true,"laserCutterDisposal":true,"sawWitnessInCorridor":false,"knowsMillsCanIdentifyCane":false}'::jsonb,
  beliefs     = '{"noOneSawHimLeave":true,"fingerprintFramesMartha":true,"coatFramesJasper":true,"millsCannotIdentifyAttacker":true,"diamondSafeInTrophy":true}'::jsonb,
  secrets     = '{"bankruptcy":true,"shellCompanyFraud":true,"plantedFingerprint":true,"plantedCoat":true,"stoleDiamond":true,"diamondLocation":"hollow base of the silver trophy in his office"}'::jsonb,
  motive = 'Apparent: none - a generous sponsor. Hidden: a 20 million dollar insurance payout through Sterling Holdings LLC to escape insolvency.',
  dialogue_constraints = 'Never volunteers the maintenance window, the service passage, or the trophy. Deflects with philanthropy small talk. Becomes evasive when asked about 00:00-00:22 or the silver cane.',
  alibi = 'Claims he never left the gala and was speaking with donors at midnight.',
  confirmed_alibi = 'Unverified - no donor corroborates the 00:00-00:22 window.',
  relationships = '{"Martha Sterling":"sister","Daphne Chen":"business rival","Guard Mills":"attack victim"}'::jsonb,
  updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND name = 'Victor Sterling';

UPDATE characters SET
  personality = 'Cold, precise, and fiercely protective of her brother.',
  background  = 'Museum curator and diamond authentication expert. Issued the spare North Wing keycard to her brother Victor and knows the secret service passage, but does not know her lifted fingerprint was planted on the case.',
  knowledge   = '{"diamondAuthentication":true,"alarmSchedule":true,"keycardIssuance":true,"secretPassage":true,"gaveVictorDuplicateCard":true,"fingerprintWasLifted":false}'::jsonb,
  beliefs     = '{"victorIsInTrouble":true,"victorMayHaveActed":true,"jasperCouldBeInvolved":false,"fingerprintWillClearHer":false}'::jsonb,
  secrets     = '{"gaveVictorKeycard":true,"privateSecurityContract":true,"suspectsVictor":true,"debtFromGalaOverruns":true}'::jsonb,
  motive = 'Apparent: protecting the museum and her own reputation; debts from gala overruns and a private security contract give her a surface-level reason to want the diamond gone.',
  dialogue_constraints = 'Admits issuing a spare keycard but insists it was reported lost. Will not speculate about Victor unless the keycard log is put to her.',
  alibi = 'In the director''s office with two witnesses until 22:00, then in the gala hall.',
  confirmed_alibi = 'Confirmed by two staff members for 20:00-22:00; unobserved 22:00-00:30.',
  relationships = '{"Victor Sterling":"brother","Jasper Vale":"former colleague"}'::jsonb,
  updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND name = 'Martha Sterling';

UPDATE characters SET
  personality = 'Charismatic, bitter, and cooperative when it serves his own exoneration.',
  background  = 'Former thief turned security consultant, fired from the museum earlier that year. He understands alarm blind spots and the maintenance window, and owns a dark coat and getaway car that make him an easy scapegoat.',
  knowledge   = '{"lockBypassTechniques":true,"alarmBlindSpots":true,"maintenanceWindow":true,"getawayCar":true,"laserCutterOwned":false}'::jsonb,
  beliefs     = '{"beingFramed":true,"coatWasPlanted":true,"victorFundedAudit":true}'::jsonb,
  secrets     = '{"ownsGetawayCar":true,"firedFromMuseum":true,"wasAtGala":true,"criminalPast":true}'::jsonb,
  motive = 'Apparent: easy money and a score to settle after being fired from the museum; his debts and criminal past make him the obvious suspect.',
  dialogue_constraints = 'Freely explains the alarm maintenance window when asked (investigation trigger). Refuses to discuss the getaway car until the coat evidence is shown.',
  alibi = 'At the charity gala from 21:00 until 00:30, seen by dozens of attendees.',
  confirmed_alibi = 'Confirmed by multiple independent witnesses for 21:00-00:30.',
  relationships = '{"Grand Museum":"former consultant","Victor Sterling":"acquaintance"}'::jsonb,
  updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND name = 'Jasper Vale';

UPDATE characters SET
  role = 'witness',
  personality = 'Brilliant, precise about times, and absent-minded about everything else.',
  background  = 'Forensic anthropologist and gala attendee who was walking her dog near the west wing at 00:15. She saw a figure in a dark coat, initially described the direction wrongly, and held back a sponsor-badge detail out of fear of publicity.',
  knowledge   = '{"timelineEstimation":true,"evidenceAnalysis":true,"sawFigure":true,"noticedSponsorBadge":true,"initiallyMisjudgedDirection":true}'::jsonb,
  beliefs     = '{"figureWasLeavingWestWing":true,"figureWasJasper":false,"figureHadSponsorBadge":true}'::jsonb,
  secrets     = '{"withheldBadgeDetail":true,"fearedPublicity":true,"correctedStatementPending":true}'::jsonb,
  motive = 'None - witness. She withholds the badge detail only to avoid publicity.',
  dialogue_constraints = 'Gives exact times but withholds the badge until a follow-up interview (time trigger). Corrects her direction error when shown the corridor layout.',
  alibi = 'Walking her dog near the museum at 00:15.',
  confirmed_alibi = 'Dog-walk route camera places her near the west wing at 00:15.',
  relationships = '{}'::jsonb,
  updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND name = 'Dr. Elena Rhodes';

-- Two additional suspects: update in place if present (idempotent re-runs),
-- then insert only when missing.
UPDATE characters SET
  personality = 'Veteran guard, nervous and defensive about his gambling debts.',
  background  = 'Night security guard found unconscious in the east wing at 00:20. He glimpsed a figure with a silver cane near the North Wing at 00:09 before being struck from behind; his missing 00:00 patrol entry is a diversion, not complicity.',
  motive      = 'Apparent: gambling debts and the chance to fake an attack to cover a bribe; his blank patrol entry looks self-serving.',
  knowledge   = '{"patrolSchedule":true,"sawFigureWithCane":true,"keycardLogAccess":true,"attackerUsedStunGun":true,"sawAttackerFace":false}'::jsonb,
  beliefs     = '{"attackerWasInsider":true,"figureHadSilverCane":true,"stagedHisOwnAttack":false}'::jsonb,
  secrets     = '{"gamblingDebts":true,"wasStruckFromBehind":true,"acceptedBribe":false}'::jsonb,
  dialogue_constraints = 'Recounts a blurred figure with a silver cane at 00:09 and a stun-gun strike from behind. Cannot identify a face. Becomes defensive if gambling debts are raised.',
  alibi = 'On patrol; found unconscious in the east wing at 00:20.',
  confirmed_alibi = 'Unconscious and under medical care 00:20-02:00; attack corroborated by injury.',
  relationships = '{}'::jsonb,
  updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND name = 'Guard Mills';

UPDATE characters SET
  personality = 'Professional, guarded, and meticulous with paperwork.',
  background  = 'Museum insurance broker and business rival of Victor Sterling. She flagged the Sterling Holdings policy for fraud days before the gala and stood to gain nothing from the theft.',
  motive      = 'Apparent: as the broker she had access to the policy and might profit from a payout; in fact she was exposing Victor''s fraud.',
  knowledge   = '{"insurancePolicyDetails":true,"shellCompanyStructure":true,"fraudIndicators":true,"victorsDebt":true,"beneficiary":true}'::jsonb,
  beliefs     = '{"victorIsBehindTheft":true,"policyPayoutIsMotive":true}'::jsonb,
  secrets     = '{"investigatingSterlingHoldings":true,"stoodToGainNothing":true,"videoConferenceAlibi":true}'::jsonb,
  dialogue_constraints = 'Reveals the Sterling Holdings policy and her fraud investigation once the player raises motive (deduction trigger). Will not open client files without that prompt.',
  alibi = 'On a recorded video conference with three clients from 23:30 to 01:00.',
  confirmed_alibi = 'Conference recording and participant logs confirm 23:30-01:00.',
  relationships = '{"Victor Sterling":"business rival","Grand Museum":"insurance broker"}'::jsonb,
  updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND name = 'Daphne Chen';

INSERT INTO characters (
  case_id, name, role, personality, background, motive, knowledge, beliefs, secrets,
  dialogue_constraints, alibi, confirmed_alibi, relationships
)
SELECT 'fba51632-6d0d-4736-8200-2fd6df5ba1cc', 'Guard Mills', 'suspect',
  'Veteran guard, nervous and defensive about his gambling debts.',
  'Night security guard found unconscious in the east wing at 00:20. He glimpsed a figure with a silver cane near the North Wing at 00:09 before being struck from behind; his missing 00:00 patrol entry is a diversion, not complicity.',
  'Apparent: gambling debts and the chance to fake an attack to cover a bribe; his blank patrol entry looks self-serving.',
  '{"patrolSchedule":true,"sawFigureWithCane":true,"keycardLogAccess":true,"attackerUsedStunGun":true,"sawAttackerFace":false}'::jsonb,
  '{"attackerWasInsider":true,"figureHadSilverCane":true,"stagedHisOwnAttack":false}'::jsonb,
  '{"gamblingDebts":true,"wasStruckFromBehind":true,"acceptedBribe":false}'::jsonb,
  'Recounts a blurred figure with a silver cane at 00:09 and a stun-gun strike from behind. Cannot identify a face. Becomes defensive if gambling debts are raised.',
  'On patrol; found unconscious in the east wing at 00:20.',
  'Unconscious and under medical care 00:20-02:00; attack corroborated by injury.',
  '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM characters WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND name = 'Guard Mills'
);

INSERT INTO characters (
  case_id, name, role, personality, background, motive, knowledge, beliefs, secrets,
  dialogue_constraints, alibi, confirmed_alibi, relationships
)
SELECT 'fba51632-6d0d-4736-8200-2fd6df5ba1cc', 'Daphne Chen', 'suspect',
  'Professional, guarded, and meticulous with paperwork.',
  'Museum insurance broker and business rival of Victor Sterling. She flagged the Sterling Holdings policy for fraud days before the gala and stood to gain nothing from the theft.',
  'Apparent: as the broker she had access to the policy and might profit from a payout; in fact she was exposing Victor''s fraud.',
  '{"insurancePolicyDetails":true,"shellCompanyStructure":true,"fraudIndicators":true,"victorsDebt":true,"beneficiary":true}'::jsonb,
  '{"victorIsBehindTheft":true,"policyPayoutIsMotive":true}'::jsonb,
  '{"investigatingSterlingHoldings":true,"stoodToGainNothing":true,"videoConferenceAlibi":true}'::jsonb,
  'Reveals the Sterling Holdings policy and her fraud investigation once the player raises motive (deduction trigger). Will not open client files without that prompt.',
  'On a recorded video conference with three clients from 23:30 to 01:00.',
  'Conference recording and participant logs confirm 23:30-01:00.',
  '{"Victor Sterling":"business rival","Grand Museum":"insurance broker"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM characters WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND name = 'Daphne Chen'
);

-- ---------------------------------------------------------------------------
-- 4. Evidence - 10 items: 4 initially visible, 6 gated (player_visible = false)
-- ---------------------------------------------------------------------------
-- Existing rows are updated in place so their ids and any historical
-- discovered_evidence_ids references remain valid.

UPDATE evidence SET
  category = 'physical', source = 'security footage',
  description = 'Grainy corridor camera footage from 00:14 shows a tall figure in a dark coat crossing the North Wing vestibule toward the service corridor, one hand raised as if gripping a cane.',
  hidden_interpretation = 'The figure uses a silver cane. Only Victor Sterling among the principals uses one (old knee injury). The direction of travel - toward the concealed passage, not away from the exhibit - was misread by the first reviewer.',
  discovery_conditions = '{"type":"initial","description":"Available in the opening briefing."}'::jsonb,
  release_conditions = '{}'::jsonb,
  timeline_reference = '2024-11-15 00:14',
  reliability = 'medium',
  associated_characters = 'Victor Sterling, Dr. Elena Rhodes',
  supported_hypotheses = '["victor-at-scene","service-corridor-escape"]'::jsonb,
  contradicted_hypotheses = '["jasper-fled-west-wing"]'::jsonb,
  player_visible = true, discovery_order = 1, updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'security footage';

UPDATE evidence SET
  category = 'document', source = 'night guard log',
  description = 'The guard register shows Mills checked in at 20:00 with hourly patrols scheduled. Entries run to 23:00; the 00:00 entry is blank, and Mills was found unconscious at 00:20.',
  hidden_interpretation = 'The missing 00:00 entry brackets the attack at roughly 00:05-00:10, before the theft and before the alarm blackout. Mills was attacked as a diversion, not because he interrupted the thief.',
  discovery_conditions = '{"type":"initial","description":"Available in the opening briefing."}'::jsonb,
  release_conditions = '{}'::jsonb,
  timeline_reference = '2024-11-15 20:00 - 00:20',
  reliability = 'high',
  associated_characters = 'Guard Mills',
  supported_hypotheses = '["diversion-attack"]'::jsonb,
  contradicted_hypotheses = '["mills-staged-attack"]'::jsonb,
  player_visible = true, discovery_order = 2, updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'museum register';

UPDATE evidence SET
  category = 'digital', source = 'alarm system log',
  description = 'The alarm controller reports motion sensors offline from 00:10 to 00:22 - precisely twelve minutes. The controller labels it a "scheduled maintenance window," not a fault.',
  hidden_interpretation = 'The blackout is a known maintenance window documented in a security audit Victor Sterling secretly funded. Only someone with that knowledge could time the theft to the window.',
  discovery_conditions = '{"type":"initial","description":"Available in the opening briefing."}'::jsonb,
  release_conditions = '{}'::jsonb,
  timeline_reference = '2024-11-15 00:10 - 00:22',
  reliability = 'high',
  associated_characters = 'Jasper Vale, Victor Sterling',
  supported_hypotheses = '["insider-timing"]'::jsonb,
  contradicted_hypotheses = '["random-glitch"]'::jsonb,
  player_visible = true, discovery_order = 3, updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'alarm system log';

UPDATE evidence SET
  category = 'digital', source = 'CCTV footage',
  description = 'Low-light corridor camera catches a figure entering the service passage at 00:15, weighted on one side and moving with a pronounced limp.',
  hidden_interpretation = 'The limp and cane silhouette match Victor Sterling. The passage leads to the building adjacent to the museum, which Victor owns.',
  discovery_conditions = '{"type":"deduction","requires":["silver-cane-identified"],"description":"Release after the player links the cane clue to the corridor figure."}'::jsonb,
  release_conditions = '{"after":["witness statement"],"min_minutes":0}'::jsonb,
  timeline_reference = '2024-11-15 00:15',
  reliability = 'medium',
  associated_characters = 'Victor Sterling',
  supported_hypotheses = '["victor-escape-route"]'::jsonb,
  contradicted_hypotheses = '[]'::jsonb,
  player_visible = false, discovery_order = 8, updated_at = NOW()
WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'CCTV footage';

-- New evidence rows (idempotent by source).
INSERT INTO evidence (
  case_id, category, source, description, hidden_interpretation,
  discovery_conditions, release_conditions, timeline_reference, reliability,
  associated_characters, supported_hypotheses, contradicted_hypotheses,
  player_visible, discovery_order
)
SELECT 'fba51632-6d0d-4736-8200-2fd6df5ba1cc', 'witness_statement', 'witness statement',
  'Dr. Rhodes reports seeing a tall figure in a dark coat near the west wing at 00:15, initially described as leaving the building.',
  'Her direction was wrong: the figure was entering the service corridor. She also noticed a sponsor badge but withheld that detail until a follow-up interview.',
  '{"type":"initial","description":"Available in the opening briefing."}'::jsonb,
  '{}'::jsonb, '2024-11-15 00:15', 'medium', 'Dr. Elena Rhodes',
  '["suspect-at-west-wing"]'::jsonb, '[]'::jsonb, true, 4
WHERE NOT EXISTS (
  SELECT 1 FROM evidence WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'witness statement'
);

INSERT INTO evidence (
  case_id, category, source, description, hidden_interpretation,
  discovery_conditions, release_conditions, timeline_reference, reliability,
  associated_characters, supported_hypotheses, contradicted_hypotheses,
  player_visible, discovery_order
)
SELECT 'fba51632-6d0d-4736-8200-2fd6df5ba1cc', 'forensic', 'fingerprint analysis',
  'A partial print on the diamond case gives a weak match to museum staff - most closely to curator Martha Sterling.',
  'The print was planted: residue analysis shows it was lifted from a glass Martha handled during setup and pressed onto the already-wiped case. It cannot place Martha at the scene at midnight.',
  '{"type":"investigation_action","action":"examine_diamond_case","description":"Examine the display case after understanding the alarm log."}'::jsonb,
  '{"after":["alarm system log"],"min_minutes":0}'::jsonb,
  '2024-11-15 (print applied after 00:10)', 'low', 'Martha Sterling',
  '["martha-inside-job"]'::jsonb, '["martha-handled-glass-at-setup"]'::jsonb, false, 5
WHERE NOT EXISTS (
  SELECT 1 FROM evidence WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'fingerprint analysis'
);

INSERT INTO evidence (
  case_id, category, source, description, hidden_interpretation,
  discovery_conditions, release_conditions, timeline_reference, reliability,
  associated_characters, supported_hypotheses, contradicted_hypotheses,
  player_visible, discovery_order
)
SELECT 'fba51632-6d0d-4736-8200-2fd6df5ba1cc', 'digital', 'keycard access log',
  'Door controller logs show North Wing badge #0042 opening the exhibit door at 00:09. The badge was issued to Martha Sterling and reported lost on 2024-11-10.',
  'Martha gave the spare badge to Victor Sterling, who used it nine minutes before the blackout. The "lost" report was filed at Victor''s suggestion.',
  '{"type":"deduction","requires":["alarm-window-identified"],"description":"Release once the player connects the entry time to the maintenance window."}'::jsonb,
  '{"after":["alarm system log"],"min_minutes":30}'::jsonb,
  '2024-11-15 00:09', 'high', 'Martha Sterling, Victor Sterling',
  '["insider-access","victor-entered"]'::jsonb, '["martha-solo-entry"]'::jsonb, false, 6
WHERE NOT EXISTS (
  SELECT 1 FROM evidence WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'keycard access log'
);

INSERT INTO evidence (
  case_id, category, source, description, hidden_interpretation,
  discovery_conditions, release_conditions, timeline_reference, reliability,
  associated_characters, supported_hypotheses, contradicted_hypotheses,
  player_visible, discovery_order
)
SELECT 'fba51632-6d0d-4736-8200-2fd6df5ba1cc', 'physical', 'laser cutter debris',
  'Fine polymer fibers and a scorch mark recovered beside the case match a compact laser cutter used to disable the sensor housing.',
  'The cutter model was donated to the museum conservation lab by Victor Sterling as a sponsor gift; the serial range traces to his account. Jasper knows the technique but owns no such tool.',
  '{"type":"investigation_action","action":"examine_case_debris"}'::jsonb,
  '{"after":["alarm system log"],"min_minutes":0}'::jsonb,
  '2024-11-15 00:12', 'high', 'Victor Sterling, Jasper Vale',
  '["victor-tool"]'::jsonb, '["jasper-tool"]'::jsonb, false, 7
WHERE NOT EXISTS (
  SELECT 1 FROM evidence WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'laser cutter debris'
);

INSERT INTO evidence (
  case_id, category, source, description, hidden_interpretation,
  discovery_conditions, release_conditions, timeline_reference, reliability,
  associated_characters, supported_hypotheses, contradicted_hypotheses,
  player_visible, discovery_order
)
SELECT 'fba51632-6d0d-4736-8200-2fd6df5ba1cc', 'document', 'insurance policy',
  'The Star of the North is insured for 20 million dollars under a policy held by Sterling Holdings LLC, with Victor Sterling as sole beneficiary. The payout doubles in the event of theft.',
  'Victor was bankrupt and stood to collect the payout - the motive. Daphne Chen flagged the policy as fraudulent days before the gala but was ignored.',
  '{"type":"deduction","requires":["motive-question-raised"],"description":"Release when the player questions Daphne about motive or finances."}'::jsonb,
  '{"after":["corrected witness statement"],"min_minutes":0}'::jsonb,
  '2024-11-01 (policy issued)', 'high', 'Victor Sterling, Daphne Chen',
  '["insurance-fraud-motive"]'::jsonb, '["no-motive"]'::jsonb, false, 9
WHERE NOT EXISTS (
  SELECT 1 FROM evidence WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'insurance policy'
);

INSERT INTO evidence (
  case_id, category, source, description, hidden_interpretation,
  discovery_conditions, release_conditions, timeline_reference, reliability,
  associated_characters, supported_hypotheses, contradicted_hypotheses,
  player_visible, discovery_order
)
SELECT 'fba51632-6d0d-4736-8200-2fd6df5ba1cc', 'witness_statement', 'corrected witness statement',
  'In a follow-up interview, Dr. Rhodes corrects herself: the figure was entering the service corridor, not leaving, and wore a gala sponsor badge bearing the name Sterling.',
  'This is the witness identification that fixes Victor at the scene. She withheld the badge earlier out of fear of publicity.',
  '{"type":"time","after_minutes":120,"description":"A scheduled follow-up contact from Dr. Rhodes arrives offline."}'::jsonb,
  '{"after":["witness statement"],"min_minutes":120}'::jsonb,
  '2024-11-15 00:15 (statement corrected 2024-11-16)', 'high', 'Dr. Elena Rhodes, Victor Sterling',
  '["victor-identified"]'::jsonb, '["jasper-fled-west-wing"]'::jsonb, false, 10
WHERE NOT EXISTS (
  SELECT 1 FROM evidence WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc' AND source = 'corrected witness statement'
);

-- Verify the seed shape (safe columns only).
-- SELECT source, player_visible, discovery_order, timeline_reference
--   FROM evidence WHERE case_id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc'
--  ORDER BY discovery_order;
