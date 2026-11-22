// M2 knowledge seed: specialists, artifacts and disagreements for the showcase
// case "The Midnight Heist". Idempotent and deterministic (keyed upserts).
//
//   npm run db:seed:knowledge
//
// SAFETY / NON-LEAKAGE:
//   * Nothing in this file names the canonical culprit, the hidden hiding
//     place, or any evidence UUID. Knowledge is general, discipline-grounded
//     reference material, not solution content.
//   * Specialist personas are explicitly fictional (is_fictional=true) but
//     grounded in a real discipline (real_discipline_basis set).
//   * Real-knowledge artifacts use source_verified=false with NO source_url and
//     a stable bibliography_ref. No fabricated URLs or quotations are stored.
//   * One artifact is explicitly an in-world fictional document.

import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from '../src/db';

const CASE_ID = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc';

// Applies the additive migration defensively so this seed works on a fresh DB
// as well as one where CI already applied 006. The migration is idempotent.
async function applyMigration(): Promise<void> {
  const file = path.resolve(process.cwd(), 'migrations', '006_m2_knowledge.sql');
  if (!fs.existsSync(file)) throw new Error(`Missing migration: ${file}`);
  const sql = fs.readFileSync(file, 'utf8');
  await query(sql);
}

interface SpecialistSeed {
  key: string;
  name: string;
  title: string;
  specialization: string;
  discipline: string;
  knowledgeDomains: string[];
  personality: string;
  communicationStyle: string;
  reasoningApproach: string;
  expertiseSummary: string;
  limitations: string[];
  depthGuidance: Record<string, string>;
  realDisciplineBasis: string;
  caseRelevance: string;
  displayOrder: number;
}

const DEPTH_GUIDANCE: Record<string, string> = {
  plain: 'Use everyday language and a short analogy; avoid technical vocabulary.',
  working: 'Name the technique and its main uncertainty, but stay concise.',
  technical: 'Include method, known error sources and what would raise or lower confidence.',
};

