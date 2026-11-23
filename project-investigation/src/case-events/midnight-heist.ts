// M6 showcase case-event package: The Midnight Heist.
// ---------------------------------------------------------------------------
// SERVER AUTHORING ONLY. All references are human-readable source strings and
// real specialist keys from the M3 knowledge pack — never database UUIDs and
// never canonical-truth fields. The `leakageTerms` array is a server-side guard
// list (it holds the canonical culprit name) and is NEVER sent to clients.

import type { CaseEventPackage } from '../living-world/types';

export const midnightHeistEvents: CaseEventPackage = {
  caseTitle: 'The Midnight Heist',
  packageKey: 'midnight-heist-v1',
  version: '1.0.0',
  status: 'pending_review',
  summary:
    'Nine team activities around the gallery incident: trace review, alarm-window analysis, witness contact, an unresolved timing disagreement, a trace-led follow-up, a missed callback window, an external records request and a superseding timeline tension.',
  leakageTerms: [
    // Canonical culprit (server-only leakage guard; never in presentation text).
    'Victor Sterling',
  ],
  events: [
    {
      key: 'mh-trace-review',
      category: 'specialist_discovery',
      actor: { kind: 'specialist', specialistKey: 'forensic-scientist-priya', displayName: 'Dr. Priya Raghunathan' },
      significance: 'normal',
      groupKey: 'trace-review',
      timing: { anchor: 'investigation_start', afterMinutes: 5 },
      eligibility: {},
      presentation: {
        title: 'Initial trace review opened',
        summary: 'The forensic team has begun a first pass over the material collected from the gallery.',
        detail:
          'Dr. Raghunathan has logged the opening items and separated direct observations from inference. She will flag anything the current material cannot support.',
        whyItMatters: 'A clean observation-versus-inference split keeps early theories from outrunning the evidence.',
        requiresResponse: false,
      },
      consequence: {
        kind: 'development',
        messageTemplate: 'Forensic review of the opening material is under way.',
      },
      provenance: { artifactKeys: ['fingerprint-comparison-principles'], evidenceRefs: ['security footage', 'night guard log'] },
      narration: 'template',
    },
    {
      key: 'mh-alarm-window-review',
      category: 'evidence_development',
      actor: { kind: 'specialist', specialistKey: 'security-systems-tomas', displayName: 'Tomas Varga' },
      significance: 'normal',
      groupKey: 'timeline',
      timing: { anchor: 'evidence:alarm system log', afterMinutes: 20 },
      eligibility: { requiresVisibleEvidence: ['alarm system log'] },
      presentation: {
        title: 'Alarm-window analysis ready',
        summary: 'The systems analyst has reconciled the sensor record against the guard roster.',
        detail:
          'Tomas Varga notes that a brief sensor gap is consistent with routine maintenance and asks that the maintenance schedule be checked before drawing conclusions.',
        whyItMatters: 'The precise length and cause of the gap constrains every later timeline claim.',
        requiresResponse: false,
      },
      consequence: { kind: 'set_flag', flag: 'mh:alarm-window-reviewed', value: { status: 'reconciled' } },
      provenance: { specialistKey: 'security-systems-tomas', artifactKeys: ['access-control-and-maintenance-windows'], evidenceRefs: ['alarm system log', 'night guard log'] },
      narration: 'template',
    },
    {
      key: 'mh-corridor-figure-note',
      category: 'witness_information',
      actor: { kind: 'witness', characterName: 'Dr. Elena Rhodes', displayName: 'Dr. Elena Rhodes' },
      significance: 'normal',
      groupKey: 'witness',
      timing: { anchor: 'evidence:security footage', afterMinutes: 30 },
      eligibility: { requiresVisibleEvidence: ['security footage'] },
      presentation: {
        title: 'Witness offers to clarify the corridor footage',
        summary: 'A witness has asked to revisit what she saw on the night of the incident.',
        detail:
          'Dr. Rhodes believes a detail in the corridor recording is being misread and has offered a short follow-up conversation. She has not been told what the team concluded.',
        whyItMatters: 'A first-hand clarification can prevent a mistaken identity from anchoring the investigation.',
        requiresResponse: true,
        responseOptions: [
          { kind: 'reply_to_specialist', label: 'Prepare follow-up questions' },
          { kind: 'open_activity', label: 'Review the activity feed' },
        ],
      },
      consequence: { kind: 'new_action', action: 'mh:request_followup_interview', label: 'Request a follow-up interview' },
      provenance: { evidenceRefs: ['security footage', 'witness statement'], sourceRefs: [{ label: 'Witness account', ref: 'witness statement' }] },
      narration: 'template',
    },
    {
      key: 'mh-guard-availability',
      category: 'suspect_behavior',
      actor: { kind: 'external', displayName: 'Gallery Security Desk' },
      significance: 'low',
      groupKey: 'witness',
      timing: { anchor: 'investigation_start', afterMinutes: 45 },
      eligibility: {},
      presentation: {
        title: 'Security desk confirms a shift change',
        summary: 'The gallery has confirmed a routine staffing change and provided a public rota note.',
        detail:
          'The security desk reports that one guard was off shift during the late hours, consistent with the posted rota. This is scheduling information only.',
        whyItMatters: 'Establishing who was actually on duty helps separate routine absence from suspicious conduct.',
        requiresResponse: false,
      },
      consequence: {
        kind: 'suspect_behavior',
        characterName: 'Guard Mills',
        observable: 'unavailable',
        publicReason: 'Off shift during the late hours per the posted rota.',
      },
      provenance: { evidenceRefs: ['night guard log'] },
      narration: 'template',
    },
    {
      key: 'mh-trace-timing-disagreement',
      category: 'team_disagreement',
      actor: { kind: 'team', displayName: 'Investigation Team' },
      significance: 'high',
      groupKey: 'timeline',
      timing: { anchor: 'checkpoint:alarm-window-identified', afterMinutes: 10 },
      eligibility: { completedCheckpoints: ['alarm-window-identified'] },
      presentation: {
        title: 'Specialists disagree on what timing can prove',
        summary: 'Two specialists read the same timing record differently and want the team to keep both readings open.',
        detail:
          'The forensic analyst cautions that a trace speaks to contact, not to the moment of contact. The systems analyst counters that the sensor record still narrows the window. Neither view is treated as settled.',
        whyItMatters: 'Holding both readings open prevents a premature, confident timeline.',
        requiresResponse: true,
        responseOptions: [
          { kind: 'rebuild_hypothesis', label: 'Hold both readings open' },
          { kind: 'open_activity', label: 'See supporting activity' },
        ],
        upcomingTeaser: { title: 'A timing disagreement is likely to surface', certainty: 'tentative' },
      },
      consequence: {
        kind: 'team_disagreement',
        topic: 'What the timing record can establish',
        specialistAKey: 'forensic-scientist-priya',
        specialistBKey: 'security-systems-tomas',
        positionA: 'Physical trace alone cannot establish when contact occurred.',
        positionB: 'The sensor record still narrows the possible window.',
        uncertaintyNote: 'Both readings remain provisional pending a reconciled maintenance schedule.',
      },
      provenance: { specialistKey: 'forensic-scientist-priya', artifactKeys: ['trace-vs-log-timing'], evidenceRefs: ['alarm system log', 'security footage'] },
      narration: 'template',
    },
    {
      key: 'mh-trace-follow-up-lead',
      category: 'follow_up_lead',
      actor: { kind: 'specialist', specialistKey: 'gemologist-adaeze', displayName: 'Adaeze Okonkwo' },
      significance: 'normal',
      groupKey: 'trace-review',
      timing: { anchor: 'action:examine_diamond_case', afterMinutes: 5 },
      eligibility: {},
      presentation: {
        title: 'A new line of inquiry is available',
        summary: 'The materials specialist has flagged a follow-up worth running once the case examination is logged.',
        detail:
          'Adaeze Okonkwo suggests comparing the case examination findings against the display records. She has only observation-level notes at this stage.',
        whyItMatters: 'The follow-up can confirm or weaken an early materials theory without relying on assumption.',
        requiresResponse: false,
      },
      // Authoring note: release_lead NEVER writes evidence_discoveries. The
      // target is a hidden item that already has an authored investigation_action
      // discovery path, so the post-commit progression rerun is idempotent.
      consequence: { kind: 'release_lead', evidenceRef: 'fingerprint analysis', actionLabel: 'Review the trace follow-up' },
      provenance: { specialistKey: 'gemologist-adaeze', artifactKeys: ['diamond-vs-simulant-identification', 'tool-mark-classification-limits'], evidenceRefs: ['fingerprint analysis'] },
      narration: 'template',
    },
    {
      key: 'mh-witness-callback-window',
      category: 'investigative_setback',
      actor: { kind: 'witness', characterName: 'Dr. Elena Rhodes', displayName: 'Dr. Elena Rhodes' },
      significance: 'normal',
      groupKey: 'witness',
      timing: { anchor: 'investigation_start', afterMinutes: 90 },
      expiresAfterMinutes: 30,
      eligibility: {},
      presentation: {
        title: 'A short witness callback window',
        summary: 'The witness can be reached only for a limited window this evening.',
        detail:
          'Dr. Rhodes is available briefly. If the team cannot take up the offer in time, an alternative contact route remains available.',
        whyItMatters: 'Acting within the window keeps a first-hand account on the record.',
        requiresResponse: true,
        responseOptions: [{ kind: 'open_activity', label: 'Open activity' }],
        upcomingTeaser: { title: 'A witness callback window is approaching', certainty: 'tentative' },
      },
      consequence: {
        kind: 'development',
        messageTemplate: 'The witness callback window is open now.',
      },
      onExpiry: {
        kind: 'missed_opportunity',
        flag: 'mh:callback-window-missed',
        message: 'The witness callback window closed; an alternative contact route is still available.',
        alternativeEventKey: 'mh-callback-recovery',
        nonEssential: true,
      },
      provenance: { evidenceRefs: ['witness statement'] },
      narration: 'template',
    },
    {
      key: 'mh-records-request',
      category: 'external_development',
      actor: { kind: 'external', displayName: 'Insurance Review Desk' },
      significance: 'normal',
      groupKey: 'external',
      timing: { anchor: 'investigation_start', afterMinutes: 150 },
      eligibility: {},
      presentation: {
        title: 'Records request acknowledged',
        summary: 'An outside records desk has acknowledged the team request and set a response date.',
        detail:
          'The desk has confirmed receipt of the request for policy paperwork. No conclusions have been drawn and nothing has been released.',
        whyItMatters: 'A logged request keeps the follow-up traceable without implying any finding.',
        requiresResponse: false,
        upcomingTeaser: { title: 'A records response is expected', certainty: 'tentative' },
      },
      consequence: { kind: 'set_flag', flag: 'mh:records-request-acknowledged', value: { status: 'pending' } },
      provenance: { artifactKeys: ['gala-loan-inventory-condition-report'] },
      narration: 'template',
    },
    {
      key: 'mh-cane-timeline-tension',
      category: 'contradiction',
      actor: { kind: 'specialist', specialistKey: 'security-systems-tomas', displayName: 'Tomas Varga' },
      significance: 'high',
      groupKey: 'timeline',
      timing: { anchor: 'checkpoint:silver-cane-identified', afterMinutes: 15 },
      eligibility: { completedCheckpoints: ['silver-cane-identified'] },
      presentation: {
        title: 'Timeline tension identified',
        summary: 'A later observation does not sit comfortably with the earlier corridor reading.',
        detail:
          'Tomas Varga flags a tension between the corridor observation and the reconstructed movement timeline. He recommends recording both rather than discarding one.',
        whyItMatters: 'Naming the tension lets the team test it instead of silently choosing a favoured account.',
        requiresResponse: false,
      },
      consequence: {
        kind: 'development',
        messageTemplate: 'A timeline tension was recorded for follow-up.',
      },
      supersedes: ['mh-corridor-figure-note'],
      provenance: { specialistKey: 'security-systems-tomas', artifactKeys: ['sensor-log-interpretation-limits'], evidenceRefs: ['CCTV footage', 'witness statement'] },
      narration: 'template',
    },
  ],
};
