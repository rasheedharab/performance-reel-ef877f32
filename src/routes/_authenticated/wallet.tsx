import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWallet, formatCurrency } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

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

type Tab =
  | "by-brief"
  | "by-brand"
  | "by-entity"
  | "by-op"
  | "by-model"
  | "by-time"
  | "ledger";

function WalletPage() {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("by-brief");
  const [search, setSearch] = useState("");

  const { data: ledger = [], refetch: refLedger, isLoading } = useQuery({
    queryKey: ["wallet", "ledger", wallet.profile?.id],
    enabled: !!wallet.profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select(
          "id, type, status, amount, usd_cost, currency, operation, model_id, entity_type, entity_id, brand_id, brief_id, note, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Ledger[];
    },
  });

  const { data: brandsMap = {} } = useQuery({
    queryKey: ["wallet", "brands-map", wallet.profile?.id],
    enabled: !!wallet.profile?.id,
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name");
      return (data ?? []).reduce<Record<string, string>>((acc, b) => {
        acc[b.id] = b.name as string;
        return acc;
      }, {});
    },
  });
  const { data: briefsMap = {} } = useQuery({
    queryKey: ["wallet", "briefs-map", wallet.profile?.id],
    enabled: !!wallet.profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("briefs")
        .select("id, project_name, brand_id");
      return (data ?? []).reduce<
        Record<string, { name: string; brand_id: string | null }>
      >((acc, b) => {
        acc[b.id] = {
          name: (b.project_name as string) || b.id.slice(0, 8),
          brand_id: (b.brand_id as string) ?? null,
        };
        return acc;
      }, {});
    },
  });

  // Spent shown to the user = currency amount they were charged (magnitude).
  const debits = useMemo(
    () =>
      ledger.filter(
        (l) =>
          l.type === "debit" && (l.status === "captured" || l.status === "reserved"),
      ),
    [ledger],
  );

  function groupBy(getKey: (r: Ledger) => string, getLabel?: (r: Ledger) => string) {
    const agg: Record<string, { label: string; spent: number; count: number }> = {};
    for (const r of debits) {
      const k = getKey(r) || "—";
      const label = (getLabel ? getLabel(r) : k) || "—";
      agg[k] = agg[k] ?? { label, spent: 0, count: 0 };
      agg[k].spent += -Number(r.amount);
      agg[k].count += 1;
    }
    return Object.entries(agg)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.spent - a.spent);
  }

  const byBrief = useMemo(
    () =>
      groupBy(
        (r) => r.brief_id ?? "—",
        (r) => (r.brief_id ? briefsMap[r.brief_id]?.name ?? r.brief_id.slice(0, 8) : "Unassigned"),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debits, briefsMap],
  );
  const byBrand = useMemo(
    () =>
      groupBy(
        (r) => r.brand_id ?? "—",
        (r) => (r.brand_id ? brandsMap[r.brand_id] ?? r.brand_id.slice(0, 8) : "Unassigned"),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debits, brandsMap],
  );
  const byEntity = useMemo(
    () =>
      groupBy(
        (r) => `${r.entity_type}:${r.entity_id ?? "—"}`,
        (r) =>
          `${r.entity_type}${r.entity_id ? " · " + r.entity_id.slice(0, 8) : ""}`,
      ),
    [debits],
  );
  const byOp = useMemo(() => groupBy((r) => r.operation ?? "—"), [debits]);
  const byModel = useMemo(() => groupBy((r) => r.model_id ?? "—"), [debits]);
  const byDay = useMemo(() => {
    const agg: Record<string, { label: string; spent: number; count: number }> = {};
    for (const r of debits) {
      const d = (r.created_at || "").slice(0, 10);
      agg[d] = agg[d] ?? { label: d, spent: 0, count: 0 };
      agg[d].spent += -Number(r.amount);
      agg[d].count += 1;
    }
    return Object.entries(agg)
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [debits]);

  // Filtered ledger for the transaction history tab.
  const filteredLedger = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ledger;
    return ledger.filter((r) => {
      const fields = [
        r.operation,
        r.model_id,
        r.entity_type,
        r.note,
        r.brand_id ? brandsMap[r.brand_id] : "",
        r.brief_id ? briefsMap[r.brief_id]?.name : "",
      ];
      return fields.some((f) => (f ?? "").toString().toLowerCase().includes(q));
    });
  }, [search, ledger, brandsMap, briefsMap]);

  function exportCsv() {
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
      "currency",
      "note",
    ];
    const rows = filteredLedger.map((r) => [
      r.id,
      r.created_at,
      r.type,
      r.status,
      r.operation ?? "",
      r.model_id ?? "",
      r.entity_type,
      r.entity_id ?? "",
      r.brand_id ? brandsMap[r.brand_id] ?? r.brand_id : "",
      r.brief_id ? briefsMap[r.brief_id]?.name ?? r.brief_id : "",
      r.amount,
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
    a.download = `wallet-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const lowBalance =
    wallet.profile != null &&
    wallet.balance != null &&
    wallet.balance.available < (wallet.profile.low_balance_threshold ?? 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <p className="label-mono text-[var(--color-rec)] mb-1">WALLET</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Wallet &amp; Usage
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your balance, where it's going, and the full ledger.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => wallet.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </header>

      {/* Balance band */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <BalanceCard
          big
          label="Available"
          value={wallet.balance ? wallet.format(wallet.balance.available) : "—"}
          icon={<Wallet className="h-4 w-4" />}
          accent
        />
        <BalanceCard
          label="Reserved · pending"
          value={wallet.balance ? wallet.format(wallet.balance.reserved_amount) : "—"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <BalanceCard
          label="Total topped up"
          value={wallet.balance ? wallet.format(wallet.balance.total_topped_up) : "—"}
          icon={<ArrowDownToLine className="h-4 w-4" />}
        />
        <BalanceCard
          label="Total consumed"
          value={wallet.balance ? wallet.format(wallet.balance.total_consumed) : "—"}
          icon={<ArrowUpFromLine className="h-4 w-4" />}
        />
      </div>

      {lowBalance && (
        <div className="border-l-2 border-[var(--color-rec)] bg-[oklch(0.97_0.02_25)] dark:bg-[oklch(0.22_0.08_25)] p-4 rounded-r-[3px] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[var(--color-rec)] shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-display font-bold text-[var(--color-rec)] mb-0.5">
              Low balance
            </p>
            <p className="text-muted-foreground">
              You're under your{" "}
              <span className="font-mono">
                {wallet.format(wallet.profile!.low_balance_threshold)}
              </span>{" "}
              threshold. Generations may fail soon — contact your admin to top
              up.
            </p>
          </div>
        </div>
      )}

      {/* My usage — tabs */}
      <section>
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-display text-lg font-bold">My usage</h2>
          <div className="flex gap-1 flex-wrap">
            {(
              [
                ["by-brief", "By project / brief"],
                ["by-brand", "By brand"],
                ["by-entity", "By angle/script/shot"],
                ["by-op", "By operation"],
                ["by-model", "By model"],
                ["by-time", "Over time"],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "label-mono px-2.5 py-1 border rounded-[2px] transition-colors",
                  tab === k
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-[3px] bg-card overflow-hidden">
          {tab === "by-brief" && (
            <BreakdownTable
              rows={byBrief.map((r) => ({
                key: r.key,
                label: r.label,
                link:
                  r.key !== "—" && briefsMap[r.key]
                    ? { to: "/briefs/$briefId" as const, params: { briefId: r.key } }
                    : undefined,
                spent: r.spent,
                count: r.count,
              }))}
              currency={wallet.currency}
              empty="No spend on any brief yet."
            />
          )}
          {tab === "by-brand" && (
            <BreakdownTable
              rows={byBrand.map((r) => ({
                key: r.key,
                label: r.label,
                link:
                  r.key !== "—" && brandsMap[r.key]
                    ? { to: "/brands/$brandId" as const, params: { brandId: r.key } }
                    : undefined,
                spent: r.spent,
                count: r.count,
              }))}
              currency={wallet.currency}
              empty="No spend yet."
            />
          )}
          {tab === "by-entity" && (
            <BreakdownTable
              rows={byEntity.map((r) => ({
                key: r.key,
                label: r.label,
                spent: r.spent,
                count: r.count,
              }))}
              currency={wallet.currency}
              empty="No spend tied to an entity yet."
            />
          )}
          {tab === "by-op" && (
            <BreakdownTable
              rows={byOp}
              currency={wallet.currency}
              empty="No spend yet."
            />
          )}
          {tab === "by-model" && (
            <BreakdownTable
              rows={byModel}
              currency={wallet.currency}
              empty="No spend yet."
            />
          )}
          {tab === "by-time" && (
            <BreakdownTable
              rows={byDay}
              currency={wallet.currency}
              labelHeader="Day"
              empty="No spend yet."
            />
          )}
        </div>
      </section>

      {/* Transactions */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-display text-lg font-bold">Transaction history</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ledger…"
                className="pl-7 h-8 w-56 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => refLedger()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-[3px] bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <Th>When</Th>
                <Th>Type</Th>
                <Th>For</Th>
                <Th>Operation · model</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No transactions yet.
                  </td>
                </tr>
              )}
              {filteredLedger.map((r) => {
                const briefName = r.brief_id
                  ? briefsMap[r.brief_id]?.name
                  : null;
                const brandName = r.brand_id ? brandsMap[r.brand_id] : null;
                const positive = Number(r.amount) >= 0;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <TypeChip type={r.type} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="space-y-0.5">
                        {briefName && (
                          <Link
                            to="/briefs/$briefId"
                            params={{ briefId: r.brief_id! }}
                            className="text-xs hover:underline underline-offset-2"
                          >
                            {briefName}
                          </Link>
                        )}
                        {brandName && (
                          <div className="text-[11px] text-muted-foreground">
                            {brandName}
                          </div>
                        )}
                        {!briefName && !brandName && (
                          <span className="text-[11px] text-muted-foreground">
                            {r.entity_type === "none" ? "—" : r.entity_type}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-[11px]">
                      <div>{r.operation ?? "—"}</div>
                      {r.model_id && (
                        <div className="text-muted-foreground truncate max-w-[200px]">
                          {r.model_id}
                        </div>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 align-top font-mono text-right whitespace-nowrap",
                        positive ? "text-emerald-700" : "text-[var(--color-rec)]",
                      )}
                    >
                      {positive ? "+" : ""}
                      {formatCurrency(Number(r.amount), r.currency)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <StatusChip status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  icon,
  big,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[3px] border p-4",
        accent
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2 label-mono mb-1.5 opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "font-display font-bold tracking-tight tabular-nums",
          big ? "text-4xl" : "text-2xl",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "label-mono text-left px-3 py-2 text-muted-foreground font-normal",
        className,
      )}
    >
      {children}
    </th>
  );
}

function TypeChip({ type }: { type: Ledger["type"] }) {
  const styles: Record<Ledger["type"], string> = {
    topup: "bg-emerald-50 text-emerald-800 border-emerald-200",
    debit: "bg-muted text-foreground border-border",
    refund: "bg-amber-50 text-amber-800 border-amber-200",
    adjustment: "bg-blue-50 text-blue-800 border-blue-200",
  };
  return (
    <span
      className={cn(
        "inline-block font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px]",
        styles[type],
      )}
    >
      {type}
    </span>
  );
}

function StatusChip({ status }: { status: Ledger["status"] }) {
  const styles: Record<Ledger["status"], string> = {
    captured: "bg-foreground text-background border-foreground",
    posted: "bg-foreground text-background border-foreground",
    reserved: "bg-amber-50 text-amber-800 border-amber-200",
    refunded: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-block font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px]",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

type BreakdownRow = {
  key: string;
  label: string;
  spent: number;
  count: number;
  link?:
    | { to: "/briefs/$briefId"; params: { briefId: string } }
    | { to: "/brands/$brandId"; params: { brandId: string } };
};

function BreakdownTable({
  rows,
  currency,
  labelHeader = "",
  empty,
}: {
  rows: BreakdownRow[];
  currency: string;
  labelHeader?: string;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.spent)) || 1;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/40 border-b border-border">
          <Th>{labelHeader}</Th>
          <Th className="text-right">Operations</Th>
          <Th className="text-right">Amount</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.key}
            className="border-b border-border last:border-0 hover:bg-muted/20"
          >
            <td className="px-3 py-2 align-top">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  {r.link ? (
                    r.link.to === "/briefs/$briefId" ? (
                      <Link
                        to="/briefs/$briefId"
                        params={r.link.params as { briefId: string }}
                        className="text-sm hover:underline underline-offset-2"
                      >
                        {r.label}
                      </Link>
                    ) : (
                      <Link
                        to="/brands/$brandId"
                        params={r.link.params as { brandId: string }}
                        className="text-sm hover:underline underline-offset-2"
                      >
                        {r.label}
                      </Link>
                    )
                  ) : (
                    <span className="text-sm">{r.label}</span>
                  )}
                  <div className="h-1 mt-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-rec)]"
                      style={{ width: `${(r.spent / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </td>
            <td className="px-3 py-2 align-top text-right font-mono text-xs text-muted-foreground tabular-nums">
              {r.count}
            </td>
            <td className="px-3 py-2 align-top text-right font-mono tabular-nums">
              {formatCurrency(r.spent, currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}