const SPECIALISTS: SpecialistSeed[] = [
  {
    key: 'forensic-scientist-priya',
    name: 'Dr. Priya Raghunathan',
    title: 'Forensic Scientist',
    specialization: 'Trace evidence and materials analysis',
    discipline: 'Forensic science',
    knowledgeDomains: ['fingerprint comparison', 'trace transfer', 'tool marks', 'material identification', 'chain of custody'],
    personality: 'Precise and methodical; comfortable saying the data cannot support a conclusion.',
    communicationStyle: 'Short, evidence-first statements that separate observation from inference.',
    reasoningApproach: 'Start from the physical trace, state what can and cannot be inferred, then list rival explanations.',
    expertiseSummary: 'Interprets fingerprints, fibres, residues and tool marks, and is careful to distinguish a positive identification from a plausible interpretation.',
    limitations: [
      'A fingerprint match speaks to identity or contact, not to when the contact occurred or why.',
      'Trace material can arrive by secondary or tertiary transfer; presence alone does not prove direct contact with a source.',
      'A result is only as sound as its collection and chain of custody; a contaminated sample cannot be rescued by expertise.',
    ],
    depthGuidance: { ...DEPTH_GUIDANCE },
    realDisciplineBasis: 'Established forensic science practice: fingerprint comparison, trace evidence and chain-of-custody procedure.',
    caseRelevance: 'Explains what physical traces can and cannot establish about the exhibit and the case.',
    displayOrder: 1,
  },
  {
    key: 'security-systems-tomas',
    name: 'Tomas Varga',
    title: 'Security Systems Analyst',
    specialization: 'Access control and sensor systems',
    discipline: 'Security systems engineering',
    knowledgeDomains: ['access control', 'badge systems', 'motion sensors', 'CCTV', 'maintenance windows', 'audit logs'],
    personality: 'A systems thinker who is wary of timelines that look too clean.',
    communicationStyle: 'Walks through system state over time and flags where a log could be misleading.',
    reasoningApproach: 'Reconstruct how the system was configured and ask who had the ordinary ability to change that configuration.',
    expertiseSummary: 'Reads badge, alarm and sensor logs together and knows that scheduled maintenance and legitimate overrides create gaps a timeline alone will not show.',
    limitations: [
      'A log records what a system was told, not necessarily what physically happened.',
      'Maintenance windows and manual overrides are normal operations; they are not themselves evidence of wrongdoing.',
      'Camera coverage has blind spots and retention limits; missing footage is not proof that nothing happened.',
    ],
    depthGuidance: { ...DEPTH_GUIDANCE },
    realDisciplineBasis: 'Established physical-security principles: access control, audit logging and scheduled sensor maintenance.',
    caseRelevance: 'Frames how access and sensor records should be read together without treating a log as ground truth.',
    displayOrder: 2,
  },
  {
    key: 'gemologist-adaeze',
    name: 'Adaeze Okonkwo',
    title: 'Gemologist',
    specialization: 'Diamond identification and simulants',
    discipline: 'Gemology',
    knowledgeDomains: ['diamond identification', 'simulants', 'treatments', 'cutting tools', 'optical properties', 'provenance documentation'],
    personality: 'Exact about what an instrument can prove and what it cannot.',
    communicationStyle: 'Consistently separates visual impression from measured property.',
    reasoningApproach: 'Separate identity, treatment and origin questions before drawing any conclusion about a stone.',
    expertiseSummary: 'Distinguishes natural diamonds from simulants and treatments using optical and physical tests, and understands the practical limits of cutting and shaping tools.',
    limitations: [
      'Visual appearance cannot reliably separate a diamond from a simulant; instrument tests are required.',
      'A grading report describes a stone at one point in time, not its ownership or history.',
      'Tool marks can indicate a class of implement but rarely identify a unique tool or a specific person.',
    ],
    depthGuidance: { ...DEPTH_GUIDANCE },
    realDisciplineBasis: 'Established gemology: diamond identification, simulants and standard gemological instruments.',
    caseRelevance: 'Clarifies how a valuable stone would be identified and what its documentation can and cannot show.',
    displayOrder: 3,
  },
  {
    key: 'insurance-analyst-miriam',
    name: 'Miriam Coldwell',
    title: 'Forensic Accounting & Insurance Analyst',
    specialization: 'Insurance fraud indicators',
    discipline: 'Forensic accounting',
    knowledgeDomains: ['policy ownership', 'beneficiaries', 'insolvency', 'documentary timelines', 'fraud red flags'],
    personality: 'Document-driven and careful to label every inference as an inference.',
    communicationStyle: 'Ties each claim to a document and states whether it is fact or inference.',
    reasoningApproach: 'Test a narrative against paperwork and dates before accepting a proposed motive.',
    expertiseSummary: 'Examines policy ownership, beneficiaries and financial pressure as documentary evidence, and knows that a plausible motive is not proof that anyone acted.',
    limitations: [
      'Financial pressure is a possible motive, not evidence that a specific person acted.',
      'Policy documents show who held an interest, not who committed a theft.',
      'A holding company or similar structure is legal in itself and needs context before it implies wrongdoing.',
    ],
    depthGuidance: { ...DEPTH_GUIDANCE },
    realDisciplineBasis: 'Established forensic accounting and insurance-fraud examination practice.',
    caseRelevance: 'Explains how insurance documents are examined and why motive alone is not proof.',
    displayOrder: 4,
  },
];

interface ArtifactSeed {
  key: string;
  title: string;
  artifactType: string;
  description: string;
  content: string;
  specialistKey: string | null;
  sourceAuthor: string;
  sourceUrl: string | null;
  sourceVerified: boolean;
  bibliographyRef: string;
  publicationDate: string;
  knowledgeClass: string;
  reliability: string;
  relatedConcepts: string[];
  isFictional: boolean;
  usageNote: string;
}

