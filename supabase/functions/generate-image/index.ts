// generate-image — Calls fal.ai image endpoints (text-to-image or image-edit)
// and stores the resulting still in the `campaign-assets` bucket. Inserts a
// `frames` row tracking purpose, prompt, model, cost, and status.
//
// Auth: requires the Supabase user access token in the Authorization header.
// Secrets: FAL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { falImageActualCost } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BUCKET = "campaign-assets";

// Build the fal.ai input payload. Image-edit models expect `image_url`
// (single) or `image_urls` (multi); text-to-image models just take prompt.
function buildFalInput(
  modelId: string,
  prompt: string,
  negative: string | null,
  aspect: string,
  seed: number | null,
  refs: string[],
): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt };
  if (negative) input.negative_prompt = negative;
  if (typeof seed === "number" && Number.isFinite(seed)) input.seed = seed;

  // Aspect ratio mapping. Most fal.ai image models accept either
  // `aspect_ratio` or `image_size`. We send both for compatibility — fal.ai
  // ignores unknown fields.
  if (aspect) input.aspect_ratio = aspect;
  const sizeMap: Record<string, string> = {
    "1:1": "square_hd",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
    "4:3": "landscape_4_3",
    "3:4": "portrait_4_3",
  };
  if (sizeMap[aspect]) input.image_size = sizeMap[aspect];

  if (refs.length > 0) {
    // Edit / reference-aware endpoints
    if (/kontext|edit|seedream/i.test(modelId)) {
      input.image_url = refs[0];
      if (refs.length > 1) input.image_urls = refs;
    } else {
      // Most other image models accept image_urls for reference conditioning.
      input.image_urls = refs;
    }
  }
  return input;
}

// Poll fal.ai queue until completed or failed.
async function pollFal(
  statusUrl: string,
  responseUrl: string,
  falKey: string,
  maxMs = 110_000,
): Promise<Record<string, unknown>> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const r = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
    });
    if (!r.ok) throw new Error(`fal status ${r.status}: ${await r.text()}`);
    const s = (await r.json()) as Record<string, unknown>;
    const status = String(s.status ?? "");
    if (status === "COMPLETED") {
      const f = await fetch(responseUrl, {
        headers: { Authorization: `Key ${falKey}` },
      });
      if (!f.ok) throw new Error(`fal response ${f.status}: ${await f.text()}`);
      return (await f.json()) as Record<string, unknown>;
    }
    if (status === "FAILED" || status === "ERROR") {
      throw new Error(`fal job failed: ${JSON.stringify(s)}`);
    }
    await new Promise((res) => setTimeout(res, 2500));
  }
  throw new Error("fal image generation timed out");
}

