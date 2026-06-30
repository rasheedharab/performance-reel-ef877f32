import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, ShieldOff, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users/")({
  component: AdminUsersPage,
});

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "super_admin" | "user";
  account_status: "active" | "suspended";
  display_currency: "USD" | "INR";
  fx_rate_inr_per_usd: number;
  markup_multiplier: number;
  low_balance_threshold: number;
  updated_at: string;
};

type BalanceRow = {
  available: number;
  total_topped_up: number;
  total_consumed: number;
  reserved_amount: number;
};

function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  const { data: users = [] } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, account_status, display_currency, fx_rate_inr_per_usd, markup_multiplier, low_balance_threshold, updated_at",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const { data: balances = {} } = useQuery({
    queryKey: ["admin", "balances", users.map((u) => u.id).join(",")],
    enabled: users.length > 0,
    queryFn: async () => {
      const out: Record<string, BalanceRow> = {};
      await Promise.all(
        users.map(async (u) => {
          const { data } = await supabase.rpc("get_balance", { p_user_id: u.id });
          if (data?.[0]) out[u.id] = data[0] as BalanceRow;
        }),
      );
      return out;
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (u: ProfileRow) => {
      const next = u.account_status === "active" ? "suspended" : "active";
      const { error } = await supabase
        .from("profiles")
        .update({ account_status: next })
        .eq("id", u.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u) => {
    if (statusFilter !== "all" && u.account_status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <p className="label-mono mb-2">Super Admin</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Manage accounts, top up credits, set spend controls.
          </p>
        </div>
        <InviteUser onDone={() => qc.invalidateQueries({ queryKey: ["admin", "users"] })} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "active", "suspended"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "label-mono text-[10px] px-3 py-1.5 border rounded-[3px] transition-colors",
                statusFilter === s
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-border rounded-[3px] bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left label-mono text-[10px] text-muted-foreground border-b border-border bg-muted/30">
              <th className="py-3 px-4">User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Currency</th>
              <th>Balance</th>
              <th>Topped up</th>
              <th>Consumed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const b = balances[u.id];
              return (
                <tr key={u.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-3 px-4">
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: u.id }}
                      className="font-medium hover:text-[var(--color-rec)]"
                    >
                      {u.full_name || u.email || u.id.slice(0, 8)}
                    </Link>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td>
                    <span className="label-mono text-[10px]">{u.role}</span>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "inline-flex font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
                        u.account_status === "active"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-[var(--color-rec)] text-white border-[var(--color-rec)]",
                      )}
                    >
                      {u.account_status}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{u.display_currency}</td>
                  <td className="font-mono text-xs">
                    {b ? Number(b.available).toFixed(2) : "…"}
                  </td>
                  <td className="font-mono text-xs">
                    {b ? Number(b.total_topped_up).toFixed(2) : "…"}
                  </td>
                  <td className="font-mono text-xs">
                    {b ? Number(b.total_consumed).toFixed(2) : "…"}
                  </td>
                  <td className="text-right pr-4">
                    <button
                      onClick={() => toggleStatus.mutate(u)}
                      title={u.account_status === "active" ? "Suspend" : "Activate"}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      {u.account_status === "active" ? (
                        <ShieldOff className="h-4 w-4" />
                      ) : (
                        <Shield className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InviteUser({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "super_admin">("user");
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const [fx, setFx] = useState("83");
  const [markup, setMarkup] = useState("1.5");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      // Inviting users requires admin Auth API; surfaced via edge function or manual onboarding.
      // For now: instruct the super admin that the user must sign in once, then configure here.
      toast.message("Send the user a sign-in link", {
        description:
          "After they sign in once, refresh this list — you can then set their role, currency, FX rate, and markup from their detail page.",
      });
      console.log("invite intent", { email, role, currency, fx, markup });
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        Invite user
      </Button>
    );

  return (
    <div className="border border-border rounded-[3px] bg-card p-4 w-[360px]">
      <p className="label-mono text-[10px] mb-3">New user</p>
      <div className="space-y-2">
        <Input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "super_admin")}
            className="border border-border rounded-[3px] bg-background px-2 py-2 text-sm"
          >
            <option value="user">user</option>
            <option value="super_admin">super_admin</option>
          </select>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "INR")}
            className="border border-border rounded-[3px] bg-background px-2 py-2 text-sm"
          >
            <option>USD</option>
            <option>INR</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="FX (INR/USD)" value={fx} onChange={(e) => setFx(e.target.value)} />
          <Input placeholder="Markup" value={markup} onChange={(e) => setMarkup(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy || !email} className="flex-1">
          Send invite
        </Button>
      </div>
    </div>
  );
}