const ARTIFACTS: ArtifactSeed[] = [
  {
    key: 'fingerprint-comparison-principles',
    title: 'Principles of Fingerprint Comparison',
    artifactType: 'reference',
    description: 'How examiners compare ridge detail, and why any conclusion must be qualified by print quality and chain of custody.',
    content: 'Comparison proceeds from broad pattern type to finer minutiae. The conclusion is stated at the level the quality of the mark supports: a clear, complete print can support a strong association, while a partial or smudged mark may support only a qualified one. A print carries no timestamp; when contact occurred must be established by other means. The value of a comparison depends on how the mark was recovered and preserved.',
    specialistKey: 'forensic-scientist-priya',
    sourceAuthor: 'General forensic-science guidance (summary)',
    sourceUrl: null,
    sourceVerified: false,
    bibliographyRef: 'National Research Council, Strengthening Forensic Science in the United States: A Path Forward (2009), chapter on fingerprint comparison; President’s Council of Advisors on Science and Technology, Forensic Science in Criminal Courts (2016).',
    publicationDate: '2009',
    knowledgeClass: 'established',
    reliability: 'high',
    relatedConcepts: ['fingerprint', 'minutiae', 'chain of custody', 'identification', 'trace'],
    isFictional: false,
    usageNote: 'Use to explain what a fingerprint result can and cannot establish; never to date a print.',
  },
  {
    key: 'trace-transfer-and-secondary-transfer',
    title: 'Trace Transfer and Secondary Transfer',
    artifactType: 'reference',
    description: 'Why finding a trace material does not, by itself, prove direct contact with its original source.',
    content: 'Materials move between surfaces through ordinary contact and can then move again on clothing, tools or hands. A fibre or particle found in one place may therefore have travelled indirectly. Interpreting a trace requires asking how it could have arrived, how long it could persist, and whether a simpler transfer path explains it as well as a direct one.',
    specialistKey: 'forensic-scientist-priya',
    sourceAuthor: 'General forensic-science guidance (summary)',
    sourceUrl: null,
    sourceVerified: false,
    bibliographyRef: 'Standard forensic trace-evidence texts describing Locard’s exchange principle and secondary transfer (general reference).',
    publicationDate: 'n/a',
    knowledgeClass: 'established',
    reliability: 'high',
    relatedConcepts: ['trace', 'transfer', 'secondary transfer', 'fibres', 'contamination'],
    isFictional: false,
    usageNote: 'Use when weighing whether a trace proves direct presence or only possible contact.',
  },
  {
    key: 'access-control-and-maintenance-windows',
    title: 'Access Control and Maintenance Windows',
    artifactType: 'reference',
    description: 'How scheduled maintenance and override procedures create legitimate gaps in coverage that must be read against audit logs.',
    content: 'Access-control and sensor systems are configured by administrators. Routine tasks such as calibration, software updates and testing produce planned intervals in which normal detection may be reduced or suspended, and those intervals are usually recorded in maintenance logs. An audit log is therefore only one part of the picture: it must be read alongside system configuration and maintenance records before conclusions are drawn about a sequence of events.',
    specialistKey: 'security-systems-tomas',
    sourceAuthor: 'General physical-security guidance (summary)',
    sourceUrl: null,
    sourceVerified: false,
    bibliographyRef: 'ISO/IEC 27001 Annex A control guidance on access control and logging; general ASIS physical-security references.',
    publicationDate: 'n/a',
    knowledgeClass: 'established',
    reliability: 'high',
    relatedConcepts: ['access control', 'audit log', 'maintenance window', 'sensor', 'override', 'badge'],
    isFictional: false,
    usageNote: 'Use to explain why a clean log is not proof of a clean sequence; never to assign blame.',
  },
  {
    key: 'sensor-log-interpretation-limits',
    title: 'Limits of Sensor and Camera Log Interpretation',
    artifactType: 'methodology-caution',
    description: 'A caution that sensor and camera logs record system state rather than ground truth, and that blind spots and retention limits matter.',
    content: 'A sensor reports what it was configured and able to detect, within its coverage and sensitivity. Blind spots, maintenance modes and retention policies mean an absence of recorded activity is not a reliable statement that nothing occurred. Equally, a recorded event establishes only that a system registered something at a time, not the identity or intent behind it. Log evidence is strongest when corroborated by an independent source.',
    specialistKey: 'security-systems-tomas',
    sourceAuthor: 'General security-testing guidance (summary)',
    sourceUrl: null,
    sourceVerified: false,
    bibliographyRef: 'General security-testing and audit literature on log fidelity and camera coverage limitations.',
    publicationDate: 'n/a',
    knowledgeClass: 'methodology-caution',
    reliability: 'contested',
    relatedConcepts: ['sensor', 'CCTV', 'blind spot', 'log fidelity', 'retention'],
    isFictional: false,
    usageNote: 'Use when a clean timeline is being treated as conclusive; it is a caution, not an accusation.',
  },
  {
    key: 'diamond-vs-simulant-identification',
    title: 'Diamond Identification and Simulants',
    artifactType: 'reference',
    description: 'Standard instruments used to separate a diamond from simulants and to detect treatments, and why visual inspection is insufficient.',
    content: 'Visual appearance alone cannot reliably distinguish a diamond from a simulant or a treated stone. Gemologists use instruments that measure optical and thermal properties, compare magnification features and check documented characteristics. A grading report records what was observed at the time of examination; it speaks to the stone, not to its custody, ownership or the route by which it reached a display.',
    specialistKey: 'gemologist-adaeze',
    sourceAuthor: 'General gemological reference material (summary)',
    sourceUrl: null,
    sourceVerified: false,
    bibliographyRef: 'Gemological Institute of America educational material on diamond identification, simulants and treatments (general reference).',
    publicationDate: 'n/a',
    knowledgeClass: 'established',
    reliability: 'high',
    relatedConcepts: ['diamond', 'simulant', 'refractometer', 'thermal conductivity', 'treatment', 'grading report'],
    isFictional: false,
    usageNote: 'Use to explain identity versus documentation; do not infer ownership from a grading report.',
  },
  {
    key: 'tool-mark-classification-limits',
    title: 'Class Characteristics in Tool Marks',
    artifactType: 'methodology-caution',
    description: 'Cutting and shaping marks can narrow the class of implement used, but comparison rarely identifies a unique tool or a specific person.',
    content: 'Tools of the same type leave broadly similar class characteristics. An examination can often say what kind of implement produced a mark and sometimes compare a recovered item to a suspect tool, but class features overlap between individual tools. Recovered residues may add discriminating information, yet common materials limit how far that reasoning can go. Conclusions should be stated as a class or a qualified comparison, not as a unique source.',
    specialistKey: 'gemologist-adaeze',
    sourceAuthor: 'General forensic tool-mark literature (summary)',
    sourceUrl: null,
    sourceVerified: false,
    bibliographyRef: 'General forensic-science references on tool-mark comparison and class versus individual characteristics.',
    publicationDate: 'n/a',
    knowledgeClass: 'methodology-caution',
    reliability: 'contested',
    relatedConcepts: ['tool mark', 'class characteristics', 'cutting implement', 'residue'],
    isFictional: false,
    usageNote: 'Use to limit over-claims about a unique tool; never to name an individual.',
  },
  {
    key: 'gala-loan-inventory-condition-report',
    title: 'Gala Loan Inventory & Condition Report (in-world document)',
    artifactType: 'in-world document',
    description: 'A fictional in-world form used for loaned exhibits and standard condition-report steps. Marked fictional; not a real source.',
    content: 'This is a fictional document created for this investigation. It lists loaned items by catalogue number and records the standard steps for a condition report when an item is received and returned. It deliberately contains no information about any specific theft, its perpetrator, or where any item was taken. It is included only to illustrate how routine paperwork is structured.',
    specialistKey: null,
    sourceAuthor: 'In-world prop (fictional)',
    sourceUrl: null,
    sourceVerified: false,
    bibliographyRef: '',
    publicationDate: 'in-world',
    knowledgeClass: 'fictional',
    reliability: 'fiction',
    relatedConcepts: ['inventory', 'condition report', 'loan', 'paperwork'],
    isFictional: true,
    usageNote: 'Illustrative in-world artifact only; do not cite as a real source or as evidence of any outcome.',
  },
];

