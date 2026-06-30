import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type BriefRow = {
  id: string;
  project_name: string;
  status: "draft" | "locked" | "in_production" | "live" | "archived";
  deadline: string | null;
  updated_at: string;
  brand: { name: string } | null;
};

const STATUSES: BriefRow["status"][] = ["draft", "locked", "in_production", "live", "archived"];

function Dashboard() {
  const qc = useQueryClient();

  const { data: briefs = [], isLoading } = useQuery({
    queryKey: ["briefs", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefs")
        .select("id, project_name, status, deadline, updated_at, brand:brands(name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BriefRow[];
    },
  });

  // realtime would be nice; for now just refetch on focus
  useEffect(() => {
    const h = () => qc.invalidateQueries({ queryKey: ["briefs", "all"] });
    window.addEventListener("focus", h);
    return () => window.removeEventListener("focus", h);
  }, [qc]);

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = briefs.filter((b) => b.status === s).length;
    return acc;
  }, {});

  const inProd = briefs.filter((b) => b.status === "in_production");
  const live = briefs.filter((b) => b.status === "live");

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
        <div>
          <p className="label-mono mb-2">Control Room</p>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Production at a glance — what's in flight, what's live, what needs a push.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button asChild variant="outline">
            <Link to="/brands">
              <Plus className="h-4 w-4" />
              New Brand
            </Link>
          </Button>
          <Button asChild>
            <Link to="/briefs">
              <Plus className="h-4 w-4" />
              New Brief
            </Link>
          </Button>
        </div>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-12">
        {STATUSES.map((s) => (
          <StatusCard key={s} label={s.replace("_", " ")} count={counts[s] ?? 0} accent={s === "live" || s === "in_production"} />
        ))}
      </div>

      {/* Two columns */}
      <div className="grid md:grid-cols-2 gap-8">
        <BriefColumn title="In Production" briefs={inProd} loading={isLoading} empty="Nothing in production." />
        <BriefColumn title="Live" briefs={live} loading={isLoading} empty="No campaigns live." />
      </div>
    </div>
  );
}

function StatusCard({ label, count, accent }: { label: string; count: number; accent?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-[3px] p-5">
      <p className="label-mono">{label}</p>
      <p className={"font-display text-4xl font-bold mt-3 " + (accent && count > 0 ? "text-[var(--color-rec)]" : "")}>
        {count.toString().padStart(2, "0")}
      </p>
    </div>
  );
}

function BriefColumn({
  title,
  briefs,
  loading,
  empty,
}: {
  title: string;
  briefs: BriefRow[];
  loading: boolean;
  empty: string;
}) {
  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-4 pb-3 border-b border-border">
        <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
        <span className="label-mono">{briefs.length} item{briefs.length === 1 ? "" : "s"}</span>
      </div>
      {loading ? (
        <p className="label-mono py-8">Loading…</p>
      ) : briefs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {briefs.map((b) => (
            <li key={b.id}>
              <Link
                to="/briefs"
                className="group flex items-center justify-between gap-4 bg-card border border-border hover:border-foreground rounded-[3px] px-4 py-3 transition-colors"
              >
                <div className="min-w-0">
                  <p className="label-mono mb-1">{b.brand?.name ?? "—"}</p>
                  <p className="font-medium truncate">{b.project_name}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {b.deadline && <span className="label-mono">{b.deadline}</span>}
                  <ArrowUpRight className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}