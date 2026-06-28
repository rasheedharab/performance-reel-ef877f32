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
};

Deno.serve(async (req) => {
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
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
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