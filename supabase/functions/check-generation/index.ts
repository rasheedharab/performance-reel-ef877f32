// check-generation — Polls fal.ai for a queued job and updates the asset row.
// When the job completes, downloads the video and re-hosts it in the
// `campaign-assets` storage bucket so it survives fal's CDN expiration.
//
// Auth: requires the Supabase user access token in the Authorization header.
// Secrets: FAL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { falActualCost } from "../_shared/pricing.ts";
import { captureCredit, refundCredit } from "../_shared/billing.ts";

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

function pickVideoUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  // Common shapes across fal models
  const v = r.video as Record<string, unknown> | string | undefined;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof v.url === "string") return v.url;
  const videos = r.videos as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(videos) && videos[0]?.url && typeof videos[0].url === "string") {
    return videos[0].url as string;
  }
  if (typeof r.url === "string") return r.url;
  return null;
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify caller
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const assetId = (body as Record<string, unknown>).asset_id as string | undefined;
    if (!assetId) return json({ error: "asset_id is required" }, 400);

    const { data: asset, error: aErr } = await admin
      .from("assets")
      .select("id, user_id, brief_id, shot_id, model_id, job_id, status, file_url, duration_seconds, usage_meta")
      .eq("id", assetId)
      .maybeSingle();
    if (aErr || !asset) return json({ error: "Asset not found" }, 404);
    if (asset.user_id !== userId) return json({ error: "Forbidden" }, 403);

    // Terminal state — nothing to poll.
    if (
      asset.status !== "generating" ||
      !asset.job_id ||
      !asset.model_id
    ) {
      return json({ status: asset.status, file_url: asset.file_url });
    }

    const reservationLedgerId =
      (asset.usage_meta as Record<string, unknown> | null)?.reservation_ledger_id as
        | string
        | undefined;

    // fal.ai queue status/result endpoints live at the full model endpoint id.
    // e.g. "fal-ai/veo3/fast", "fal-ai/kling-video/v2.1/standard/text-to-video".
    const appId = asset.model_id;

    const statusRes = await fetch(
      `https://queue.fal.run/${appId}/requests/${asset.job_id}/status`,
      { headers: { "Authorization": `Key ${FAL_KEY}` } },
    );
    if (!statusRes.ok) {
      const text = await statusRes.text();
      console.error("fal status fail", statusRes.status, text);
      return json({ error: "fal status fetch failed", detail: text }, 502);
    }
    const statusData = await statusRes.json();
    const falStatus: string = statusData?.status ?? "UNKNOWN";

    if (falStatus === "IN_QUEUE" || falStatus === "IN_PROGRESS") {
      return json({ status: "generating", fal_status: falStatus });
    }

    if (falStatus === "COMPLETED") {
      // Fetch result body
      const resultRes = await fetch(
        `https://queue.fal.run/${appId}/requests/${asset.job_id}`,
        { headers: { "Authorization": `Key ${FAL_KEY}` } },
      );
      if (!resultRes.ok) {
        const text = await resultRes.text();
        return json({ error: "fal result fetch failed", detail: text }, 502);
      }
      const result = await resultRes.json();
      const videoUrl = pickVideoUrl(result);
      if (!videoUrl) {
        await admin.from("assets").update({
          status: "rejected",
          error_message: "fal job completed but no video URL was returned",
        }).eq("id", assetId);
        return json({ status: "rejected", error: "No video URL in fal result" });
      }

      // Re-host the file in the campaign-assets bucket so it doesn't expire.
      let storedPath = videoUrl;
      try {
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) throw new Error(`download ${videoRes.status}`);
        const buf = new Uint8Array(await videoRes.arrayBuffer());
        const ext = videoUrl.split("?")[0].split(".").pop()?.toLowerCase() || "mp4";
        const safeExt = ["mp4", "webm", "mov", "m4v"].includes(ext) ? ext : "mp4";
        const folder = asset.brief_id ?? asset.shot_id ?? "misc";
        const path = `${userId}/${folder}/clip-${assetId}.${safeExt}`;
        const up = await admin.storage
          .from("campaign-assets")
          .upload(path, buf, {
            contentType: `video/${safeExt}`,
            upsert: true,
          });
        if (up.error) throw up.error;
        storedPath = path;
      } catch (storageErr) {
        // Fall back to the fal URL if re-hosting fails; surface as a note.
        console.warn("storage upload failed, keeping fal URL", storageErr);
      }

      const { error: updErr } = await admin
        .from("assets")
        .update({
          status: "review",
          file_url: storedPath,
          error_message: null,
          ...(() => {
            const dur =
              (result?.video?.duration as number | undefined) ||
              (result?.duration as number | undefined) ||
              (asset.duration_seconds as number | undefined) ||
              0;
            const priced = falActualCost(asset.model_id ?? "", Number(dur) || 0);
            if (!priced) return {};
            return {
              actual_cost: priced.cost,
              cost_source: `fal.ai · ${priced.matched} @ $${priced.rate}/s`,
              usage_meta: {
                provider: "fal.ai",
                model_id: asset.model_id,
                duration_seconds: Number(dur) || null,
                rate_per_second: priced.rate,
                metrics: result?.metrics ?? null,
                reservation_ledger_id: reservationLedgerId ?? null,
              },
            };
          })(),
        })
        .eq("id", assetId);
      if (updErr) return json({ error: updErr.message }, 500);

      // Capture the held credits against the actual provider spend.
      if (reservationLedgerId) {
        const dur =
          (result?.video?.duration as number | undefined) ||
          (result?.duration as number | undefined) ||
          (asset.duration_seconds as number | undefined) ||
          0;
        const priced = falActualCost(asset.model_id ?? "", Number(dur) || 0);
        await captureCredit(admin, reservationLedgerId, priced?.cost ?? 0);
      }

      return json({ status: "review", file_url: storedPath });
    }

    // Any other terminal state is treated as failure.
    const errorMessage =
      typeof statusData?.error === "string"
        ? statusData.error
        : `fal job ended in ${falStatus}`;
    await admin
      .from("assets")
      .update({ status: "rejected", error_message: errorMessage })
      .eq("id", assetId);
    if (reservationLedgerId) {
      await refundCredit(admin, reservationLedgerId);
    }
    return json({ status: "rejected", error: errorMessage });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("check-generation error", msg);
    return json({ error: msg }, 500);
  }
});