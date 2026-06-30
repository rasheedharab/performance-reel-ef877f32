import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Wallet, TrendingDown, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverviewPage,
});

type Overview = {
  total_users: number;
  active_users: number;
  suspended_users: number;
  total_topped_up_usd: number;
  total_consumed_usd: number;
  total_charged_usd_equiv: number;
  total_reserved_usd: number;
};

function fmtUsd(n: number | null | undefined) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function AdminOverviewPage() {
  const { data: overview } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_platform_overview");
      if (error) throw error;
      return (data?.[0] ?? null) as Overview | null;
    },
  });

  const { data: byOp = [] } = useQuery({
    queryKey: ["admin", "by_operation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("operation, usd_cost, amount, status, type, model_id")
        .eq("type", "debit")
        .eq("status", "captured");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lowBalance = [] } = useQuery({
    queryKey: ["admin", "low_balance"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, display_currency, low_balance_threshold");
      if (!profiles) return [];
      const rows = await Promise.all(
        profiles.map(async (p) => {
          const { data: bal } = await supabase.rpc("get_balance", { p_user_id: p.id });
          const available = Number(bal?.[0]?.available ?? 0);
          return { ...p, available };
        }),
      );
      return rows
        .filter((r) => Number(r.low_balance_threshold ?? 0) > 0 && r.available < Number(r.low_balance_threshold))
        .sort((a, b) => a.available - b.available);
    },
  });

  const byOpAgg = byOp.reduce<Record<string, { cost: number; charged: number; count: number }>>(
    (acc, r) => {
      const k = r.operation ?? "other";
      acc[k] = acc[k] ?? { cost: 0, charged: 0, count: 0 };
      acc[k].cost += Number(r.usd_cost ?? 0);
      acc[k].charged += -Number(r.amount ?? 0);
      acc[k].count += 1;
      return acc;
    },
    {},
  );

  const byModelAgg = byOp.reduce<Record<string, { cost: number; charged: number; count: number }>>(
    (acc, r) => {
      const k = r.model_id ?? "—";
      acc[k] = acc[k] ?? { cost: 0, charged: 0, count: 0 };
      acc[k].cost += Number(r.usd_cost ?? 0);
      acc[k].charged += -Number(r.amount ?? 0);
      acc[k].count += 1;
      return acc;
    },
    {},
  );

  const margin =
    (Number(overview?.total_charged_usd_equiv ?? 0)) - Number(overview?.total_consumed_usd ?? 0);

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-7xl mx-auto">
      <div className="mb-10">
        <p className="label-mono mb-2">Super Admin</p>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Real provider cost exposure, margin, and account-wide health.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Users"
          value={`${overview?.total_users ?? 0}`}
          sub={`${overview?.active_users ?? 0} active · ${overview?.suspended_users ?? 0} suspended`}
        />
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Topped up (USD eq.)"
          value={fmtUsd(overview?.total_topped_up_usd)}
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Provider cost"
          value={fmtUsd(overview?.total_consumed_usd)}
          sub={`Charged ${fmtUsd(overview?.total_charged_usd_equiv)}`}
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4 rotate-180" />}
          label="Margin (USD eq.)"
          value={fmtUsd(margin)}
          accent
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <Panel title="Spend by operation">
          <BreakdownTable
            rows={Object.entries(byOpAgg)
              .map(([k, v]) => ({ key: k, ...v }))
              .sort((a, b) => b.cost - a.cost)}
          />
        </Panel>
        <Panel title="Spend by model">
          <BreakdownTable
            rows={Object.entries(byModelAgg)
              .map(([k, v]) => ({ key: k, ...v }))
              .sort((a, b) => b.cost - a.cost)}
          />
        </Panel>
      </div>

      <Panel
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--color-rec)]" />
            Low-balance watchlist
          </span>
        }
      >
        {lowBalance.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No users below their threshold.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left label-mono text-[10px] text-muted-foreground border-b border-border">
                <th className="py-2">User</th>
                <th>Balance</th>
                <th>Threshold</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lowBalance.map((u) => (
                <tr key={u.id} className="border-b border-border/40">
                  <td className="py-2">
                    <div className="font-medium">{u.full_name || u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td>
                    {u.display_currency} {Number(u.available).toFixed(2)}
                  </td>
                  <td>
                    {u.display_currency} {Number(u.low_balance_threshold).toFixed(2)}
                  </td>
                  <td className="text-right">
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: u.id }}
                      className="label-mono text-[10px] text-[var(--color-rec)]"
                    >
                      Top up →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "border border-border rounded-[3px] bg-card p-4 " +
        (accent ? "border-[var(--color-rec)]" : "")
      }
    >
      <div className="flex items-center gap-2 label-mono text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-display text-2xl font-bold tracking-tight mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-[3px] bg-card p-5">
      <div className="label-mono text-[10px] text-muted-foreground mb-3">{title}</div>
      {children}
    </div>
  );
}

function BreakdownTable({
  rows,
}: {
  rows: Array<{ key: string; cost: number; charged: number; count: number }>;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground py-4">No captured spend yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left label-mono text-[10px] text-muted-foreground border-b border-border">
          <th className="py-2">Key</th>
          <th>Ops</th>
          <th>USD cost</th>
          <th>Charged</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-border/40">
            <td className="py-2 font-mono text-xs">{r.key}</td>
            <td>{r.count}</td>
            <td>${r.cost.toFixed(2)}</td>
            <td>${r.charged.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}