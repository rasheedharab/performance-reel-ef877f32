import { useEffect, useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, FileText, Calendar, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type BriefStatus = Database["public"]["Enums"]["brief_status"];

type BriefRow = {
  id: string;
  project_name: string;
  status: BriefStatus;
  objective: string | null;
  deadline: string | null;
  created_at?: string | null;
  brand: { id: string; name: string } | null;
};

const STATUSES: BriefStatus[] = ["draft", "locked", "in_production", "live", "archived"];

export const Route = createFileRoute("/_authenticated/briefs/")({
  component: BriefsListPage,
});

function StatusChip({ status }: { status: BriefStatus }) {
  const styles: Record<BriefStatus, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    locked: "bg-foreground text-background border-foreground",
    in_production: "bg-[var(--color-rec)] text-white border-[var(--color-rec)]",
    live: "bg-emerald-600 text-white border-emerald-600",
    archived: "bg-transparent text-muted-foreground/60 border-border/60",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
        styles[status],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function BriefsListPage() {
  const [briefs, setBriefs] = useState<BriefRow[] | null>(null);
  const [filter, setFilter] = useState<BriefStatus | "all">("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("briefs")
        .select(
          "id, project_name, status, objective, deadline, created_at, brand:brands(id, name)",
        )
        .order("created_at", { ascending: false });
      if (error) return;
      setBriefs(data as unknown as BriefRow[]);
    })();
  }, []);

  const brands = useMemo(() => {
    if (!briefs) return [];
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const b of briefs) {
      if (!b.brand) continue;
      const cur = m.get(b.brand.id);
      if (cur) cur.count += 1;
      else m.set(b.brand.id, { id: b.brand.id, name: b.brand.name, count: 1 });
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [briefs]);

  const filtered = useMemo(() => {
    if (!briefs) return null;
    return briefs.filter(
      (b) =>
        (filter === "all" || b.status === filter) &&
        (brandFilter === "all" || b.brand?.id === brandFilter),
    );
  }, [briefs, filter, brandFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const s of STATUSES) c[s] = 0;
    if (briefs) {
      c.all = briefs.length;
      for (const b of briefs) c[b.status] = (c[b.status] ?? 0) + 1;
    }
    return c;
  }, [briefs]);

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <p className="label-mono mb-2">Project intake</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">Briefs</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Locked creative briefs — the source of truth for every ad.
          </p>
        </div>
        <Button asChild>
          <Link to="/briefs/new">
            <Plus className="h-4 w-4" />
            New Brief
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border rounded-[3px] transition-colors",
              filter === s
                ? "bg-foreground text-background border-foreground"
                : "border-border hover:border-foreground/40 text-muted-foreground",
            )}
          >
            {s.replace("_", " ")} · {counts[s] ?? 0}
          </button>
        ))}
      </div>

      {brands.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="label-mono mr-1">Brand</span>
          <button
            onClick={() => setBrandFilter("all")}
            className={cn(
              "font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border rounded-[3px] transition-colors",
              brandFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "border-border hover:border-foreground/40 text-muted-foreground",
            )}
          >
            all · {briefs?.length ?? 0}
          </button>
          {brands.map((br) => (
            <button
              key={br.id}
              onClick={() => setBrandFilter(br.id)}
              className={cn(
                "font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border rounded-[3px] transition-colors",
                brandFilter === br.id
                  ? "bg-foreground text-background border-foreground"
                  : "border-border hover:border-foreground/40 text-muted-foreground",
              )}
            >
              {br.name} · {br.count}
            </button>
          ))}
        </div>
      )}

      {filtered === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-[3px] border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
          <p className="label-mono mb-3">Empty reel</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            {filter === "all" && brandFilter === "all"
              ? "No briefs yet. Spin up your first project intake."
              : "No briefs match these filters."}
          </p>
          {filter === "all" && brandFilter === "all" && (
            <Button asChild>
              <Link to="/briefs/new">
                <Plus className="h-4 w-4" />
                New Brief
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <Link
              key={b.id}
              to="/briefs/$briefId"
              params={{ briefId: b.id }}
              className="group bg-card border border-border rounded-[3px] p-5 hover:border-foreground/30 transition-colors flex flex-col"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0 flex-1">
                  <p className="label-mono mb-1 truncate">
                    {b.brand?.name ?? "No brand"}
                  </p>
                  <h2 className="font-display font-bold text-lg leading-tight line-clamp-2 flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    <span className="truncate">{b.project_name}</span>
                  </h2>
                </div>
                <StatusChip status={b.status} />
              </div>

              <div className="mt-auto space-y-2 pt-3 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Target className="h-3.5 w-3.5 shrink-0" />
                  <span className="capitalize truncate">
                    {b.objective ?? "No objective"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono">
                    {b.deadline ?? "No deadline"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}