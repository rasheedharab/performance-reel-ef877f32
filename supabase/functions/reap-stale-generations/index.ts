// reap-stale-generations — Resolves generation jobs abandoned mid-flight.
//
// Problem: check-generation is driven by the user's browser. If the tab
// closes while a job runs, the asset stays "generating" forever and its
// credit reservation keeps reducing the user's available balance for life.
//
// This function scans for assets stuck in "generating" older than
// STALE_AFTER_MINUTES, polls fal one final time, and either:
//   - completes them (stores the fal video URL, captures the reservation), or
//   - fails them (status "rejected", refunds the reservation in full).
//
// Auth: requires header  x-reaper-secret: <REAPER_SECRET>  — set the
// REAPER_SECRET function secret, and schedule this via Supabase's cron
// (see migration) or any external scheduler, every 15 minutes.
//
// Secrets: FAL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REAPER_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { falActualCost } from "../_shared/pricing.ts";
import { captureCredit, refundCredit } from "../_shared/billing.ts";

const STALE_AFTER_MINUTES = 45;
const BATCH_LIMIT = 25;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function pickVideoUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const v = r.video as Record<string, unknown> | string | undefined;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof v.url === "string") return v.url;
  const videos = r.videos as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(videos) && typeof videos[0]?.url === "string") {
    return videos[0].url as string;
  }
  if (typeof r.url === "string") return r.url;
  return null;
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get("REAPER_SECRET");
    if (!secret || req.headers.get("x-reaper-secret") !== secret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FAL_KEY = Deno.env.get("FAL_API_KEY");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const cutoff = new Date(
      Date.now() - STALE_AFTER_MINUTES * 60 * 1000,
    ).toISOString();

    const { data: stale, error: qErr } = await admin
      .from("assets")
      .select("id, user_id, model_id, job_id, status, duration_seconds, usage_meta, created_at")
      .eq("status", "generating")
      .lt("created_at", cutoff)
      .limit(BATCH_LIMIT);
    if (qErr) return json({ error: qErr.message }, 500);
    if (!stale?.length) return json({ reaped: 0, completed: 0, failed: 0 });

    let completed = 0;
    let failed = 0;

    for (const asset of stale) {
      const meta = (asset.usage_meta as Record<string, unknown> | null) ?? {};
      const ledgerId =
        typeof meta.reservation_ledger_id === "string"
          ? meta.reservation_ledger_id
          : null;
      const statusUrl =
        typeof meta.fal_status_url === "string" ? meta.fal_status_url : null;
      const responseUrl =
        typeof meta.fal_response_url === "string" ? meta.fal_response_url : null;

      let finished = false;
      let videoUrl: string | null = null;
      let resultDuration = 0;

      // One last poll — the job may simply have finished after the tab closed.
      if (FAL_KEY && statusUrl) {
        try {
          const sRes = await fetch(statusUrl, {
            headers: { Authorization: `Key ${FAL_KEY}` },
          });
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData?.status === "COMPLETED" && responseUrl) {
              const rRes = await fetch(responseUrl, {
                headers: { Authorization: `Key ${FAL_KEY}` },
              });
              if (rRes.ok) {
                const result = await rRes.json();
                videoUrl = pickVideoUrl(result);
                resultDuration =
                  (result?.video?.duration as number | undefined) ||
                  (result?.duration as number | undefined) ||
                  0;
                finished = Boolean(videoUrl);
              }
            }
          }
        } catch (e) {
          console.error("reaper poll failed", asset.id, e);
        }
      }

      if (finished && videoUrl) {
        // Complete: store the fal CDN URL directly (re-hosting is the
        // interactive path's job); capture the hold at real or reserved cost.
        const dur = Number(resultDuration) || Number(asset.duration_seconds) || 0;
        const priced = falActualCost(asset.model_id ?? "", dur);
        const reservedUsd = Number(meta.reserved_usd);
        const captureUsd =
          priced?.cost ??
          (Number.isFinite(reservedUsd) && reservedUsd > 0 ? reservedUsd : 4);
        await admin
          .from("assets")
          .update({
            status: "review",
            file_url: videoUrl,
            error_message: null,
            notes: "Recovered by reaper after client stopped polling.",
          })
          .eq("id", asset.id);
        if (ledgerId) await captureCredit(admin, ledgerId, captureUsd);
        completed++;
      } else {
        // Fail: reject the asset and give the money back in full.
        await admin
          .from("assets")
          .update({
            status: "rejected",
            error_message:
              `Timed out after ${STALE_AFTER_MINUTES} minutes — reservation refunded.`,
          })
          .eq("id", asset.id);
        if (ledgerId) await refundCredit(admin, ledgerId);
        failed++;
      }
    }

    return json({ reaped: stale.length, completed, failed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("reap-stale-generations error", msg);
    return json({ error: msg }, 500);
  }
});
