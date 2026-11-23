import type { CaseDefinition, ChatMessage, NegotiationSession, Offer } from '../../shared/types.js';
import { termLabel } from '../engine/utils.js';
import { latestOpenOffer } from '../engine/agreement.js';

/** SERVER ONLY. Contains private knowledge; never serialize into an API DTO. */
export interface CharacterContext {
  caseId: string;
  participantId: string;
  name: string;
  role: string;
  persona: string;
  goals: string[];
  trueInterests: string[];
  secrets: string[];
  constraints: string[];
  relationships: Record<string, string>;
  knownFacts: string[];
  publicStance: string;
  batna: string;
  reservationPoint: string;
  cooperativeness: 'low' | 'medium' | 'high';
  bluffTendency: 'low' | 'medium' | 'high';
  influence: 'low' | 'medium' | 'high';
  trustInPlayer: number;
  transcriptWindow: { sender: string; content: string }[];
  openOffer: { id: string; terms: string } | null;
  agreementStatus: string;
  requiredIssues: string[];
}

function openOfferSummary(caseDef: CaseDefinition, offer: Offer | undefined): CharacterContext['openOffer'] {
  if (!offer) return null;
  return { id: offer.id, terms: offer.terms.map((t) => termLabel(caseDef, t)).join(', ') };
}

export function buildCharacterContext(
  caseDef: CaseDefinition,
  session: NegotiationSession,
  messages: ChatMessage[],
  participantId: string,
  windowSize = 10,
): CharacterContext | undefined {
  const participant = caseDef.participants.find((p) => p.id === participantId);
  const priv = caseDef.participantPrivate[participantId];
  if (!participant || !priv) return undefined;
  const trust = session.trust.find((t) => t.participantId === participantId)?.score ?? 50;

  return {
    caseId: caseDef.id,
    participantId,
    name: participant.name,
    role: participant.role,
    persona: participant.personality,
    goals: [...priv.goals],
    trueInterests: [...priv.trueInterests],
    secrets: [...priv.secrets],
    constraints: [...priv.constraints],
    relationships: { ...(priv.relationships ?? {}) },
    knownFacts: [...(priv.knownFacts ?? [])],
    publicStance: priv.publicStance ?? '',
    batna: priv.batna,
    reservationPoint: priv.reservationPoint,
    cooperativeness: priv.cooperativeness,
    bluffTendency: priv.bluffTendency,
    influence: priv.influence,
    trustInPlayer: trust,
    transcriptWindow: messages.slice(-windowSize).map((m) => ({ sender: m.senderName, content: m.content.slice(0, 400) })),
    openOffer: openOfferSummary(caseDef, latestOpenOffer(session)),
    agreementStatus: session.agreementStatus,
    requiredIssues: caseDef.issues.filter((i) => i.required).map((i) => i.label),
  };
}

/** The prompt receives private context but is explicitly barred from dumping it. */
export function contextToPrompt(context: CharacterContext): string {
  return JSON.stringify({
    you: {
      name: context.name,
      role: context.role,
      persona: context.persona,
      publicStance: context.publicStance,
      goals: context.goals,
      trueInterests: context.trueInterests,
      privateKnowledge: context.knownFacts,
      secrets: context.secrets,
      constraints: context.constraints,
      relationships: context.relationships,
      reservationPoint: context.reservationPoint,
      batna: context.batna,
      trustInPlayer: context.trustInPlayer,
    },
    table: {
      openOffer: context.openOffer,
      agreementStatus: context.agreementStatus,
      requiredIssues: context.requiredIssues,
      recentTranscript: context.transcriptWindow,
    },
    instruction:
      'Stay in character. Do not quote or dump your privateKnowledge, secrets or reservationPoint verbatim. ' +
      'You may act on them, signal indirectly, or bluff consistently with your persona. ' +
      'Never claim an agreement was reached - the engine validates agreements.',
  });
}
