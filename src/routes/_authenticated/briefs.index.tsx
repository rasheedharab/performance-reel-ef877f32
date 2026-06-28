import { useEffect, useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, FileText } from "lucide-react";
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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("briefs")
        .select(
          "id, project_name, status, objective, deadline, brand:brands(id, name)",
        )
        .order("created_at", { ascending: false });
      if (error) return;
      setBriefs(data as unknown as BriefRow[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!briefs) return null;
    if (filter === "all") return briefs;
    return briefs.filter((b) => b.status === filter);
  }, [briefs, filter]);

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

      {filtered === null ? (
        <div className="border border-border rounded-[3px] bg-card animate-pulse h-64" />
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
          <p className="label-mono mb-3">Empty reel</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            {filter === "all"
              ? "No briefs yet. Spin up your first project intake."
              : `No briefs in “${filter.replace("_", " ")}”.`}
          </p>
          {filter === "all" && (
            <Button asChild>
              <Link to="/briefs/new">
                <Plus className="h-4 w-4" />
                New Brief
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-[3px] bg-card overflow-hidden">
          <div className="grid grid-cols-[1.4fr_2fr_1fr_1fr_0.8fr] gap-4 px-5 py-3 border-b border-border label-mono text-[10px]">
            <span>Brand</span>
            <span>Project</span>
            <span>Status</span>
            <span>Objective</span>
            <span>Deadline</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((b) => (
              <li key={b.id}>
                <Link
                  to="/briefs/$briefId"
                  params={{ briefId: b.id }}
                  className="grid grid-cols-[1.4fr_2fr_1fr_1fr_0.8fr] gap-4 px-5 py-4 items-center hover:bg-background/60 transition-colors"
                >
                  <span className="text-sm font-medium truncate">
                    {b.brand?.name ?? "—"}
                  </span>
                  <span className="text-sm truncate flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{b.project_name}</span>
                  </span>
                  <span>
                    <StatusChip status={b.status} />
                  </span>
                  <span className="text-sm text-muted-foreground capitalize">
                    {b.objective ?? "—"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {b.deadline ?? "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}