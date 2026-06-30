// Shared credit reservation helpers used by every billable edge function.
// All ledger writes go through Postgres functions (reserve/capture/refund)
// that run under SECURITY DEFINER and are callable only by the service role.
// The client never sees or mutates balances.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type AdminClient = ReturnType<typeof createClient>;

const ENTITY_TYPES = new Set([
  "brand",
  "brief",
  "angle",
  "script",
  "shot",
  "asset",
  "frame",
  "none",
]);

export type EntityContext = {
  entity_type?: unknown;
  entity_id?: unknown;
  brand_id?: unknown;
  brief_id?: unknown;
};

export function normalizeEntity(ctx: EntityContext) {
  const t = typeof ctx.entity_type === "string" && ENTITY_TYPES.has(ctx.entity_type)
    ? ctx.entity_type
    : "none";
  return {
    p_entity_type: t,
    p_entity_id:
      typeof ctx.entity_id === "string" && ctx.entity_id ? ctx.entity_id : null,
    p_brand_id:
      typeof ctx.brand_id === "string" && ctx.brand_id ? ctx.brand_id : null,
    p_brief_id:
      typeof ctx.brief_id === "string" && ctx.brief_id ? ctx.brief_id : null,
  };
}

export type ReserveOk = {
  ok: true;
  ledger_id: string;
  charged_amount: number;
  currency: string;
  available_after: number;
};
export type ReserveErr = {
  ok: false;
  code: "insufficient_credits" | "account_suspended" | "reserve_failed";
  required: number | null;
  balance: number | null;
  message: string;
};

export async function reserveCredit(
  admin: AdminClient,
  params: {
    user_id: string;
    estimated_usd: number;
    operation: string;
    model_id: string | null;
  } & EntityContext,
): Promise<ReserveOk | ReserveErr> {
  const ent = normalizeEntity(params);
  const { data, error } = await admin.rpc("reserve_credit", {
    p_user_id: params.user_id,
    p_estimated_usd: Number(params.estimated_usd) || 0,
    p_operation: params.operation,
    p_model_id: params.model_id,
    ...ent,
  });
  if (error) {
    const msg = error.message || String(error);
    if (msg.includes("insufficient_credits")) {
      const m = msg.match(/required=([\d.\-]+)\s+available=([\d.\-]+)/);
      return {
        ok: false,
        code: "insufficient_credits",
        required: m ? Number(m[1]) : null,
        balance: m ? Number(m[2]) : null,
        message: msg,
      };
    }
    if (msg.includes("account_suspended")) {
      return { ok: false, code: "account_suspended", required: null, balance: null, message: msg };
    }
    return { ok: false, code: "reserve_failed", required: null, balance: null, message: msg };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.ledger_id) {
    return { ok: false, code: "reserve_failed", required: null, balance: null, message: "no ledger_id returned" };
  }
  return {
    ok: true,
    ledger_id: row.ledger_id as string,
    charged_amount: Number(row.charged_amount),
    currency: row.currency as string,
    available_after: Number(row.available_after),
  };
}

export async function captureCredit(
  admin: AdminClient,
  ledger_id: string,
  actual_usd: number,
): Promise<void> {
  const { error } = await admin.rpc("capture_credit", {
    p_ledger_id: ledger_id,
    p_actual_usd: Math.max(0, Number(actual_usd) || 0),
  });
  if (error) {
    console.error("capture_credit failed", ledger_id, error.message);
  }
}

export async function refundCredit(
  admin: AdminClient,
  ledger_id: string,
): Promise<void> {
  const { error } = await admin.rpc("refund_credit", { p_ledger_id: ledger_id });
  if (error) {
    console.error("refund_credit failed", ledger_id, error.message);
  }
}

export function insufficientCreditsResponse(
  err: ReserveErr,
): { error: string; balance: number | null; required: number | null; detail?: string } {
  return {
    error: err.code,
    balance: err.balance,
    required: err.required,
    detail: err.message,
  };
}