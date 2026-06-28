// generate-clip — Submits a fal.ai video generation job for a shot.
// Creates an `assets` row in `generating` status with the returned job_id.
// Caller polls `check-generation` to advance status when the job finishes.
//
// Auth: requires the Supabase user access token in the Authorization header.
// Secrets: FAL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
  durationSeconds: number,
  aspectRatio: string,
  referenceImageUrl: string | null,
) {
  // Veo3 expects duration as a string like "8s"; Kling expects "5"/"10".
  if (method === "text-to-video") {
    return {
      prompt,
      aspect_ratio: aspectRatio,
      duration: `${Math.max(4, Math.min(8, durationSeconds || 8))}s`,
    };
  }
  return {
    prompt,
    image_url: referenceImageUrl,
    duration: String(durationSeconds >= 8 ? 10 : 5),
    aspect_ratio: aspectRatio,
  };
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
    const finalTool = (typeof tool_used === "string" && tool_used) || defaults.tool;
    const finalDuration = Number(duration_seconds) || 8;
    const finalAspect = (typeof aspect_ratio === "string" && aspect_ratio) || "9:16";

    // Submit to fal queue
    const falInput = buildFalInput(
      method,
      prompt,
      finalDuration,
      finalAspect,
      typeof reference_image_url === "string" ? reference_image_url : null,
    );

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
      return json({ error: `fal.ai submit failed (${falRes.status})`, detail: errText }, 502);
    }
    const falData = await falRes.json();
    const jobId: string | undefined = falData?.request_id;
    if (!jobId) {
      return json({ error: "fal.ai did not return a request_id", detail: falData }, 502);
    }

    // Admin client for the insert
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const assetVersion =
      typeof version === "number" && version > 0 ? Math.floor(version) : 1;

    const { data: inserted, error: insErr } = await admin
      .from("assets")
      .insert({
        user_id: userId,
        shot_id,
        brief_id: typeof brief_id === "string" ? brief_id : null,
        type: "clip",
        status: "generating",
        version: assetVersion,
        tool_used: finalTool,
        model_id: finalModelId,
        job_id: jobId,
        prompt_used: prompt,
        generation_method: method,
        reference_image_url:
          typeof reference_image_url === "string" ? reference_image_url : null,
        duration_seconds: finalDuration,
        cost_estimate: defaults.cost,
        is_selected: false,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("asset insert failed", insErr);
      return json({ error: insErr.message }, 500);
    }

    return json({ asset_id: inserted.id, job_id: jobId, model_id: finalModelId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-clip error", msg);
    return json({ error: msg }, 500);
  }
});