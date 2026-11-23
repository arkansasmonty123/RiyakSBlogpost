// M6 showcase case-event package: Code Blue at the Clinic.
// ---------------------------------------------------------------------------
// SERVER AUTHORING ONLY. References use real seeded evidence source strings and
// real M3 specialist keys. Canonical-sensitive strings live only in
// `leakageTerms`, which is never serialized to clients.

import type { CaseEventPackage } from '../living-world/types';

export const codeBlueClinicEvents: CaseEventPackage = {
  caseTitle: 'Code Blue at the Clinic',
  packageKey: 'code-blue-clinic-v1',
  version: '1.0.0',
  status: 'pending_review',
  summary:
    'Nine team activities around the clinic incident: intake review, access-window audit, witness contact, staff conduct, a toxicology-versus-compliance disagreement, a controlled-drug-count follow-up, a missed callback window, an external administration note and a superseding chart tension.',
  leakageTerms: [
    // Canonical culprit (server-only leakage guard; never in presentation text).
    'Dr. Paul Kent',
  ],
  events: [
    {
      key: 'cb-intake-review',
      category: 'specialist_discovery',
      actor: { kind: 'specialist', specialistKey: 'clinical-toxicologist-rhee', displayName: 'Dr. Hana Rhee' },
      significance: 'normal',
      groupKey: 'intake',
      timing: { anchor: 'investigation_start', afterMinutes: 5 },
      eligibility: {},
      presentation: {
        title: 'Clinical intake review opened',
        summary: 'A toxicology review of the opening scene material has begun.',
        detail:
          'Dr. Rhee has catalogued the initial items and is separating observable measurements from interpretation. She will flag where the available data cannot support a conclusion.',
        whyItMatters: 'An early, disciplined review prevents a plausible but unsupported explanation from hardening.',
        requiresResponse: false,
      },
      consequence: { kind: 'development', messageTemplate: 'Clinical intake review is under way.' },
      provenance: { specialistKey: 'clinical-toxicologist-rhee', evidenceRefs: ['scene report 17', 'witness account 17'] },
      narration: 'template',
    },
    {
      key: 'cb-access-window-audit',
      category: 'evidence_development',
      actor: { kind: 'specialist', specialistKey: 'diversion-compliance-santos', displayName: 'Marisol Santos' },
      significance: 'normal',
      groupKey: 'timeline',
      timing: { anchor: 'evidence:access log 17', afterMinutes: 20 },
      eligibility: { requiresVisibleEvidence: ['access log 17'] },
      presentation: {
        title: 'Access-window audit ready',
        summary: 'The compliance analyst has matched the access record to the published department rota.',
        detail:
          'Marisol Santos reports that the recorded entries are consistent with ordinary shift patterns. She asks that any override or maintenance note be checked before treating a gap as irregular.',
        whyItMatters: 'Routine access patterns must be ruled in or out before a timeline claim is made.',
        requiresResponse: false,
      },
      consequence: { kind: 'set_flag', flag: 'cb:access-window-reviewed', value: { status: 'reconciled' } },
      provenance: { specialistKey: 'diversion-compliance-santos', evidenceRefs: ['access log 17', 'scene report 17'] },
      narration: 'template',
    },
    {
      key: 'cb-witness-account-note',
      category: 'witness_information',
      actor: { kind: 'witness', characterName: 'Rita Shaw', displayName: 'Rita Shaw' },
      significance: 'normal',
      groupKey: 'witness',
      timing: { anchor: 'evidence:witness account 17', afterMinutes: 30 },
      eligibility: { requiresVisibleEvidence: ['witness account 17'] },
      presentation: {
        title: 'Witness offers a clarification',
        summary: 'A witness has asked to revisit part of her account of the evening.',
        detail:
          'Rita Shaw believes one detail in her statement was imprecise and has offered a short follow-up. She has not seen the team working notes.',
        whyItMatters: 'A corrected first-hand account can change how the timeline is read.',
        requiresResponse: true,
        responseOptions: [
          { kind: 'reply_to_specialist', label: 'Prepare follow-up questions' },
          { kind: 'open_activity', label: 'Review activity' },
        ],
      },
      consequence: { kind: 'new_action', action: 'cb:request_followup', label: 'Request a follow-up conversation' },
      provenance: { evidenceRefs: ['witness account 17'] },
      narration: 'template',
    },
    {
      key: 'cb-staff-conduct-note',
      category: 'suspect_behavior',
      actor: { kind: 'external', displayName: 'Clinic Administration' },
      significance: 'low',
      groupKey: 'witness',
      timing: { anchor: 'investigation_start', afterMinutes: 45 },
      eligibility: {},
      presentation: {
        title: 'Administration confirms a staffing note',
        summary: 'Clinic administration has confirmed a routine rota change and shared a public note.',
        detail:
          'One staff member was defensive when asked about the rota, but administration attributes this to an unrelated scheduling dispute. This is conduct information only.',
        whyItMatters: 'Recording observable conduct without inference keeps the team from over-reading a routine dispute.',
        requiresResponse: false,
      },
      consequence: {
        kind: 'suspect_behavior',
        characterName: 'Jill Poe',
        observable: 'defensive',
        publicReason: 'Defensive about a rota change per administration note.',
      },
      provenance: { evidenceRefs: ['access log 17'] },
      narration: 'template',
    },
    {
      key: 'cb-tox-compliance-disagreement',
      category: 'team_disagreement',
      actor: { kind: 'team', displayName: 'Investigation Team' },
      significance: 'high',
      groupKey: 'timeline',
      timing: { anchor: 'checkpoint:alarm-window-identified', afterMinutes: 10 },
      eligibility: { completedCheckpoints: ['alarm-window-identified'] },
      presentation: {
        title: 'Specialists disagree on the timeline reading',
        summary: 'Two specialists hold different, provisional readings of the same access window.',
        detail:
          'Dr. Rhee cautions that a measured trace cannot on its own fix a time of contact. Marisol Santos argues that the access record still narrows the window. Both readings are kept open.',
        whyItMatters: 'A recorded disagreement stops one discipline from quietly overruling another.',
        requiresResponse: true,
        responseOptions: [
          { kind: 'rebuild_hypothesis', label: 'Keep both readings open' },
          { kind: 'open_activity', label: 'See supporting activity' },
        ],
        upcomingTeaser: { title: 'A cross-discipline disagreement may emerge', certainty: 'tentative' },
      },
      consequence: {
        kind: 'team_disagreement',
        topic: 'How far the access window narrows the timeline',
        specialistAKey: 'clinical-toxicologist-rhee',
        specialistBKey: 'diversion-compliance-santos',
        positionA: 'A measured trace cannot by itself establish a time of contact.',
        positionB: 'The access record still narrows the window.',
        uncertaintyNote: 'Both readings remain provisional pending a full count reconciliation.',
      },
      provenance: { specialistKey: 'clinical-toxicologist-rhee', evidenceRefs: ['access log 17', 'forensic trace 17'] },
      narration: 'template',
    },
    {
      key: 'cb-drug-count-followup',
      category: 'follow_up_lead',
      actor: { kind: 'specialist', specialistKey: 'emergency-docs-owen', displayName: 'Nurse Jordan Owen' },
      significance: 'normal',
      groupKey: 'intake',
      timing: { anchor: 'action:examine_scene_17', afterMinutes: 5 },
      eligibility: {},
      presentation: {
        title: 'A controlled-drug-count follow-up is available',
        summary: 'The emergency nursing specialist has flagged a count reconciliation worth running.',
        detail:
          'Jordan Owen suggests comparing the scene examination notes with the controlled-drug count sheet. Only observation-level notes are available so far.',
        whyItMatters: 'A documented count reconciliation can support or weaken a diversion theory without naming anyone.',
        requiresResponse: false,
      },
      // release_lead never writes evidence_discoveries: the target already has an
      // authored investigation_action path, so the progression rerun is idempotent.
      consequence: { kind: 'release_lead', evidenceRef: 'forensic trace 17', actionLabel: 'Review the count follow-up' },
      provenance: { specialistKey: 'emergency-docs-owen', evidenceRefs: ['forensic trace 17', 'scene report 17'] },
      narration: 'template',
    },
    {
      key: 'cb-witness-callback-window',
      category: 'investigative_setback',
      actor: { kind: 'witness', characterName: 'Rita Shaw', displayName: 'Rita Shaw' },
      significance: 'normal',
      groupKey: 'witness',
      timing: { anchor: 'investigation_start', afterMinutes: 90 },
      expiresAfterMinutes: 30,
      eligibility: {},
      presentation: {
        title: 'A short witness callback window',
        summary: 'The witness can be reached only for a limited window this evening.',
        detail:
          'Rita Shaw is available briefly. If the team cannot take up the offer in time, an alternative written route remains available.',
        whyItMatters: 'Acting inside the window keeps a corrected account on the record.',
        requiresResponse: true,
        responseOptions: [{ kind: 'open_activity', label: 'Open activity' }],
        upcomingTeaser: { title: 'A witness callback window is approaching', certainty: 'tentative' },
      },
      consequence: { kind: 'development', messageTemplate: 'The witness callback window is open now.' },
      onExpiry: {
        kind: 'missed_opportunity',
        flag: 'cb:callback-window-missed',
        message: 'The witness callback window closed; a written follow-up route remains available.',
        alternativeEventKey: 'cb-callback-recovery',
        nonEssential: true,
      },
      provenance: { evidenceRefs: ['witness account 17'] },
      narration: 'template',
    },
    {
      key: 'cb-administration-note',
      category: 'external_development',
      actor: { kind: 'external', displayName: 'Clinic Administration' },
      significance: 'normal',
      groupKey: 'external',
      timing: { anchor: 'investigation_start', afterMinutes: 150 },
      eligibility: {},
      presentation: {
        title: 'Administration review logged',
        summary: 'Clinic administration has logged an internal review request and set a response date.',
        detail:
          'The administration has confirmed receipt of the request for internal records. No finding has been made and no record has been released.',
        whyItMatters: 'A logged request keeps the paper trail traceable without pre-empting the review.',
        requiresResponse: false,
        upcomingTeaser: { title: 'An administration response is expected', certainty: 'tentative' },
      },
      consequence: { kind: 'set_flag', flag: 'cb:administration-review-requested', value: { status: 'pending' } },
      provenance: { evidenceRefs: ['scene report 17'] },
      narration: 'template',
    },
    {
      key: 'cb-chart-tension',
      category: 'contradiction',
      actor: { kind: 'specialist', specialistKey: 'diversion-compliance-santos', displayName: 'Marisol Santos' },
      significance: 'high',
      groupKey: 'timeline',
      timing: { anchor: 'checkpoint:silver-cane-identified', afterMinutes: 15 },
      eligibility: { completedCheckpoints: ['silver-cane-identified'] },
      presentation: {
        title: 'Chart record tension identified',
        summary: 'A later record does not fully align with the earlier witness account.',
        detail:
          'Marisol Santos records a tension between the later chart entry and the earlier account. She recommends keeping both on the record rather than selecting one.',
        whyItMatters: 'The tension is a testable question, not a conclusion.',
        requiresResponse: false,
      },
      consequence: { kind: 'development', messageTemplate: 'A chart-record tension was recorded for follow-up.' },
      supersedes: ['cb-witness-account-note'],
      provenance: { specialistKey: 'diversion-compliance-santos', evidenceRefs: ['camera frame 17', 'witness account 17'] },
      narration: 'template',
    },
  ],
};
