// generate-clip — Submits a fal.ai video generation job for a shot.
// Creates an `assets` row in `generating` status with the returned job_id.
// Caller polls `check-generation` to advance status when the job finishes.
//
// Auth: requires the Supabase user access token in the Authorization header.
// Secrets: FAL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  reserveCredit,
  refundCredit,
  insufficientCreditsResponse,
} from "../_shared/billing.ts";
import {
  resolveVideoModel,
  clampDurationForModel,
} from "../_shared/pricing.ts";

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

// Default models and rough per-generation cost estimates (USD).
// Keep this list short — the user can override model_id from the UI.
const MODEL_DEFAULTS = {
  "text-to-video": {
    model_id: "fal-ai/veo3/fast",
    tool: "Veo 3 Fast",
    cost: 0.4,
  },
  "image-to-video": {
    model_id: "fal-ai/kling-video/v2.1/standard/image-to-video",
    tool: "Kling 2.1",
    cost: 0.35,
  },
} as const;

type GenMethod = keyof typeof MODEL_DEFAULTS;

function buildFalInput(
  method: GenMethod,
  prompt: string,
  falDuration: string, // pre-clamped by clampDurationForModel — same value billing used
  aspectRatio: string,
  referenceImageUrl: string | null,
  negativePrompt: string | null,
  seed: number | null,
) {
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    duration: falDuration,
  };
  if (method === "image-to-video") input.image_url = referenceImageUrl;
  if (negativePrompt) input.negative_prompt = negativePrompt;
  if (typeof seed === "number" && Number.isFinite(seed)) input.seed = seed;
  return input;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Missing Authorization header" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FAL_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_KEY) return json({ error: "FAL_API_KEY is not configured" }, 500);

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const {
      shot_id,
      brief_id,
      prompt,
      generation_method,
      reference_image_url,
      duration_seconds,
      aspect_ratio,
      model_id,
      tool_used,
      version,
      negative_prompt,
      audio_prompt,
      seed,
      render_tier,
      cost_estimate,
      ab_group_id,
      variant_label,
      frame_id,
      entity_type,
      entity_id,
      brand_id,
    } = body as Record<string, unknown>;

    if (!shot_id || typeof shot_id !== "string")
      return json({ error: "shot_id is required" }, 400);
    if (!prompt || typeof prompt !== "string" || !prompt.trim())
      return json({ error: "prompt is required" }, 400);

    const method: GenMethod =
      generation_method === "image-to-video" ? "image-to-video" : "text-to-video";
    if (method === "image-to-video" && !reference_image_url) {
      return json({ error: "reference_image_url is required for image-to-video" }, 400);
    }

    const defaults = MODEL_DEFAULTS[method];
    const finalModelId = (typeof model_id === "string" && model_id) || defaults.model_id;

    // ---- HARD ALLOWLIST: only catalogued models may generate. ----
    // Billing prices exclusively from the catalog; client cost_estimate is
    // display-only and never used for money.
    const catalogEntry = resolveVideoModel(finalModelId, method);
    if (!catalogEntry) {
      return json(
        {
          error: "model_not_supported",
          detail:
            `Model "${finalModelId}" is not in the server catalog for ${method}. ` +
            "Add it to VIDEO_MODEL_CATALOG (with verified pricing) to enable it.",
        },
        400,
      );
    }
    const finalTool = (typeof tool_used === "string" && tool_used) || catalogEntry.label;
    const { billSeconds, falDuration } = clampDurationForModel(
      catalogEntry,
      Number(duration_seconds) || 8,
    );
    const finalAspect = (typeof aspect_ratio === "string" && aspect_ratio) || "9:16";

    const negative =
      typeof negative_prompt === "string" && negative_prompt.trim()
        ? negative_prompt.trim()
        : null;
    const audio =
      typeof audio_prompt === "string" && audio_prompt.trim()
        ? audio_prompt.trim()
        : null;
    const seedNum =
      typeof seed === "number" && Number.isFinite(seed) ? Math.floor(seed) : null;

    const tier: "draft" | "final" =
      render_tier === "final" ? "final" : "draft";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ---- OWNERSHIP: the shot must belong to the caller. ----
    // Attribution (brief/brand) is DERIVED server-side from the shot's
    // lineage — client-supplied brand_id/brief_id are ignored for billing.
    const { data: shotRow, error: shotErr } = await admin
      .from("shots")
      .select(
        "id, user_id, script:script_id ( id, angle:angle_id ( id, brief:brief_id ( id, brand_id ) ) )",
      )
      .eq("id", shot_id)
      .maybeSingle();
    if (shotErr || !shotRow) return json({ error: "Shot not found" }, 404);
    if (shotRow.user_id !== userId) return json({ error: "not_owner" }, 403);
    type Lineage = {
      script?: { angle?: { brief?: { id?: string; brand_id?: string | null } | null } | null } | null;
    };
    const lineageBrief = (shotRow as unknown as Lineage).script?.angle?.brief ?? null;
    const derivedBriefId = lineageBrief?.id ?? null;
    const derivedBrandId = lineageBrief?.brand_id ?? null;

    // ---- Reserve credits BEFORE calling fal.ai ----
    // Priced exclusively from the server catalog at the CLAMPED duration —
    // the same seconds the model will actually generate.
    const estimatedUsd =
      Math.round(catalogEntry.usdPerSecond * billSeconds * 10000) / 10000;

    const reservation = await reserveCredit(admin, {
      user_id: userId,
      estimated_usd: estimatedUsd,
      operation: "video_generation",
      model_id: finalModelId,
      entity_type: "shot",
      entity_id: shot_id as string,
      brand_id: derivedBrandId,
      brief_id: derivedBriefId,
    });
    if (!reservation.ok) {
      const status = reservation.code === "insufficient_credits" ? 402 : 403;
      return json(insufficientCreditsResponse(reservation), status);
    }
    const reservationId = reservation.ledger_id;

    // Submit to fal queue
    const falInput = buildFalInput(
      method,
      prompt,
      falDuration,
      finalAspect,
      typeof reference_image_url === "string" ? reference_image_url : null,
      negative,
      seedNum,
    );
    // Veo supports a separate audio cue line — append it as a hint.
    if (audio && /veo/i.test(finalModelId)) {
      (falInput as Record<string, unknown>).prompt = `${prompt}\n\nAudio: ${audio}`;
    }

    const falRes = await fetch(`https://queue.fal.run/${finalModelId}`, {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(falInput),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      console.error("fal submit failed", falRes.status, errText);
      await refundCredit(admin, reservationId);
      return json({ error: `fal.ai submit failed (${falRes.status})`, detail: errText }, 502);
    }
    const falData = await falRes.json();
    const jobId: string | undefined = falData?.request_id;
    if (!jobId) {
      await refundCredit(admin, reservationId);
      return json({ error: "fal.ai did not return a request_id", detail: falData }, 502);
    }
    const falStatusUrl: string | null =
      typeof falData?.status_url === "string" ? falData.status_url : null;
    const falResponseUrl: string | null =
      typeof falData?.response_url === "string" ? falData.response_url : null;

    const assetVersion =
      typeof version === "number" && version > 0 ? Math.floor(version) : 1;

    const { data: inserted, error: insErr } = await admin
      .from("assets")
      .insert({
        user_id: userId,
        shot_id,
        brief_id: derivedBriefId,
        type: "clip",
        status: "generating",
        version: assetVersion,
        tool_used: finalTool,
        model_id: finalModelId,
        job_id: jobId,
        prompt_used: prompt,
        negative_used: negative,
        audio_used: audio,
        seed_used: seedNum,
        generation_method: method,
        reference_image_url:
          typeof reference_image_url === "string" ? reference_image_url : null,
        duration_seconds: billSeconds,
        cost_estimate: estimatedUsd,
        render_tier: tier,
        is_selected: false,
        ab_group_id:
          typeof ab_group_id === "string" && ab_group_id.trim()
            ? ab_group_id.trim()
            : null,
        variant_label:
          typeof variant_label === "string" && variant_label.trim()
            ? variant_label.trim()
            : null,
        frame_id: typeof frame_id === "string" && frame_id ? frame_id : null,
        usage_meta: {
          reservation_ledger_id: reservationId,
          reserved_usd: estimatedUsd,
          fal_status_url: falStatusUrl,
          fal_response_url: falResponseUrl,
        },
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("asset insert failed", insErr);
      await refundCredit(admin, reservationId);
      return json({ error: insErr.message }, 500);
    }

    return json({
      asset_id: inserted.id,
      job_id: jobId,
      model_id: finalModelId,
      reservation_ledger_id: reservationId,
      charged_amount: reservation.charged_amount,
      currency: reservation.currency,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-clip error", msg);
    return json({ error: msg }, 500);
  }
});