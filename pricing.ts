// Provider pricing tables for computing the *actual* spend per generation.
// fal.ai bills deterministically per model+duration; ElevenLabs per character;
// Anthropic per input/output token. These rates are USD and updated manually.

// fal.ai: cost per second of generated video, keyed by model_id prefix match.
// Source: fal.ai model pricing pages (2025). Update as pricing changes.
const FAL_PER_SECOND: Array<{ match: RegExp; usdPerSecond: number; label: string }> = [
  { match: /veo3\/fast/i, usdPerSecond: 0.10, label: "Veo 3 Fast" },
  { match: /veo3/i, usdPerSecond: 0.50, label: "Veo 3" },
  { match: /veo2/i, usdPerSecond: 0.50, label: "Veo 2" },
  { match: /kling-video\/v2\.1\/master/i, usdPerSecond: 0.28, label: "Kling 2.1 Master" },
  { match: /kling-video\/v2\.1\/pro/i, usdPerSecond: 0.09, label: "Kling 2.1 Pro" },
  { match: /kling-video\/v2\.1\/standard/i, usdPerSecond: 0.05, label: "Kling 2.1 Standard" },
  { match: /kling-video\/v2/i, usdPerSecond: 0.09, label: "Kling 2.0" },
  { match: /kling-video/i, usdPerSecond: 0.05, label: "Kling" },
  { match: /runway.*gen4|gen-4/i, usdPerSecond: 0.10, label: "Runway Gen-4" },
  { match: /runway/i, usdPerSecond: 0.10, label: "Runway" },
  { match: /minimax|hailuo/i, usdPerSecond: 0.08, label: "MiniMax" },
  { match: /pika/i, usdPerSecond: 0.08, label: "Pika" },
];

export function falActualCost(modelId: string, durationSeconds: number): {
  cost: number;
  rate: number;
  matched: string;
} | null {
  if (!modelId || !durationSeconds || durationSeconds <= 0) return null;
  for (const row of FAL_PER_SECOND) {
    if (row.match.test(modelId)) {
      const cost = Math.round(row.usdPerSecond * durationSeconds * 10000) / 10000;
      return { cost, rate: row.usdPerSecond, matched: row.label };
    }
  }
  return null;
}

// ElevenLabs: $0.30 per 1,000 characters on the Starter tier (default reference).
// Higher tiers are cheaper; this is a conservative upper bound.
export const ELEVENLABS_USD_PER_CHAR = 0.0003;
export function elevenlabsActualCost(chars: number): number {
  if (!chars || chars <= 0) return 0;
  return Math.round(chars * ELEVENLABS_USD_PER_CHAR * 10000) / 10000;
}

// fal.ai image generation: cost per image, keyed by model_id prefix match.
// Source: fal.ai model pricing pages (2025). Update as pricing changes.
const FAL_IMAGE_PER_IMAGE: Array<{ match: RegExp; usdPerImage: number; label: string }> = [
  { match: /flux-2\/pro/i, usdPerImage: 0.05, label: "Flux 2 Pro" },
  { match: /flux-2\/flash/i, usdPerImage: 0.01, label: "Flux 2 Flash" },
  { match: /flux-pro\/kontext/i, usdPerImage: 0.04, label: "Flux Kontext (edit)" },
  { match: /flux-pro/i, usdPerImage: 0.05, label: "Flux Pro" },
  { match: /flux\/dev/i, usdPerImage: 0.025, label: "Flux Dev" },
  { match: /flux/i, usdPerImage: 0.03, label: "Flux" },
  { match: /ideogram\/v3/i, usdPerImage: 0.04, label: "Ideogram V3" },
  { match: /ideogram/i, usdPerImage: 0.04, label: "Ideogram" },
  { match: /seedream\/v4\.5-lite|seedream\/v4\.5\/lite|seedream.*lite/i, usdPerImage: 0.01, label: "Seedream 4.5 Lite" },
  { match: /seedream\/v4\.5\/edit|seedream.*edit/i, usdPerImage: 0.04, label: "Seedream 4.5 Edit" },
  { match: /seedream\/v4\.5/i, usdPerImage: 0.03, label: "Seedream 4.5" },
  { match: /seedream/i, usdPerImage: 0.03, label: "Seedream" },
  { match: /imagen4|imagen-4/i, usdPerImage: 0.04, label: "Imagen 4" },
  { match: /recraft/i, usdPerImage: 0.04, label: "Recraft" },
];