interface DisagreementSeed {
  key: string;
  topic: string;
  specialistAKey: string;
  specialistBKey: string;
  positionA: string;
  positionB: string;
  disciplinaryBasis: string;
  uncertaintyNote: string;
  distinguishingEvidence: string;
  relatedArtifactKeys: string[];
}

const DISAGREEMENTS: DisagreementSeed[] = [
  {
    key: 'trace-vs-log-timing',
    topic: 'What a fingerprint can tell us about timing',
    specialistAKey: 'forensic-scientist-priya',
    specialistBKey: 'security-systems-tomas',
    positionA: 'A fingerprint can establish contact with a surface but not when that contact happened; the print itself carries no timestamp.',
    positionB: 'Audit and access logs can bracket when an area was accessed, so pairing a log window with a print location can constrain the sequence even if the print is undated.',
    disciplinaryBasis: 'Forensic trace interpretation versus access-control log analysis.',
    uncertaintyNote: 'Both readings are provisional: a log can be overridden or incomplete, and a print can be transferred secondarily.',
    distinguishingEvidence: 'Independent corroboration - a contemporaneous log event together with a print in a position that ordinary transfer cannot easily explain.',
    relatedArtifactKeys: ['fingerprint-comparison-principles', 'trace-transfer-and-secondary-transfer', 'access-control-and-maintenance-windows'],
  },
  {
    key: 'optical-id-vs-toolmarks',
    topic: 'How far a tool-mark observation can be pushed',
    specialistAKey: 'gemologist-adaeze',
    specialistBKey: 'forensic-scientist-priya',
    positionA: 'Optical and tool-mark observations can narrow the class of implement used but cannot identify a unique tool or a specific person.',
    positionB: 'Where trace residues are recovered, material comparison can sometimes distinguish one source from another, adding power beyond the mark alone.',
    disciplinaryBasis: 'Gemology and materials identification versus forensic trace comparison.',
    uncertaintyNote: 'Class characteristics overlap between tools, and residues may be common materials; neither line of reasoning is conclusive on its own.',
    distinguishingEvidence: 'A measured residue profile consistent with a particular source, set against a mark that shows only class features.',
    relatedArtifactKeys: ['diamond-vs-simulant-identification', 'tool-mark-classification-limits'],
  },
];

