// Shared AI assistance edge function — single entry point for all AI tasks.
// Holds server-side prompt templates per task and calls Anthropic.
// Never exposes the API key.

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

// Strip ```json fences / preamble and parse defensively.
function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  // Remove markdown fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // Trim to outermost JSON braces if there's extra prose
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return JSON.parse(t);
}

type TaskBuilder = (payload: Record<string, unknown>) => {
  system: string;
  user: string;
};

const TASK_MODELS: Record<string, string> = {
  diagnose_variant: "claude-haiku-4-5",
  distill_winner: "claude-haiku-4-5",
};
const DEFAULT_MODEL = "claude-sonnet-4-6";

const SYSTEM_BASE =
  "You are a senior direct-response creative strategist for Meta video ads. " +
  "You think in terms of audience truth, psychological entry points, and testable hypotheses. " +
  "You ALWAYS return ONLY valid JSON in the exact shape requested. " +
  "No preamble. No commentary. No markdown fences. No trailing text.";

const TASKS: Record<string, TaskBuilder> = {
  suggest_angles: (p) => {
    const benefits = Array.isArray(p.benefits)
      ? (p.benefits as unknown[]).filter((x) => typeof x === "string").join(" · ")
      : "";
    const noGo = Array.isArray(p.no_go_list)
      ? (p.no_go_list as unknown[]).filter((x) => typeof x === "string").join(" · ")
      : (typeof p.no_go_list === "string" ? p.no_go_list : "");
    const user = `Propose 3 to 5 DISTINCT advertising angles for this campaign.

Each angle must use a DIFFERENT psychological entry point where possible. Valid entry points (use these exact lowercase values):
- pain        — lead with the ache they feel today
- outcome     — lead with the transformation they want
- objection   — lead by dismantling the thing that stops them
- social_proof — lead with who's already doing it
- identity    — lead with who they become
- curiosity   — lead with a pattern interrupt they can't ignore

Ground every angle in the audience truth below. Do NOT propose anything that touches the no-go list. Respect the brand voice. Each angle should feel like a different ad someone would actually scroll-stop on — not the same idea reworded.

AUDIENCE & STRATEGY CONTEXT
- Awareness stage: ${p.awareness_stage ?? "—"}
- Core driver (#1 pain/desire): ${p.core_driver ?? "—"}
- #1 Objection: ${p.objection ?? "—"}
- Psychographic: ${p.psychographic ?? "—"}
- Benefits: ${benefits || "—"}
- The wedge: ${p.wedge ?? "—"}
- Offer: ${p.offer_type ?? "—"} — ${p.offer_detail ?? "—"}

BRAND
- Voice: ${p.brand_voice ?? "—"}
- No-go list (avoid): ${noGo || "—"}

Return ONLY this JSON shape (no other text):
{
  "angles": [
    {
      "title": "short, punchy angle name (max ~8 words)",
      "entry_point": "pain | outcome | objection | social_proof | identity | curiosity",
      "target_segment": "the slice of the audience this hits hardest",
      "hook_seed": "a one-line opening hook in the brand's voice",
      "description": "2-3 sentences: the core message, the promise, and why it lands"
    }
  ]
}`;
    return { system: SYSTEM_BASE, user };
  },

  draft_script: (p) => {
    const benefits = Array.isArray(p.benefits)
      ? (p.benefits as unknown[]).filter((x) => typeof x === "string").join(" · ")
      : "";
    const noGo = Array.isArray(p.no_go_list)
      ? (p.no_go_list as unknown[]).filter((x) => typeof x === "string").join(" · ")
      : (typeof p.no_go_list === "string" ? p.no_go_list : "");
    const system =
      "You are a senior direct-response scriptwriter for Meta video ads. " +
      "You write scripts that scroll-stop in 0–3 seconds, weave in the audience's exact phrasing, " +
      "and land with the sound OFF — the on-screen text alone must carry the message. " +
      "Target 15–30 seconds. Keep the CTA accurate to the actual offer. Respect the no-go list. " +
      "You ALWAYS return ONLY valid JSON in the exact shape requested. " +
      "No preamble. No commentary. No markdown fences.";
    const user = `Write ONE Meta video ad script for the angle and archetype below.

ARCHETYPE: ${p.archetype ?? "—"}

ANGLE
- Title: ${p.angle_title ?? "—"}
- Entry point: ${p.entry_point ?? "—"}
- Hook seed (build the 0–3s open from this): ${p.hook_seed ?? "—"}
- Description: ${p.angle_description ?? "—"}

AUDIENCE
- Core driver (#1 pain/desire): ${p.core_driver ?? "—"}
- #1 Objection to dismantle: ${p.objection ?? "—"}
- Customer language (use their EXACT phrasing where natural): ${p.customer_language ?? "—"}
- Benefits: ${benefits || "—"}
- The wedge: ${p.wedge ?? "—"}

OFFER (keep CTA accurate to this)
- Type: ${p.offer_type ?? "—"}
- Detail: ${p.offer_detail ?? "—"}

BRAND
- Voice: ${p.brand_voice ?? "—"}
- No-go list (do NOT use): ${noGo || "—"}

REQUIREMENTS
- Hook must be a scroll-stopping 0–3s line grounded in the hook_seed.
- on_screen_text alone must carry the message (sound OFF).
- vo_script should read naturally end-to-end if spoken.
- Target 15–30 seconds. Set estimated_duration accordingly.
- sound_off_ok = true ONLY if the on-screen text fully conveys the value prop without audio.

Return ONLY this JSON shape (no other text):
{
  "hook": "the 0–3s line — one or two sentences max",
  "desire_beat": "name the ache/want in their words",
  "body": "the solution — product as resolution, not a feature list",
  "proof_beat": "a number, testimonial beat, or before/after",
  "cta": "one clear action that matches the offer",
  "vo_script": "full spoken script, top to tail",
  "on_screen_text": "the captions / lower thirds / titles that carry sound-off",
  "estimated_duration": 22,
  "sound_off_ok": true,
  "duration_note": "one short sentence on pacing/why this length"
}`;
    return { system, user };
  },

  build_shotlist: (p) => {
    const noGo = Array.isArray(p.no_go_list)
      ? (p.no_go_list as unknown[]).filter((x) => typeof x === "string").join(" · ")
      : (typeof p.no_go_list === "string" ? p.no_go_list : "");
    const hasImages = Boolean(p.has_product_images);
    const system =
      "You are an AI-video pre-production director and technical router for Meta video ads. " +
      "You break scripts into SHORT, single-action shots and route each to the right AI video tool. " +
      "HARD RULES: every shot is 4–8 seconds (never propose a single clip over 10s — split it). " +
      "Shot durations should sum to roughly the script's target duration. " +
      "Every shot has ONE clear visual action — never cram multiple events into one shot. " +
      "Respect the brand no-go list. " +
      "You ALWAYS return ONLY valid JSON in the exact shape requested. No preamble, no markdown fences.";
    const user = `Break this script into a numbered SHOT LIST and recommend the generation method + tool for each shot.

SCRIPT
- Archetype: ${p.archetype ?? "—"}
- Hook (0–3s): ${p.hook ?? "—"}
- Desire beat: ${p.desire_beat ?? "—"}
- Body: ${p.body ?? "—"}
- Proof beat: ${p.proof_beat ?? "—"}
- CTA: ${p.cta ?? "—"}
- VO script: ${p.vo_script ?? "—"}
- On-screen text: ${p.on_screen_text ?? "—"}
- Target duration (s): ${p.target_duration ?? p.estimated_duration ?? "—"}

PRODUCT
- Name: ${p.product_name ?? "—"}
- Description: ${p.product_description ?? "—"}
- has_product_images: ${hasImages ? "true" : "false"}

BRAND
- Visual notes (fonts/colors): ${p.brand_visual_notes ?? "—"}
- No-go list (avoid): ${noGo || "—"}

TOOL ROUTING LOGIC (pick ONE per shot, set generation_method accordingly)
- "Veo 3.1" — cinematic / hero / atmospheric, or needs native synced audio. 4K. Quality over volume.
- "Kling 3.0" — high-motion, many cheap variants, or multilingual lip-sync.
- "Runway Gen-4.5" — tight camera control / motion-brush / strict reference consistency.
- "Arcads" — UGC / talking-head / spokesperson testimonial.
- "HeyGen" — avatar lip-sync spokesperson.
- "Luma Ray3" — product fidelity shot ONLY when has_product_images is true; use generation_method "image-to-video" and note in tool_reason to attach a product reference frame. (Runway Gen-4.5 is an acceptable alternative for image-to-video.)
- Default generation_method = "text-to-video" unless a real product frame is genuinely needed.

Give a one-line tool_reason per shot. Map each shot to a script beat (hook → desire → body → proof → cta) in order. Keep shots short and stitchable.

Return ONLY this JSON shape (no other text):
{
  "shots": [
    {
      "shot_number": 1,
      "visual_description": "what is visually happening in this single shot",
      "camera_move": "Static | Push in | Pull out | Pan | Tilt | Tracking | Handheld | Orbit",
      "motion_intensity": "Subtle | Moderate | Dynamic",
      "duration_seconds": 6,
      "generation_method": "text-to-video | image-to-video",
      "assigned_tool": "Veo 3.1 | Kling 3.0 | Runway Gen-4.5 | Arcads | HeyGen | Luma Ray3",
      "tool_reason": "one short line on why this tool",
      "caption_text": "on-screen text for this shot (sound off)",
      "audio_note": "VO line or sfx cue for this shot"
    }
  ]
}`;
    return { system, user };
  },
};

