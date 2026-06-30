// generate-voiceover — Calls ElevenLabs TTS, stores the mp3 in `campaign-assets`,
// and inserts an asset row of type `voiceover` ready for review.
//
// Auth: requires the Supabase user access token in the Authorization header.
// Secrets: ELEVENLABS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { elevenlabsActualCost, ELEVENLABS_USD_PER_CHAR } from "../_shared/pricing.ts";

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

// Rough character-based cost estimate (ElevenLabs ~ $0.30 / 1000 chars at base tier).
const COST_PER_CHAR = 0.0003;
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const DEFAULT_VOICE_LABEL = "ElevenLabs · Rachel";
const DEFAULT_MODEL = "eleven_multilingual_v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Missing Authorization header" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVEN_KEY) return json({ error: "ELEVENLABS_API_KEY is not configured" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const {
      brief_id,
      source_text,
      voice_id,
      voice_label,
      model_id,
    } = body as Record<string, unknown>;

    if (!brief_id || typeof brief_id !== "string")
      return json({ error: "brief_id is required" }, 400);
    if (!source_text || typeof source_text !== "string" || !source_text.trim())
      return json({ error: "source_text is required" }, 400);

    const finalVoice = (typeof voice_id === "string" && voice_id) || DEFAULT_VOICE_ID;
    const finalLabel =
      (typeof voice_label === "string" && voice_label) || DEFAULT_VOICE_LABEL;
    const finalModel = (typeof model_id === "string" && model_id) || DEFAULT_MODEL;

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoice}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVEN_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: source_text,
          model_id: finalModel,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("elevenlabs fail", ttsRes.status, errText);
      return json(
        { error: `ElevenLabs request failed (${ttsRes.status})`, detail: errText },
        502,
      );
    }

    const audioBytes = new Uint8Array(await ttsRes.arrayBuffer());
    const path = `${userId}/${brief_id}/voiceover-${crypto.randomUUID()}.mp3`;
    const up = await admin.storage
      .from("campaign-assets")
      .upload(path, audioBytes, { contentType: "audio/mpeg", upsert: false });
    if (up.error) {
      console.error("storage upload failed", up.error);
      return json({ error: up.error.message }, 500);
    }

    const chars = source_text.length;
    const cost = elevenlabsActualCost(chars);

    const { data: inserted, error: insErr } = await admin
      .from("assets")
      .insert({
        user_id: userId,
        brief_id,
        shot_id: null,
        type: "voiceover",
        status: "review",
        file_url: path,
        voice_id: finalLabel,
        source_text,
        tool_used: finalLabel,
        model_id: finalModel,
        cost_estimate: cost,
        actual_cost: cost,
        cost_source: `ElevenLabs · ${chars} chars @ $${ELEVENLABS_USD_PER_CHAR}/char`,
        usage_meta: {
          provider: "elevenlabs",
          model_id: finalModel,
          voice_id: finalVoice,
          character_count: chars,
          rate_per_char: ELEVENLABS_USD_PER_CHAR,
        },
        is_selected: false,
      })
      .select("id")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ asset_id: inserted.id, file_url: path });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-voiceover error", msg);
    return json({ error: msg }, 500);
  }
});