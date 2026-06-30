// admin-invite-user — Super-admin-only: invites a new user by email,
// configures their profile (role, currency, FX, markup). Uses the Supabase
// Auth Admin API via the service role key.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing_auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PUBLISHABLE = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is super_admin (RLS as the caller)
    const userClient = createClient(SUPABASE_URL, PUBLISHABLE, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "unauthorized" }, 401);
    const { data: prof } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", u.user.id)
      .maybeSingle();
    if (prof?.role !== "super_admin") return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim();
    const role = body.role === "super_admin" ? "super_admin" : "user";
    const display_currency = body.display_currency === "INR" ? "INR" : "USD";
    const fx_rate_inr_per_usd = Number(body.fx_rate_inr_per_usd ?? 83);
    const markup_multiplier = Number(body.markup_multiplier ?? 1.5);
    const full_name = body.full_name ? String(body.full_name) : null;
    if (!email || !email.includes("@")) return json({ error: "invalid_email" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: full_name ? { full_name } : undefined,
    });
    if (inviteErr || !invite.user) {
      return json({ error: "invite_failed", detail: inviteErr?.message }, 400);
    }

    const { error: upErr } = await admin
      .from("profiles")
      .update({ role, display_currency, fx_rate_inr_per_usd, markup_multiplier, full_name })
      .eq("id", invite.user.id);
    if (upErr) return json({ error: "profile_update_failed", detail: upErr.message }, 500);

    return json({ ok: true, user_id: invite.user.id });
  } catch (err) {
    return json({ error: "server_error", detail: (err as Error).message }, 500);
  }
});