import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WalletProfile = {
  id: string;
  display_currency: "USD" | "INR";
  fx_rate_inr_per_usd: number;
  markup_multiplier: number;
  low_balance_threshold: number;
  per_user_spend_cap: number | null;
};

export type WalletBalance = {
  available: number;
  total_topped_up: number;
  total_consumed: number;
  reserved_amount: number;
};

export type Wallet = {
  profile: WalletProfile | null;
  balance: WalletBalance | null;
  /** Convert a raw USD provider estimate to charged amount in the user's display currency. */
  toDisplay: (usd: number) => number;
  /** Format any amount in user's display currency. */
  format: (amount: number) => string;
  /** Currency code shown to user. */
  currency: "USD" | "INR";
  loading: boolean;
  refetch: () => void;
};

const SYMBOLS: Record<string, string> = { USD: "$", INR: "₹" };

export function formatCurrency(amount: number, currency: string = "USD"): string {
  const v = Number.isFinite(amount) ? amount : 0;
  const sym = SYMBOLS[currency] ?? "";
  const abs = Math.abs(v);
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${v < 0 ? "-" : ""}${sym}${abs.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function useWallet(): Wallet {
  const { data: profile, refetch: refProfile, isLoading: l1 } = useQuery({
    queryKey: ["wallet", "profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, display_currency, fx_rate_inr_per_usd, markup_multiplier, low_balance_threshold, per_user_spend_cap",
        )
        .eq("id", u.user.id)
        .maybeSingle();
      return (data as WalletProfile | null) ?? null;
    },
    staleTime: 30_000,
  });

  const { data: balance, refetch: refBal, isLoading: l2 } = useQuery({
    queryKey: ["wallet", "balance", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_balance", {
        p_user_id: profile!.id,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        available: Number(row.available) || 0,
        total_topped_up: Number(row.total_topped_up) || 0,
        total_consumed: Number(row.total_consumed) || 0,
        reserved_amount: Number(row.reserved_amount) || 0,
      } as WalletBalance;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const currency = profile?.display_currency ?? "USD";

  const toDisplay = (usd: number) => {
    if (!profile) return usd;
    const fx = currency === "INR" ? profile.fx_rate_inr_per_usd || 1 : 1;
    return (Number(usd) || 0) * (profile.markup_multiplier || 1) * fx;
  };

  return {
    profile: profile ?? null,
    balance: balance ?? null,
    toDisplay,
    format: (n: number) => formatCurrency(n, currency),
    currency,
    loading: l1 || l2,
    refetch: () => {
      void refProfile();
      void refBal();
    },
  };
}

/** Decode the standard 402 / { error: "insufficient_credits" } response from edge fns. */
export type InsufficientPayload = {
  isInsufficient: boolean;
  required: number | null;
  balance: number | null;
  shortfall: number | null;
  raw: string;
};

export async function parseEdgeError(error: unknown, data: unknown): Promise<InsufficientPayload | null> {
  // Edge fns return non-2xx → supabase-js gives a FunctionsHttpError with context.response.
  let payload: { error?: string; balance?: number | null; required?: number | null; detail?: string } | null = null;
  const ctxRes = (error as { context?: { response?: Response } } | null)?.context?.response;
  if (ctxRes) {
    try {
      payload = await ctxRes.clone().json();
    } catch {
      /* ignore */
    }
  }
  if (!payload && data && typeof data === "object" && (data as { error?: string }).error) {
    payload = data as { error?: string; balance?: number | null; required?: number | null; detail?: string };
  }
  if (!payload) return null;
  const isInsufficient = payload.error === "insufficient_credits";
  const required = typeof payload.required === "number" ? payload.required : null;
  const balance = typeof payload.balance === "number" ? payload.balance : null;
  const shortfall =
    required != null && balance != null ? Math.max(0, required - balance) : null;
  return {
    isInsufficient,
    required,
    balance,
    shortfall,
    raw: payload.detail || payload.error || "",
  };
}

/**
 * If error/data carries an insufficient_credits response, toast a clear message
 * and return true (callers should bail out). Otherwise returns false.
 * Pass an optional `toast` to avoid a sonner import here; we re-import locally.
 */
export async function handleInsufficientCredits(
  error: unknown,
  data: unknown,
): Promise<boolean> {
  const parsed = await parseEdgeError(error, data);
  if (!parsed?.isInsufficient) return false;
  const { toast } = await import("sonner");
  const msg =
    parsed.shortfall != null
      ? `Insufficient credits — you need about ${parsed.shortfall.toFixed(2)} more. Open Wallet to view spend.`
      : "Insufficient credits. Open Wallet to view spend.";
  toast.error(msg, {
    action: {
      label: "Wallet",
      onClick: () => {
        window.location.href = "/wallet";
      },
    },
  });
  return true;
}