TASKS.diagnose_variant = (p) => {
  const n = (v: unknown) =>
    v == null || v === "" || !Number.isFinite(Number(v)) ? "—" : String(v);
  const system =
    "You are a performance-creative analyst for Meta video ads. " +
    "You read the creative funnel in order — HOOK (3s view rate) → HOLD (watch-through) → " +
    "CLICK (CTR) → CONVERT (CPA / ROAS vs target). " +
    "Always find the FIRST stage that underperforms and diagnose there — a problem early in the " +
    "funnel makes later metrics unreliable. Be specific to THIS variant's numbers and lineage; " +
    "reference the entry point and hook. " +
    "If spend or impressions are too low to trust, say so in confidence_note and lean toward a " +
    "non-destructive action. " +
    "You ALWAYS return ONLY valid JSON in the exact shape requested. " +
    "No preamble. No commentary. No markdown fences.";
  const user = `Diagnose this single ad variant.

VARIANT LINEAGE
- Angle: ${p.angle_title ?? "—"} (entry point: ${p.entry_point ?? "—"})
- Archetype: ${p.archetype ?? "—"}
- Hook label: ${p.hook_label ?? "—"}
- Hook text: ${p.hook_text ?? "—"}
- Format / placement: ${p.format ?? "—"}

BENCHMARK CONTEXT
- Campaign primary metric: ${p.primary_metric ?? "—"}
- Brief KPI type: ${p.kpi_type ?? "—"}
- Brief KPI target: ${p.kpi_target ?? "—"}

METRICS (aggregated)
- Spend: ${n(p.spend)}
- Impressions: ${n(p.impressions)}
- Conversions: ${n(p.conversions)}
- Hook rate (3s view rate): ${n(p.hook_rate)}
- Hold rate (watch-through): ${n(p.hold_rate)}
- CTR: ${n(p.ctr)}
- CPA: ${n(p.cpa)}
- ROAS: ${n(p.roas)}

REASONING FRAME
- Low hook → recommend iterate_hook ("Recut the first 3 seconds").
- Healthy hook, low hold → recommend iterate_body ("Hook works, body's weak").
- Healthy hold, low CTR → recommend iterate_offer ("They watch but don't click — fix offer/CTA").
- Strong through convert and beating target → recommend scale ("Winner — scale and spin new hooks on this body").
- Failing at convert despite a good funnel, or unprofitable → consider iterate_offer or kill.

Return ONLY this JSON shape (no other text):
{
  "weakest_stage": "hook | hold | click | convert | none",
  "diagnosis": "1–2 sentences, specific to this variant's numbers and lineage",
  "recommended_action": "scale | iterate_hook | iterate_body | iterate_offer | kill",
  "confidence_note": "one short line; flag if spend/impressions are too low to trust yet"
}`;
  return { system, user };
};