async function upsertSpecialist(s: SpecialistSeed): Promise<string> {
  const result = await query(
    `INSERT INTO specialists
       (specialist_key, name, title, specialization, discipline, knowledge_domains,
        personality, communication_style, reasoning_approach, expertise_summary,
        limitations, depth_guidance, is_fictional, real_discipline_basis)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (specialist_key) DO UPDATE SET
       name = EXCLUDED.name, title = EXCLUDED.title, specialization = EXCLUDED.specialization,
       discipline = EXCLUDED.discipline, knowledge_domains = EXCLUDED.knowledge_domains,
       personality = EXCLUDED.personality, communication_style = EXCLUDED.communication_style,
       reasoning_approach = EXCLUDED.reasoning_approach, expertise_summary = EXCLUDED.expertise_summary,
       limitations = EXCLUDED.limitations, depth_guidance = EXCLUDED.depth_guidance,
       is_fictional = EXCLUDED.is_fictional, real_discipline_basis = EXCLUDED.real_discipline_basis,
       updated_at = NOW()
     RETURNING id`,
    [
      s.key, s.name, s.title, s.specialization, s.discipline, JSON.stringify(s.knowledgeDomains),
      s.personality, s.communicationStyle, s.reasoningApproach, s.expertiseSummary,
      JSON.stringify(s.limitations), JSON.stringify(s.depthGuidance), true, s.realDisciplineBasis,
    ]
  );
  return result.rows[0].id as string;
}

async function attachSpecialist(id: string, s: SpecialistSeed): Promise<void> {
  await query(
    `INSERT INTO case_specialists (case_id, specialist_id, case_relevance, display_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (case_id, specialist_id) DO UPDATE SET
       case_relevance = EXCLUDED.case_relevance, display_order = EXCLUDED.display_order, updated_at = NOW()`,
    [CASE_ID, id, s.caseRelevance, s.displayOrder]
  );
}

