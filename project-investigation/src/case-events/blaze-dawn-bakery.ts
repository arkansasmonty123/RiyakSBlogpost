// M6 showcase case-event package: Blaze at Dawn Bakery.
// ---------------------------------------------------------------------------
// SERVER AUTHORING ONLY. All references use real seeded evidence source strings
// and real M3 specialist keys. Canonical-sensitive strings appear only in the
// server-side `leakageTerms` guard list.

import type { CaseEventPackage } from '../living-world/types';

export const blazeDawnBakeryEvents: CaseEventPackage = {
  caseTitle: 'Blaze at Dawn Bakery',
  packageKey: 'blaze-dawn-bakery-v1',
  version: '1.0.0',
  status: 'pending_review',
  summary:
    'Nine team activities around the bakery fire: origin review, access-window audit, witness contact, staff conduct, a fire-origin-versus-accounting disagreement, a checklist follow-up, a missed callback window, an external insurance note and a superseding inspection-history tension.',
  leakageTerms: [
    // Canonical culprit (server-only leakage guard; never in presentation text).
    'Victor Ames',
  ],
  events: [
    {
      key: 'bl-origin-review',
      category: 'specialist_discovery',
      actor: { kind: 'specialist', specialistKey: 'fire-investigator-delgado', displayName: 'Captain Elena Delgado' },
      significance: 'normal',
      groupKey: 'origin',
      timing: { anchor: 'investigation_start', afterMinutes: 5 },
      eligibility: {},
      presentation: {
        title: 'Fire-origin review opened',
        summary: 'A first-pass origin review of the opening scene material has begun.',
        detail:
          'Captain Delgado has logged the initial scene items and is separating burn-pattern observations from cause claims. She will flag anything the current material cannot support.',
        whyItMatters: 'A disciplined origin review keeps a plausible cause from becoming an assumption.',
        requiresResponse: false,
      },
      consequence: { kind: 'development', messageTemplate: 'Fire-origin review is under way.' },
      provenance: { specialistKey: 'fire-investigator-delgado', evidenceRefs: ['scene report 6', 'witness account 6'] },
      narration: 'template',
    },
    {
      key: 'bl-access-window-audit',
      category: 'evidence_development',
      actor: { kind: 'specialist', specialistKey: 'forensic-accountant-mercer', displayName: 'Ibrahim Mercer' },
      significance: 'normal',
      groupKey: 'timeline',
      timing: { anchor: 'evidence:access log 6', afterMinutes: 20 },
      eligibility: { requiresVisibleEvidence: ['access log 6'] },
      presentation: {
        title: 'Access-window audit ready',
        summary: 'The forensic accountant has matched the access record to the published opening rota.',
        detail:
          'Ibrahim Mercer finds the recorded entries consistent with ordinary delivery and staffing patterns. He asks that routine overrides be checked before any gap is treated as irregular.',
        whyItMatters: 'Routine access must be ruled in or out before a timeline claim is made.',
        requiresResponse: false,
      },
      consequence: { kind: 'set_flag', flag: 'bl:access-window-reviewed', value: { status: 'reconciled' } },
      provenance: { specialistKey: 'forensic-accountant-mercer', evidenceRefs: ['access log 6', 'scene report 6'] },
      narration: 'template',
    },
    {
      key: 'bl-witness-account-note',
      category: 'witness_information',
      actor: { kind: 'witness', characterName: 'Liam Price', displayName: 'Liam Price' },
      significance: 'normal',
      groupKey: 'witness',
      timing: { anchor: 'evidence:witness account 6', afterMinutes: 30 },
      eligibility: { requiresVisibleEvidence: ['witness account 6'] },
      presentation: {
        title: 'Witness offers a clarification',
        summary: 'A witness has asked to revisit part of his account of the morning.',
        detail:
          'Liam Price believes one timing detail in his statement was imprecise and has offered a short follow-up. He has not seen the team working notes.',
        whyItMatters: 'A corrected first-hand account can change how the origin timeline is read.',
        requiresResponse: true,
        responseOptions: [
          { kind: 'reply_to_specialist', label: 'Prepare follow-up questions' },
          { kind: 'open_activity', label: 'Review activity' },
        ],
      },
      consequence: { kind: 'new_action', action: 'bl:request_followup', label: 'Request a follow-up conversation' },
      provenance: { evidenceRefs: ['witness account 6'] },
      narration: 'template',
    },
    {
      key: 'bl-staff-conduct-note',
      category: 'suspect_behavior',
      actor: { kind: 'external', displayName: "Fire Marshal's Office" },
      significance: 'low',
      groupKey: 'witness',
      timing: { anchor: 'investigation_start', afterMinutes: 45 },
      eligibility: {},
      presentation: {
        title: 'Fire marshal confirms a staffing note',
        summary: 'The fire marshal has confirmed a routine rota change and shared a public note.',
        detail:
          'One staff member was defensive when asked about the closing checklist, but the marshal attributes this to a routine procedural dispute. This is conduct information only.',
        whyItMatters: 'Recording observable conduct without inference avoids over-reading a routine dispute.',
        requiresResponse: false,
      },
      consequence: {
        kind: 'suspect_behavior',
        characterName: 'Nora Bell',
        observable: 'defensive',
        publicReason: 'Defensive about the closing checklist per fire marshal note.',
      },
      provenance: { evidenceRefs: ['access log 6'] },
      narration: 'template',
    },
    {
      key: 'bl-origin-accounting-disagreement',
      category: 'team_disagreement',
      actor: { kind: 'team', displayName: 'Investigation Team' },
      significance: 'high',
      groupKey: 'timeline',
      timing: { anchor: 'checkpoint:alarm-window-identified', afterMinutes: 10 },
      eligibility: { completedCheckpoints: ['alarm-window-identified'] },
      presentation: {
        title: 'Specialists disagree on what the records establish',
        summary: 'Two specialists hold different, provisional readings of the same access window.',
        detail:
          'Captain Delgado cautions that burn patterns alone cannot fix a precise cause time. Ibrahim Mercer argues that the access and accounting records still narrow the window. Both readings are kept open.',
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
        topic: 'How far the records narrow the origin window',
        specialistAKey: 'fire-investigator-delgado',
        specialistBKey: 'forensic-accountant-mercer',
        positionA: 'Burn patterns alone cannot establish a precise cause time.',
        positionB: 'The access and accounting records still narrow the window.',
        uncertaintyNote: 'Both readings remain provisional pending a full inspection-history review.',
      },
      provenance: { specialistKey: 'fire-investigator-delgado', evidenceRefs: ['access log 6', 'forensic trace 6'] },
      narration: 'template',
    },
    {
      key: 'bl-checklist-followup',
      category: 'follow_up_lead',
      actor: { kind: 'specialist', specialistKey: 'safety-compliance-hale', displayName: 'Renee Hale' },
      significance: 'normal',
      groupKey: 'origin',
      timing: { anchor: 'action:examine_scene_6', afterMinutes: 5 },
      eligibility: {},
      presentation: {
        title: 'A checklist follow-up is available',
        summary: 'The fire-safety inspector has flagged a checklist reconciliation worth running.',
        detail:
          'Renee Hale suggests comparing the scene examination notes with the published safety checklist history. Only observation-level notes are available so far.',
        whyItMatters: 'A documented checklist review can support or weaken a cause theory without naming anyone.',
        requiresResponse: false,
      },
      // release_lead never writes evidence_discoveries: the target already has an
      // authored investigation_action path, so the progression rerun is idempotent.
      consequence: { kind: 'release_lead', evidenceRef: 'forensic trace 6', actionLabel: 'Review the checklist follow-up' },
      provenance: { specialistKey: 'safety-compliance-hale', evidenceRefs: ['forensic trace 6', 'scene report 6'] },
      narration: 'template',
    },
    {
      key: 'bl-witness-callback-window',
      category: 'investigative_setback',
      actor: { kind: 'witness', characterName: 'Liam Price', displayName: 'Liam Price' },
      significance: 'normal',
      groupKey: 'witness',
      timing: { anchor: 'investigation_start', afterMinutes: 90 },
      expiresAfterMinutes: 30,
      eligibility: {},
      presentation: {
        title: 'A short witness callback window',
        summary: 'The witness can be reached only for a limited window today.',
        detail:
          'Liam Price is available briefly. If the team cannot take up the offer in time, an alternative written route remains available.',
        whyItMatters: 'Acting inside the window keeps a corrected account on the record.',
        requiresResponse: true,
        responseOptions: [{ kind: 'open_activity', label: 'Open activity' }],
        upcomingTeaser: { title: 'A witness callback window is approaching', certainty: 'tentative' },
      },
      consequence: { kind: 'development', messageTemplate: 'The witness callback window is open now.' },
      onExpiry: {
        kind: 'missed_opportunity',
        flag: 'bl:callback-window-missed',
        message: 'The witness callback window closed; a written follow-up route remains available.',
        alternativeEventKey: 'bl-callback-recovery',
        nonEssential: true,
      },
      provenance: { evidenceRefs: ['witness account 6'] },
      narration: 'template',
    },
    {
      key: 'bl-insurance-review-note',
      category: 'external_development',
      actor: { kind: 'external', displayName: 'Insurance Review Desk' },
      significance: 'normal',
      groupKey: 'external',
      timing: { anchor: 'investigation_start', afterMinutes: 150 },
      eligibility: {},
      presentation: {
        title: 'Insurance records request acknowledged',
        summary: 'An outside records desk has acknowledged the request and set a response date.',
        detail:
          'The desk has confirmed receipt of the request for policy and accounting paperwork. No conclusion has been drawn and nothing has been released.',
        whyItMatters: 'A logged request keeps the follow-up traceable without implying any finding.',
        requiresResponse: false,
        upcomingTeaser: { title: 'An insurance records response is expected', certainty: 'tentative' },
      },
      consequence: { kind: 'set_flag', flag: 'bl:insurance-request-acknowledged', value: { status: 'pending' } },
      provenance: { evidenceRefs: ['financial record 6'] },
      narration: 'template',
    },
    {
      key: 'bl-inspection-history-tension',
      category: 'contradiction',
      actor: { kind: 'specialist', specialistKey: 'safety-compliance-hale', displayName: 'Renee Hale' },
      significance: 'high',
      groupKey: 'timeline',
      timing: { anchor: 'checkpoint:silver-cane-identified', afterMinutes: 15 },
      eligibility: { completedCheckpoints: ['silver-cane-identified'] },
      presentation: {
        title: 'Inspection-history tension identified',
        summary: 'A later checklist record does not fully align with the earlier scene account.',
        detail:
          'Renee Hale records a tension between the later inspection entry and the earlier account. She recommends keeping both on the record rather than selecting one.',
        whyItMatters: 'The tension is a testable question, not a conclusion.',
        requiresResponse: false,
      },
      consequence: { kind: 'development', messageTemplate: 'An inspection-history tension was recorded for follow-up.' },
      supersedes: ['bl-witness-account-note'],
      provenance: { specialistKey: 'safety-compliance-hale', evidenceRefs: ['camera frame 6', 'witness account 6'] },
      narration: 'template',
    },
  ],
};
