import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowLeft, Download, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users/$userId")({
  component: AdminUserDetailPage,
});

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "super_admin" | "user";
  account_status: "active" | "suspended";
  display_currency: "USD" | "INR";
  fx_rate_inr_per_usd: number;
  markup_multiplier: number;
  low_balance_threshold: number;
  per_user_spend_cap: number | null;
};

type Ledger = {
  id: string;
  type: "topup" | "debit" | "refund" | "adjustment";
  status: "reserved" | "captured" | "posted" | "refunded";
  amount: number;
  usd_cost: number | null;
  currency: "USD" | "INR";
  operation: string | null;
  model_id: string | null;
  entity_type: string;
  entity_id: string | null;
  brand_id: string | null;
  brief_id: string | null;
  note: string | null;
  created_at: string;
};

function fmt(n: number | null | undefined, currency = "") {
  return `${currency ? currency + " " : ""}${(Number(n) || 0).toFixed(2)}`;
}

function AdminUserDetailPage() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"brand" | "brief" | "op" | "model" | "time">("brand");

  const { data: profile } = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, account_status, display_currency, fx_rate_inr_per_usd, markup_multiplier, low_balance_threshold, per_user_spend_cap",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const { data: balance } = useQuery({
    queryKey: ["admin", "balance", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_balance", { p_user_id: userId });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["admin", "ledger", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ledger[];
    },
  });

  const { data: brandsMap = {} } = useQuery({
    queryKey: ["admin", "brands", "lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name");
      return (data ?? []).reduce<Record<string, string>>((acc, b) => {
        acc[b.id] = b.name;
        return acc;
      }, {});
    },
  });

  const { data: briefsMap = {} } = useQuery({
    queryKey: ["admin", "briefs", "lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("briefs").select("id, project_name");
      return (data ?? []).reduce<Record<string, string>>((acc, b) => {
        acc[b.id] = b.project_name;
        return acc;
      }, {});
    },
  });

  // breakdowns (charged & cost, captured rows only for "consumption")
  const captured = ledger.filter((l) => l.type === "debit" && l.status === "captured");
  const totalSpend = captured.reduce((s, r) => s + -Number(r.amount), 0);

  function groupBy<K extends string>(getter: (r: Ledger) => K) {
    const agg: Record<string, { charged: number; cost: number; count: number }> = {};
    for (const r of captured) {
      const k = getter(r) || "—";
      agg[k] = agg[k] ?? { charged: 0, cost: 0, count: 0 };
      agg[k].charged += -Number(r.amount);
      agg[k].cost += Number(r.usd_cost ?? 0);
      agg[k].count += 1;
    }
    return Object.entries(agg)
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => b.charged - a.charged);
  }

  const byBrand = useMemo(
    () => groupBy((r) => (r.brand_id ? brandsMap[r.brand_id] || r.brand_id.slice(0, 8) : "—")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledger, brandsMap],
  );
  const byBrief = useMemo(
    () =>
      groupBy((r) =>
        r.brief_id ? briefsMap[r.brief_id] || r.brief_id.slice(0, 8) : "—",
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledger, briefsMap],
  );
  const byOp = useMemo(() => groupBy((r) => r.operation || "—"), [ledger]);
  const byModel = useMemo(() => groupBy((r) => r.model_id || "—"), [ledger]);
  const byDay = useMemo(() => {
    const agg: Record<string, { charged: number; cost: number; count: number }> = {};
    for (const r of captured) {
      const d = (r.created_at || "").slice(0, 10);
      agg[d] = agg[d] ?? { charged: 0, cost: 0, count: 0 };
      agg[d].charged += -Number(r.amount);
      agg[d].cost += Number(r.usd_cost ?? 0);
      agg[d].count += 1;
    }
    return Object.entries(agg)
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger]);

  function csvExport() {
    const headers = [
      "id",
      "created_at",
      "type",
      "status",
      "operation",
      "model_id",
      "entity_type",
      "entity_id",
      "brand",
      "brief",
      "amount",
      "usd_cost",
      "currency",
      "note",
    ];
    const rows = ledger.map((r) => [
      r.id,
      r.created_at,
      r.type,
      r.status,
      r.operation ?? "",
      r.model_id ?? "",
      r.entity_type,
      r.entity_id ?? "",
      r.brand_id ? brandsMap[r.brand_id] ?? r.brand_id : "",
      r.brief_id ? briefsMap[r.brief_id] ?? r.brief_id : "",
      r.amount,
      r.usd_cost ?? "",
      r.currency,
      (r.note ?? "").replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c)}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${userId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cur = profile?.display_currency ?? "USD";

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1 label-mono text-[10px] text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Users
      </Link>

      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <p className="label-mono mb-2">User</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {profile?.full_name || profile?.email || userId.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{profile?.email}</p>
        </div>
        <span
          className={cn(
            "inline-flex font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px] h-fit",
            profile?.account_status === "active"
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-[var(--color-rec)] text-white border-[var(--color-rec)]",
          )}
        >
          {profile?.account_status}
        </span>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Balance" value={fmt(balance?.available, cur)} accent />
        <Stat label="Reserved" value={fmt(balance?.reserved_amount, cur)} />
        <Stat label="Topped up" value={fmt(balance?.total_topped_up, cur)} />
        <Stat label="Consumed" value={fmt(balance?.total_consumed, cur)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {profile && <TopUpPanel profile={profile} onDone={() => {
          qc.invalidateQueries({ queryKey: ["admin", "balance", userId] });
          qc.invalidateQueries({ queryKey: ["admin", "ledger", userId] });
        }} />}
        {profile && <SettingsPanel profile={profile} onDone={() => {
          qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
          qc.invalidateQueries({ queryKey: ["admin", "balance", userId] });
        }} />}
      </div>

      {/* Breakdown */}
      <div className="border border-border rounded-[3px] bg-card overflow-hidden mb-8">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-1">
            {(
              [
                ["brand", "By brand"],
                ["brief", "By brief"],
                ["op", "By operation"],
                ["model", "By model"],
                ["time", "Over time"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "label-mono text-[10px] px-3 py-1.5 border rounded-[3px] transition-colors",
                  tab === k
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="label-mono text-[10px] text-muted-foreground">
            Total spend {fmt(totalSpend, cur)}
          </div>
        </div>
        <BreakdownTable
          rows={
            tab === "brand"
              ? byBrand
              : tab === "brief"
              ? byBrief
              : tab === "op"
              ? byOp
              : tab === "model"
              ? byModel
              : byDay
          }
          currency={cur}
          total={totalSpend}
        />
      </div>

      {/* Transaction history */}
      <div className="border border-border rounded-[3px] bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="label-mono text-[10px]">Transaction history</div>
          <Button variant="outline" size="sm" onClick={csvExport}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left label-mono text-[10px] text-muted-foreground border-b border-border bg-muted/30">
              <th className="py-2 px-4">When</th>
              <th>Type</th>
              <th>Status</th>
              <th>Operation</th>
              <th>Model</th>
              <th>Entity</th>
              <th>USD cost</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((r) => (
              <tr key={r.id} className="border-b border-border/40">
                <td className="py-2 px-4 font-mono text-xs">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td>
                  <span className="label-mono text-[10px]">{r.type}</span>
                </td>
                <td>
                  <span className="label-mono text-[10px] text-muted-foreground">{r.status}</span>
                </td>
                <td className="font-mono text-xs">{r.operation ?? "—"}</td>
                <td className="font-mono text-xs">{r.model_id ?? "—"}</td>
                <td className="font-mono text-xs">
                  {r.brief_id
                    ? briefsMap[r.brief_id] ?? r.entity_type
                    : r.brand_id
                    ? brandsMap[r.brand_id] ?? r.entity_type
                    : r.entity_type}
                </td>
                <td className="font-mono text-xs">{r.usd_cost ? `$${Number(r.usd_cost).toFixed(4)}` : "—"}</td>
                <td
                  className={cn(
                    "font-mono text-xs",
                    Number(r.amount) > 0 ? "text-emerald-600" : "text-foreground",
                  )}
                >
                  {Number(r.amount) > 0 ? "+" : ""}
                  {Number(r.amount).toFixed(2)} {r.currency}
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "border rounded-[3px] bg-card p-4",
        accent ? "border-[var(--color-rec)]" : "border-border",
      )}
    >
      <div className="label-mono text-[10px] text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold tracking-tight mt-2">{value}</div>
    </div>
  );
}

function TopUpPanel({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const n = Number(amount);
      if (!n || n <= 0) throw new Error("Enter a positive amount");
      const { data, error } = await supabase.rpc("admin_topup_credit", {
        p_user_id: profile.id,
        p_amount: n,
        p_note: note || undefined,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (r) => {
      toast.success(
        `Topped up. New balance: ${profile.display_currency} ${Number(r?.new_balance ?? 0).toFixed(2)}`,
      );
      setAmount("");
      setNote("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border border-border rounded-[3px] bg-card p-5">
      <div className="label-mono text-[10px] text-muted-foreground mb-3 flex items-center gap-1">
        <Plus className="h-3 w-3" />
        Add credits
      </div>
      <div className="space-y-3">
        <div>
          <label className="label-mono text-[10px] block mb-1">
            Amount ({profile.display_currency})
          </label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label-mono text-[10px] block mb-1">Note (optional)</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Reason for top-up"
          />
        </div>
        <Button
          onClick={() => m.mutate()}
          disabled={m.isPending || !amount}
          className="w-full"
        >
          {m.isPending ? "Adding…" : `Add ${profile.display_currency} ${amount || "0"}`}
        </Button>
      </div>
    </div>
  );
}

function SettingsPanel({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [form, setForm] = useState({
    display_currency: profile.display_currency,
    fx_rate_inr_per_usd: String(profile.fx_rate_inr_per_usd),
    markup_multiplier: String(profile.markup_multiplier),
    low_balance_threshold: String(profile.low_balance_threshold),
    per_user_spend_cap:
      profile.per_user_spend_cap == null ? "" : String(profile.per_user_spend_cap),
    account_status: profile.account_status,
    role: profile.role,
  });

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_currency: form.display_currency,
          fx_rate_inr_per_usd: Number(form.fx_rate_inr_per_usd),
          markup_multiplier: Number(form.markup_multiplier),
          low_balance_threshold: Number(form.low_balance_threshold),
          per_user_spend_cap:
            form.per_user_spend_cap === "" ? null : Number(form.per_user_spend_cap),
          account_status: form.account_status,
          role: form.role,
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings updated");
      onDone();
    },
      onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border border-border rounded-[3px] bg-card p-5">
      <div className="label-mono text-[10px] text-muted-foreground mb-3">Wallet & access</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency">
          <select
            value={form.display_currency}
            onChange={(e) =>
              setForm({ ...form, display_currency: e.target.value as "USD" | "INR" })
            }
            className="w-full border border-border rounded-[3px] bg-background px-2 py-2 text-sm"
          >
            <option>USD</option>
            <option>INR</option>
          </select>
        </Field>
        <Field label="Role">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Profile["role"] })}
            className="w-full border border-border rounded-[3px] bg-background px-2 py-2 text-sm"
          >
            <option value="user">user</option>
            <option value="super_admin">super_admin</option>
          </select>
        </Field>
        <Field label="FX (INR/USD)">
          <Input
            value={form.fx_rate_inr_per_usd}
            onChange={(e) => setForm({ ...form, fx_rate_inr_per_usd: e.target.value })}
          />
        </Field>
        <Field label="Markup ×">
          <Input
            value={form.markup_multiplier}
            onChange={(e) => setForm({ ...form, markup_multiplier: e.target.value })}
          />
        </Field>
        <Field label="Low-balance alert">
          <Input
            value={form.low_balance_threshold}
            onChange={(e) => setForm({ ...form, low_balance_threshold: e.target.value })}
          />
        </Field>
        <Field label="Spend cap (optional)">
          <Input
            value={form.per_user_spend_cap}
            onChange={(e) => setForm({ ...form, per_user_spend_cap: e.target.value })}
            placeholder="No cap"
          />
        </Field>
        <Field label="Account status">
          <select
            value={form.account_status}
            onChange={(e) =>
              setForm({ ...form, account_status: e.target.value as Profile["account_status"] })
            }
            className="w-full border border-border rounded-[3px] bg-background px-2 py-2 text-sm"
          >
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
        </Field>
      </div>
      <Button
        onClick={() => m.mutate()}
        disabled={m.isPending}
        className="w-full mt-4"
        variant="outline"
      >
        {m.isPending ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-mono text-[10px] block mb-1">{label}</label>
      {children}
    </div>
  );
}

function BreakdownTable({
  rows,
  currency,
  total,
}: {
  rows: Array<{ key: string; charged: number; cost: number; count: number }>;
  currency: string;
  total: number;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground p-6">No captured spend yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left label-mono text-[10px] text-muted-foreground border-b border-border bg-muted/30">
          <th className="py-2 px-4">Key</th>
          <th>Ops</th>
          <th>USD cost</th>
          <th>Charged ({currency})</th>
          <th>% of spend</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-border/40">
            <td className="py-2 px-4 font-mono text-xs">{r.key}</td>
            <td>{r.count}</td>
            <td className="font-mono text-xs">${r.cost.toFixed(4)}</td>
            <td className="font-mono text-xs">{r.charged.toFixed(2)}</td>
            <td className="font-mono text-xs">
              {total > 0 ? ((r.charged / total) * 100).toFixed(1) : "0.0"}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}