async function upsertArtifact(a: ArtifactSeed, specialistIds: Map<string, string>): Promise<void> {
  const specialistId = a.specialistKey ? specialistIds.get(a.specialistKey) ?? null : null;
  await query(
    `INSERT INTO knowledge_artifacts
       (artifact_key, title, artifact_type, description, content, specialist_id, case_id,
        source_author, source_url, source_verified, bibliography_ref, publication_date,
        knowledge_class, reliability, related_concepts, is_fictional, usage_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (artifact_key) DO UPDATE SET
       title = EXCLUDED.title, artifact_type = EXCLUDED.artifact_type,
       description = EXCLUDED.description, content = EXCLUDED.content,
       specialist_id = EXCLUDED.specialist_id, case_id = EXCLUDED.case_id,
       source_author = EXCLUDED.source_author, source_url = EXCLUDED.source_url,
       source_verified = EXCLUDED.source_verified, bibliography_ref = EXCLUDED.bibliography_ref,
       publication_date = EXCLUDED.publication_date, knowledge_class = EXCLUDED.knowledge_class,
       reliability = EXCLUDED.reliability, related_concepts = EXCLUDED.related_concepts,
       is_fictional = EXCLUDED.is_fictional, usage_note = EXCLUDED.usage_note, updated_at = NOW()`,
    [
      a.key, a.title, a.artifactType, a.description, a.content, specialistId, CASE_ID,
      a.sourceAuthor, a.sourceUrl, a.sourceVerified, a.bibliographyRef, a.publicationDate,
      a.knowledgeClass, a.reliability, JSON.stringify(a.relatedConcepts), a.isFictional, a.usageNote,
    ]
  );
}

async function upsertDisagreement(d: DisagreementSeed, specialistIds: Map<string, string>): Promise<void> {
  const a = specialistIds.get(d.specialistAKey);
  const b = specialistIds.get(d.specialistBKey);
  if (!a || !b) throw new Error(`Missing specialist for disagreement ${d.key}`);
  await query(
    `INSERT INTO knowledge_disagreements
       (disagreement_key, case_id, topic, specialist_a_id, specialist_b_id, position_a,
        position_b, disciplinary_basis, uncertainty_note, distinguishing_evidence, related_artifact_keys)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (disagreement_key) DO UPDATE SET
       topic = EXCLUDED.topic, specialist_a_id = EXCLUDED.specialist_a_id,
       specialist_b_id = EXCLUDED.specialist_b_id, position_a = EXCLUDED.position_a,
       position_b = EXCLUDED.position_b, disciplinary_basis = EXCLUDED.disciplinary_basis,
       uncertainty_note = EXCLUDED.uncertainty_note,
       distinguishing_evidence = EXCLUDED.distinguishing_evidence,
       related_artifact_keys = EXCLUDED.related_artifact_keys, updated_at = NOW()`,
    [
      d.key, CASE_ID, d.topic, a, b, d.positionA, d.positionB, d.disciplinaryBasis,
      d.uncertaintyNote, d.distinguishingEvidence, JSON.stringify(d.relatedArtifactKeys),
    ]
  );
}

async function main(): Promise<void> {
  console.log('M2 knowledge seed (idempotent)\n');
  await applyMigration();

  const caseCheck = await query('SELECT id, title FROM cases WHERE id = $1', [CASE_ID]);
  if (caseCheck.rows.length === 0) throw new Error(`Showcase case ${CASE_ID} not found - run db seed first`);
  console.log(`  case: ${caseCheck.rows[0].title}`);

  const specialistIds = new Map<string, string>();
  for (const s of SPECIALISTS) {
    specialistIds.set(s.key, await upsertSpecialist(s));
    await attachSpecialist(specialistIds.get(s.key) as string, s);
  }
  console.log(`  specialists: ${SPECIALISTS.length}`);

  for (const a of ARTIFACTS) await upsertArtifact(a, specialistIds);
  console.log(`  artifacts: ${ARTIFACTS.length}`);

  for (const d of DISAGREEMENTS) await upsertDisagreement(d, specialistIds);
  console.log(`  disagreements: ${DISAGREEMENTS.length}`);

  console.log('\nKNOWLEDGE SEED: PASS');
}

main()
  .catch((err: Error) => {
    console.error('KNOWLEDGE SEED: FAIL');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