function extractImageUrl(result: Record<string, unknown>): string | null {
  const imgs = (result.images ?? (result as { data?: { images?: unknown } })?.data?.images) as
    | unknown
    | undefined;
  if (Array.isArray(imgs) && imgs.length > 0) {
    const first = imgs[0] as { url?: string } | string;
    if (typeof first === "string") return first;
    if (first && typeof first.url === "string") return first.url;
  }
  const single = (result as { image?: { url?: string } }).image;
  if (single && typeof single.url === "string") return single.url;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const FAL_KEY = Deno.env.get("FAL_API_KEY");

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Missing Authorization header" }, 401);
  if (!FAL_KEY) return json({ error: "FAL_API_KEY is not configured" }, 500);

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userRes.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Parse + validate body
  const body = await req.json().catch(() => ({}));
  const {
    prompt,
    negative_prompt,
    model_id,
    aspect_ratio,
    seed,
    reference_image_urls,
    shot_id,
    brief_id,
    brand_id,
    purpose,
    version,
    cost_estimate,
  } = body as Record<string, unknown>;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return json({ error: "prompt is required" }, 400);
  }
  if (!model_id || typeof model_id !== "string") {
    return json({ error: "model_id is required" }, 400);
  }

  const refs = Array.isArray(reference_image_urls)
    ? (reference_image_urls as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const negative =
    typeof negative_prompt === "string" && negative_prompt.trim()
      ? negative_prompt.trim()
      : null;
  const aspect = typeof aspect_ratio === "string" && aspect_ratio ? aspect_ratio : "9:16";
  const seedNum =
    typeof seed === "number" && Number.isFinite(seed) ? Math.floor(seed) : null;
  const purposeVal =
    typeof purpose === "string" && purpose ? purpose : "anchor_frame";

  // Pre-insert a `frames` row in `generating` status so the UI can track it.
  const { data: inserted, error: insErr } = await admin
    .from("frames")
    .insert({
      user_id: userId,
      shot_id: typeof shot_id === "string" ? shot_id : null,
      brief_id: typeof brief_id === "string" ? brief_id : null,
      brand_id: typeof brand_id === "string" ? brand_id : null,
      purpose: purposeVal,
      image_prompt: prompt,
      negative_prompt: negative,
      model_id,
      aspect_ratio: aspect,
      seed: seedNum,
      reference_image_urls: refs,
      status: "generating",
      version:
        typeof version === "number" && version > 0 ? Math.floor(version) : 1,
      cost_estimate:
        typeof cost_estimate === "number" && Number.isFinite(cost_estimate)
          ? cost_estimate
          : null,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return json({ error: insErr?.message ?? "frame insert failed" }, 500);
  }
  const frameId = inserted.id as string;

  try {
    const input = buildFalInput(model_id, prompt.trim(), negative, aspect, seedNum, refs);

    // Submit job. fal.ai image endpoints accept either /fal.run (sync) or
    // queue.fal.run (async). We use the queue for consistent behavior with
    // generate-clip and to survive longer renders.
    const submit = await fetch(`https://queue.fal.run/${model_id}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!submit.ok) {
      const text = await submit.text();
      throw new Error(`fal submit ${submit.status}: ${text}`);
    }
    const submitData = (await submit.json()) as Record<string, unknown>;
    const jobId = String(submitData.request_id ?? "");
    const statusUrl =
      typeof submitData.status_url === "string"
        ? (submitData.status_url as string)
        : `https://queue.fal.run/${model_id}/requests/${jobId}/status`;
    const responseUrl =
      typeof submitData.response_url === "string"
        ? (submitData.response_url as string)
        : `https://queue.fal.run/${model_id}/requests/${jobId}`;

    // Record job id while we wait so the UI can correlate.
    await admin.from("frames").update({ job_id: jobId }).eq("id", frameId);

    const result = await pollFal(statusUrl, responseUrl, FAL_KEY);
    const imageUrl = extractImageUrl(result);
    if (!imageUrl) {
      throw new Error("fal returned no image url");
    }

    // Download and re-upload to our private bucket.
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`download image ${imgRes.status}`);
    const contentType = imgRes.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("webp")
      ? "webp"
      : "png";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const storagePath = `${userId}/frames/${frameId}-v${
      typeof version === "number" ? version : 1
    }.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(
      storagePath,
      bytes,
      { contentType, upsert: true, cacheControl: "3600" },
    );
    if (upErr) throw new Error(`storage upload: ${upErr.message}`);

    // Compute actual cost from pricing table.
    const price = falImageActualCost(model_id, 1);

    const { error: updErr } = await admin
      .from("frames")
      .update({
        file_url: storagePath,
        status: "review",
        actual_cost: price?.cost ?? null,
        cost_source: price ? `fal.ai · ${price.matched} @ $${price.rate}/img` : null,
        usage_meta: { provider: "fal", model_id, job_id: jobId },
        error_message: null,
      })
      .eq("id", frameId);
    if (updErr) throw new Error(updErr.message);

    return json({
      frame_id: frameId,
      file_url: storagePath,
      model_id,
      job_id: jobId,
      actual_cost: price?.cost ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-image error", msg);
    await admin
      .from("frames")
      .update({ status: "rejected", error_message: msg })
      .eq("id", frameId);
    return json({ error: msg, frame_id: frameId }, 500);
  }
});