type ReviewContext = {
  userName: string;
  riskScore: number;
  reasons: string[];
  locationStatus: string;
  zoneType?: string | null;
  lateMinutes?: number;
  deviceKnown?: boolean;
};

export type AiReviewResult = {
  summary: string;
  recommendation: string;
  model: string;
};

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL_CANDIDATES = (process.env.OLLAMA_REVIEW_MODELS || 'gemma4:e2b,gemma3:4b,gemma3')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function buildPrompt(context: ReviewContext) {
  return [
    'You are an attendance security reviewer.',
    'Return a compact JSON object with keys: summary, recommendation.',
    'Recommendations must be one of: approve, review, block.',
    'Explain the main anomalies in plain English for a manager.',
    JSON.stringify(context),
  ].join('\n');
}

async function tryGenerate(model: string, context: ReviewContext): Promise<AiReviewResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        prompt: buildPrompt(context),
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = await response.json() as { response?: string };
    const raw = payload.response ? JSON.parse(payload.response) as { summary?: string; recommendation?: string } : null;
    if (!raw?.summary || !raw?.recommendation) return null;

    return {
      summary: String(raw.summary),
      recommendation: String(raw.recommendation),
      model,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAiReview(context: ReviewContext): Promise<AiReviewResult | null> {
  for (const model of MODEL_CANDIDATES) {
    const result = await tryGenerate(model, context);
    if (result) return result;
  }

  return null;
}
