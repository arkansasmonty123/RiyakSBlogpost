import { z } from 'zod';
import type { CaseDefinition, ChatMessage, NegotiationSession, ResponseIntent } from '../../shared/types.js';
import type { AIProvider, ParticipantResponse } from '../../shared/ai.js';
import { latestOpenOffer } from '../engine/agreement.js';
import { buildCharacterContext, contextToPrompt } from './context.js';
import { deterministicResponse } from './fallback.js';
import { DeterministicProvider } from './provider.js';

const responseSchema = z.object({
  participantId: z.string(),
  target: z.string().default('group'),
  message: z.string().min(1).max(2000),
  intent: z.enum([
    'message', 'question', 'offer', 'counteroffer', 'accept', 'reject',
    'withdraw', 'concession', 'challenge', 'walk_away', 'silence',
  ]),
  proposedOffer: z.array(z.object({ issueId: z.string(), value: z.number() })).optional(),
  parentOfferId: z.string().optional(),
  offerId: z.string().optional(),
  concession: z.string().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  internalNote: z.string().optional(),
});

const SYSTEM_PROMPT = `You are one participant in a realistic multi-party negotiation simulation.
Respond ONLY with a single JSON object matching this shape:
{ "participantId": string, "target": "group" | participantId, "message": string,
  "intent": "message"|"question"|"offer"|"counteroffer"|"accept"|"reject"|"withdraw"|"concession"|"challenge"|"silence",
  "proposedOffer"?: [{ "issueId": string, "value": number }],
  "parentOfferId"?: string, "offerId"?: string, "concession"?: string,
  "sentiment"?: "positive"|"neutral"|"negative", "internalNote"?: string }
Rules: stay in character; keep the message under 90 words; do not dump private knowledge or secrets verbatim;
do not invent or declare an agreement (a deterministic engine validates agreements and terms);
only use issue ids you were given; proposedOffer values must be within the issue ranges stated in the case.`;

export interface OrchestrateInput {
  caseDef: CaseDefinition;
  state: NegotiationSession;
  messages: ChatMessage[];
  playerIntent: ResponseIntent;
  provider?: AIProvider;
  /** Session-wide budget; calls beyond it use deterministic fallback. */
  maxLlmCallsPerSession?: number;
  /** Called once per actual LLM attempt, for cost accounting. */
  onLlmCall?: () => void;
}

/** Select 0-N meaningful responders. Not everyone speaks on every turn. */
export function selectResponders(
  caseDef: CaseDefinition,
  state: NegotiationSession,
  messages: ChatMessage[],
  playerIntent: ResponseIntent,
): string[] {
  if (playerIntent === 'walk_away') return [];
  const last = messages[messages.length - 1];
  const content = last?.content.trim() ?? '';
  const target = last?.target ?? 'group';
  const openOffer = latestOpenOffer(state);
  if (content.length < 12 && playerIntent === 'message' && !openOffer) return [];

  const words = content.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  const scores = new Map<string, number>();
  for (const p of caseDef.participants) {
    const priv = caseDef.participantPrivate[p.id];
    let score = 0;
    if (target === p.id) score += 100;
    if (priv.requiredForAgreement) score += 4;
    score += priv.influence === 'high' ? 3 : priv.influence === 'medium' ? 2 : 1;
    const haystack = [...priv.goals, ...priv.trueInterests, p.role, p.bio].join(' ').toLowerCase();
    for (const word of words) if (haystack.includes(word)) score += 2;
    if ((playerIntent === 'question' || playerIntent === 'challenge') && priv.cooperativeness === 'high') score += 2;
    score -= messages.filter((m) => m.senderId === p.id).length * 0.5;
    scores.set(p.id, score);
  }
  if (openOffer) {
    for (const p of caseDef.participants) {
      if (caseDef.participantPrivate[p.id].requiredForAgreement && !(openOffer.acceptances ?? []).includes(p.id)) {
        scores.set(p.id, (scores.get(p.id) ?? 0) + 20);
      }
    }
  }
  const max = caseDef.difficulty === 'advanced' && openOffer ? 3 : 2;
  return caseDef.participants
    .map((p) => ({ id: p.id, score: scores.get(p.id) ?? 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.id);
}

export async function orchestrateTurn(input: OrchestrateInput): Promise<ParticipantResponse[]> {
  const { caseDef, state, messages, playerIntent } = input;
  const provider = input.provider ?? new DeterministicProvider();
  const responders = selectResponders(caseDef, state, messages, playerIntent);
  const openOffer = latestOpenOffer(state);
  const budget = input.maxLlmCallsPerSession ?? Number(process.env.MAX_LLM_CALLS_PER_SESSION ?? 40);
  let callsThisTurn = 0;
  const results: ParticipantResponse[] = [];

  for (const participantId of responders) {
    const context = buildCharacterContext(caseDef, state, messages, participantId);
    if (!context) continue;

    let response: ParticipantResponse | undefined;
    const canCall = provider.usesLLM && (state.llmCalls ?? 0) + callsThisTurn < budget;
    if (canCall) {
      callsThisTurn += 1;
      input.onLlmCall?.();
      const raw = await provider.generateStructured<unknown>({
        system: SYSTEM_PROMPT,
        prompt: contextToPrompt(context),
        schemaName: 'participant_response',
        timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 8000),
      });
      const parsed = responseSchema.safeParse(raw.data);
      if (parsed.success && parsed.data.participantId === participantId) {
        const data = parsed.data;
        response = {
          participantId,
          target: data.target,
          message: data.message,
          intent: data.intent,
          proposedOffer: data.proposedOffer,
          parentOfferId: data.parentOfferId,
          offerId: data.offerId,
          concession: data.concession,
          sentiment: data.sentiment,
          internalNote: data.internalNote,
          source: 'llm',
        };
      }
    }
    results.push(
      response ?? deterministicResponse({
        caseDef,
        context,
        playerIntent,
        playerContent: messages[messages.length - 1]?.content ?? '',
        numericTerms: openOffer?.terms,
      }),
    );
  }
  return results;
}