TASKS.distill_winner = (p) => {
  const tools = Array.isArray(p.tools)
    ? (p.tools as unknown[]).filter((x) => typeof x === "string").join(" · ")
    : (typeof p.tools === "string" ? p.tools : "");
  const shotPattern = Array.isArray(p.shot_pattern)
    ? (p.shot_pattern as unknown[])
        .filter((x) => typeof x === "string")
        .join(" → ")
    : (typeof p.shot_pattern === "string" ? p.shot_pattern : "");
  const system =
    "You are a senior creative strategist building a reusable playbook from " +
    "winning Meta ads. Given ONE winning variant, extract the TRANSFERABLE " +
    "PATTERN — the structural reason it worked — not the literal copy or " +
    "the product. Produce reusable library entries: at minimum a " +
    "hook_formula (the hook pattern, written as a fill-in-the-blank template " +
    "a future writer can reuse with [variables]), and where clearly valuable " +
    "a script_template (the beat skeleton) and/or a generation_prompt or " +
    "shot_recipe (the winning visual/tool approach). Every entry must be " +
    "product-agnostic, reusable across briefs, and specific enough to be " +
    "actionable. Never lift the source copy verbatim — abstract it. " +
    "Return ONLY valid JSON in the exact shape requested. No preamble, no " +
    "markdown fences, no commentary.";
  const user = `Distill the transferable pattern behind this WINNING variant.

ANGLE
- Title: ${p.angle_title ?? "—"}
- Entry point: ${p.entry_point ?? "—"}
- Description: ${p.angle_description ?? "—"}

SCRIPT
- Archetype: ${p.archetype ?? "—"}
- Hook: ${p.hook ?? "—"}
- Body: ${p.body ?? "—"}
- CTA: ${p.cta ?? "—"}

PRODUCTION
- Tool(s) used: ${tools || "—"}
- Shot pattern (beat → tool): ${shotPattern || "—"}

PERFORMANCE (why we're keeping this)
- Winning source metric: ${p.source_metric ?? "—"}
- Hook rate: ${p.hook_rate ?? "—"}
- Hold rate: ${p.hold_rate ?? "—"}
- CTR: ${p.ctr ?? "—"}

RULES
- Produce 1–4 entries total. Always include at least one "hook_formula".
- "category" MUST be one of: generation_prompt, script_template, hook_formula, shot_recipe, vo_style.
- "content" is the reusable artifact itself — a template, formula, or recipe — written so a future writer/producer could apply it to a different product. Use [BRACKETED] placeholders for variables.
- "notes" explains briefly WHY it worked and WHEN to reuse it.
- "archetype", "tool", "entry_point" should be set when clearly relevant; otherwise null.

Return ONLY this JSON shape (no other text):
{
  "entries": [
    {
      "category": "hook_formula | script_template | generation_prompt | shot_recipe | vo_style",
      "title": "short, memorable name for the pattern",
      "content": "the reusable template/formula/recipe with [BRACKETED] variables",
      "archetype": "string or null",
      "tool": "string or null",
      "entry_point": "pain | outcome | objection | social_proof | identity | curiosity | null",
      "notes": "1–2 sentences on why it worked and when to reuse"
    }
  ]
}`;
  return { system, user };
};