export function falImageActualCost(modelId: string, images = 1): {
  cost: number;
  rate: number;
  matched: string;
} | null {
  if (!modelId) return null;
  const n = Math.max(1, images);
  for (const row of FAL_IMAGE_PER_IMAGE) {
    if (row.match.test(modelId)) {
      const cost = Math.round(row.usdPerImage * n * 10000) / 10000;
      return { cost, rate: row.usdPerImage, matched: row.label };
    }
  }
  return null;
}

// Anthropic pricing per 1M tokens (USD). Update as Anthropic publishes new prices.
const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  // Claude 4 family
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-opus-4-1": { input: 15, output: 75 },
  "claude-opus-4": { input: 15, output: 75 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  // 3.x
  "claude-3-5-sonnet": { input: 3, output: 15 },
  "claude-3-5-haiku": { input: 0.8, output: 4 },
  "claude-3-opus": { input: 15, output: 75 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
};

export function anthropicActualCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { cost: number; rateIn: number; rateOut: number } {
  const key = Object.keys(ANTHROPIC_PRICING).find((k) => model.startsWith(k)) ?? "";
  const rates = ANTHROPIC_PRICING[key] ?? { input: 3, output: 15 };
  const cost =
    (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
  return {
    cost: Math.round(cost * 100000) / 100000,
    rateIn: rates.input,
    rateOut: rates.output,
  };
}
// ============================================================
// VIDEO MODEL CATALOG — the single server-side source of truth.
// Only slugs listed here may be generated. Billing NEVER trusts a
// client-supplied cost estimate; it prices from this table only.
// To add a model: verify the exact slug + $/sec on fal.ai, add a row.
// ============================================================
export type VideoModelEntry = {
  slug: string;
  label: string;
  usdPerSecond: number;
  methods: Array<"text-to-video" | "image-to-video">;
  // How the fal input's `duration` field must be shaped for this family.
  durationMode: "veo" | "kling";
};

export const VIDEO_MODEL_CATALOG: VideoModelEntry[] = [
  { slug: "fal-ai/veo3/fast", label: "Veo 3 Fast", usdPerSecond: 0.10, methods: ["text-to-video"], durationMode: "veo" },
  { slug: "fal-ai/veo3", label: "Veo 3", usdPerSecond: 0.50, methods: ["text-to-video"], durationMode: "veo" },
  { slug: "fal-ai/kling-video/v2.1/standard/text-to-video", label: "Kling 2.1 Standard", usdPerSecond: 0.05, methods: ["text-to-video"], durationMode: "kling" },
  { slug: "fal-ai/kling-video/v2.1/standard/image-to-video", label: "Kling 2.1 Standard (I2V)", usdPerSecond: 0.05, methods: ["image-to-video"], durationMode: "kling" },
  { slug: "fal-ai/kling-video/v2.1/master/text-to-video", label: "Kling 2.1 Master", usdPerSecond: 0.28, methods: ["text-to-video"], durationMode: "kling" },
  { slug: "fal-ai/kling-video/v2.1/master/image-to-video", label: "Kling 2.1 Master (I2V)", usdPerSecond: 0.28, methods: ["image-to-video"], durationMode: "kling" },
];

export function resolveVideoModel(
  modelId: string,
  method: "text-to-video" | "image-to-video",
): VideoModelEntry | null {
  const entry = VIDEO_MODEL_CATALOG.find((m) => m.slug === modelId);
  if (!entry) return null;
  if (!entry.methods.includes(method)) return null;
  return entry;
}

// Clamp the requested duration to what the model family actually accepts,
// and return BOTH the billing seconds and the fal input value — so the
// amount billed always matches the duration actually generated.
export function clampDurationForModel(
  entry: VideoModelEntry,
  requestedSeconds: number,
): { billSeconds: number; falDuration: string } {
  const req = Number(requestedSeconds) || 8;
  if (entry.durationMode === "veo") {
    const s = Math.max(4, Math.min(8, Math.round(req)));
    return { billSeconds: s, falDuration: `${s}s` };
  }
  // kling accepts "5" or "10"
  const s = req >= 8 ? 10 : 5;
  return { billSeconds: s, falDuration: String(s) };
}

// Conservative fallback used when an image model isn't matched:
// never bill from a client-supplied number.
export const IMAGE_FALLBACK_USD = 0.05;
