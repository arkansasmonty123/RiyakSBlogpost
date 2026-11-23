# M8-5 AI Quality & Cost Notes (estimates)

> **Status:** rough planning estimates, not measured billing data. Prices change;
> verify against your provider's current pricing before budgeting. All numbers
> below are order-of-magnitude illustrations with the assumptions stated.

## Where LLM calls happen

| Path | Trigger | Typical prompt | Output cap | Notes |
|---|---|---|---|---|
| Group chat / specialist / perspective chat | Player sends a chat message | ~1.5k–3k tokens (context is capped at ~6k chars + rolling summary) | ~220 tokens | One call per message. |
| Reasoning review (Reality Map) | Player requests an audit summary | tiny (counts + section sizes only) | ~220 tokens | Optional; deterministic summary always available. |
| Specialist hypothesis review | Player requests a review | bounded context | ~220 tokens | Advisory only; no writes. |
| Discovery advisory (M7) | Only when a submission is ambiguous **and** attempt count is below the cap | ~1k–1.5k tokens | ~320 tokens | Deterministic evaluator remains authoritative; advisory cannot accept. |
| Failover (M8-5) | Only when primary fails/times out and explicitly configured | same as primary | same | One extra attempt; otherwise deterministic fallback. |

**No LLM calls on page views, health checks, list endpoints, or any deterministic
operation.** With `USE_LLM=false` (and when no provider is reachable) the
deterministic responder is used and the LLM cost is **$0**.

## Illustrative scenario: one active investigation

Assumptions: 30 chat messages, 2 reasoning-review calls, 2 specialist reviews,
3 ambiguous discovery submissions. Prompt/answer sizes as in the table above.

- Input tokens: ~30×2,500 (chat) + small reviews + 3×1,200 (discovery) ≈ **~80k tokens**.
- Output tokens: ~30×220 + reviews + 3×320 ≈ **~8k tokens**.

Using a small/cheap model price point (illustrative: ~$0.15 per 1M input,
~$0.60 per 1M output, e.g. a `gpt-4o-mini`-class endpoint):

- Input: 80k × $0.15/1M ≈ **$0.012**
- Output: 8k × $0.60/1M ≈ **$0.005**
- **≈ $0.017 per investigation** (well under a few cents).

At a larger model (illustratively ~10× that price) the same investigation is
roughly **$0.15–$0.20**. Gemini 2.0 Flash may fall under a free tier for light
usage; check current quota terms.

Fleet examples (cheap-model assumption):

- 100 investigations/month ≈ **$1.70**
- 1,000 investigations/month ≈ **$17**
- 10,000 investigations/month ≈ **$170**

These exclude egress, provider minimums, and failed-attempt overhead (a timeout
still consumes partial tokens on some providers).

## Cost controls now in place (M8-5)

- `LLM_TIMEOUT_MS` — abort slow calls; bounds latency and runaway spend.
- `LLM_MAX_TOKENS` — hard cap on generated tokens per call.
- `LLM_TEMPERATURE` — configurable; low values reduce rambling output.
- Existing context caps: `GROUNDING_LIMITS.maxContextChars` (6,000),
  `maxSummaryChars` (1,200), `maxResponseChars` (2,000); discovery prompt
  clip limits (900/2,400 chars). Context is trimmed before it becomes a prompt.
- Discovery advisory is gated by ambiguity and attempt count (not every submit).
- Optional failover is one attempt only, and only when explicitly configured.
- Output guardrails reject empty/oversized/leak-marker responses, avoiding
  repeated display of bad output (the deterministic fallback takes over).

## Instrumentation for monitoring

Each attempted call emits one structured line, e.g.:

```
[LLM-METRICS] {"event":"llm_call","provider":"gemini","model":"gemini-2.0-flash","outcome":"ok","latencyMs":412,"promptChars":1840,"approxPromptTokens":460,"maxTokens":220,"fallbackUsed":false,"failoverUsed":false,"endpoint":"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"}
```

Fields: provider, model, latency, prompt size + approximate tokens, token cap,
outcome (`ok`/`invalid`/`http_error`/`timeout`/`error`/`no_response`), whether
the deterministic fallback was used, and whether failover was used. No prompt
bodies, model output, API keys, or full URLs with query strings are logged.

Suggested alerts: rising `fallbackUsed=true` rate (provider reliability), rising
`latencyMs`, rising `approxPromptTokens` (context creep), and any
`outcome="invalid"` (guardrail/generation quality).

## Boundaries preserved

Model output is advisory and validated. It cannot authorize evidence release,
verdicts, canonical-truth reads, or case-state transitions; those remain
deterministic, server-side, and owner-gated. With `USE_LLM=false`, behavior is
byte-for-byte on the deterministic path used by the test harness.