Deno.serve(async (req) => {

TASKS.compile_prompt = (p) => {
  const s = (k: string) => {
    const v = p[k];
    return v == null || v === "" ? "—" : String(v);
  };
  const tool = String(p.assigned_tool ?? p.target_model ?? "").trim();
  const isI2V =
    String(p.generation_method ?? "").toLowerCase() === "image-to-video" ||
    Boolean(p.has_anchor_image);
  const wordTarget = Number(p.prompt_word_target) > 0 ? Number(p.prompt_word_target) : 60;

  let toolGuidance =
    "GENERIC / OTHER: Balanced cinematic structure — subject, action, setting, lighting, lens, grade, mood, motion. Single clear action.";
  const t = tool.toLowerCase();
  if (t.includes("veo")) {
    toolGuidance =
      "VEO 3.1: Structured 'ingredient list' style — subject → action → setting → lighting → lens → grade → mood → camera move. " +
      "Veo supports native synced audio: put audio on a SEPARATE line at the end formatted as `Audio: <dialogue/SFX/ambient>`. " +
      "Reference-image aware. Use precise cinematographic terms. Avoid vague mood adjectives that cause concept-bleeding. " +
      "Return the visual prompt in compiled_prompt and the audio line in audio_prompt.";
  } else if (t.includes("kling")) {
    toolGuidance =
      "KLING 3.0: Tight, motion-and-beat aware. Concise. Lead with motion verbs and beats. " +
      "If a reference is used, mention 'Elements reference for character consistency'. " +
      "Do NOT inline an audio line — leave audio_prompt null.";
  } else if (t.includes("runway")) {
    toolGuidance =
      "RUNWAY GEN-4.5: Camera-and-physics language. Describe forces, weight, momentum, and EXPLICIT camera movement " +
      "(focal length, dolly/track/orbit/push, speed). Concise. Anchor-frame aware: if has_anchor_image, write a motion-only prompt. " +
      "Leave audio_prompt null.";
  } else if (t.includes("luma") || t.includes("ray")) {
    toolGuidance =
      "LUMA RAY3 (image-to-video): MOTION-ONLY. Describe movement, change, parallax, and camera trajectory ONLY. " +
      "Do NOT redescribe the subject the anchor image already shows. Leave audio_prompt null.";
  } else if (t.includes("arcads") || t.includes("heygen") || t.includes("synthesia")) {
    toolGuidance =
      "AVATAR/UGC TOOL: This task does not apply (talking-head). Compile a short visual brief covering wardrobe, " +
      "setting, framing, and energy. Put any spoken line in audio_prompt.";
  }

  const system =
    "You are an expert AI-video prompt engineer. You compile structured shot slots into ONE optimized, " +
    "MODEL-SPECIFIC generation prompt. " +
    "GLOBAL RULES: stay within prompt_word_target (default ~60, hard cap ~90 words — tighter is better); " +
    "use specific focal lengths and motion verbs; ONE clear action per shot; no contradictory style cues; " +
    "convert subjective adjectives into concrete cinematographic terms; reuse subject_tokens VERBATIM for consistency. " +
    "If generation_method is image-to-video OR has_anchor_image is true, write a MOTION-ONLY prompt regardless of model " +
    "— describe movement and change, not the subject the anchor already shows. " +
    "Build a clean negative_prompt from negative_prompt input (deduped, comma-separated). " +
    "Flag warnings for: contradictory cues, over-length, multiple actions in one shot, or a product/hero shot missing an anchor image. " +
    "Return ONLY valid JSON in the exact shape requested. No preamble, no markdown fences.";

  const user = `Compile a single optimized generation prompt for target model: ${tool || "Generic"}.

MODEL-SPECIFIC RULES
${toolGuidance}

SHOT SLOTS
- subject: ${s("subject")}
- subject_tokens (reuse verbatim): ${s("subject_tokens")}
- action (ONE clear action): ${s("action")}
- setting: ${s("setting")}
- lighting: ${s("lighting")}
- lens: ${s("lens")}
- style_grade: ${s("style_grade")}
- mood: ${s("mood")}
- camera_move: ${s("camera_move")}
- motion_intensity: ${s("motion_intensity")}
- duration_seconds: ${s("duration_seconds")}
- dialogue: ${s("dialogue")}
- sfx: ${s("sfx")}
- ambient: ${s("ambient")}
- negative_prompt (raw): ${s("negative_prompt")}
- seed: ${s("seed")}
- generation_method: ${s("generation_method")}
- has_anchor_image: ${isI2V ? "true" : "false"}
- prompt_word_target: ${wordTarget}

REQUIREMENTS
- compiled_prompt must be ONE prompt, optimized for ${tool || "a generic T2V model"}, within ${wordTarget} words (hard cap 90).
- If has_anchor_image is true OR generation_method is image-to-video, write MOTION-ONLY.
- negative_prompt: clean, deduped, comma-separated; empty string if nothing.
- audio_prompt: only set for Veo (audio line) or avatar/UGC tools (the spoken line); null otherwise.
- seed: echo the input seed as a number, or null.
- word_count: integer count of words in compiled_prompt.
- warnings: array of short strings flagging issues (contradictory cues, over-length, multiple actions, missing anchor for product shot, etc.). Empty array if none.

Return ONLY this JSON shape (no other text):
{
  "compiled_prompt": "the final optimized prompt",
  "negative_prompt": "clean, deduped, comma-separated; empty string if none",
  "audio_prompt": "audio line for Veo / spoken line for avatars, otherwise null",
  "seed": null,
  "word_count": 0,
  "warnings": []
}`;
  return { system, user };
};

const _serve = (req: Request) =>
  // unused — real handler is the original Deno.serve below
  new Response(null);
void _serve;

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "AI is not configured yet. Missing ANTHROPIC_API_KEY." }, 500);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request body." }, 400);
    }
    const { task, payload } = body as { task?: string; payload?: Record<string, unknown> };
    if (!task || typeof task !== "string") {
      return json({ error: "Missing 'task'." }, 400);
    }
    const builder = TASKS[task];
    if (!builder) {
      return json({ error: `Unknown task: ${task}` }, 400);
    }
    const { system, user } = builder(payload ?? {});

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: TASK_MODELS[task] ?? DEFAULT_MODEL,
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("anthropic error", resp.status, errText);
      return json({ error: `AI provider error (${resp.status}). Try again.` }, 502);
    }

    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();

    if (!text) return json({ error: "AI returned an empty response." }, 502);

    let parsed: unknown;
    try {
      parsed = parseJsonLoose(text);
    } catch (e) {
      console.error("parse error", e, text.slice(0, 500));
      return json({ error: "AI returned malformed JSON. Try again." }, 502);
    }

    return json({ result: parsed });
  } catch (e) {
    console.error("ai-assist fatal", e);
    return json({ error: "Unexpected error in AI assist." }, 500);
  }
});