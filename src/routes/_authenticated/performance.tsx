import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowLeft,
  BookmarkPlus,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FlaskConical,
  Plus,
  Save,
  Search,
  Sparkles,
  Target,
  Trophy,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const searchSchema = z.object({
  campaign: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/performance")({
  validateSearch: searchSchema,
  component: PerformancePage,
});

// ---------------- Types ----------------
type Placement = "reels" | "feed" | "stories";
type TestCellStatus = "planned" | "live" | "paused" | "winner" | "killed";
type MetricAction =
  | "none"
  | "scale"
  | "iterate_hook"
  | "iterate_body"
  | "iterate_offer"
  | "kill";

type BriefRow = {
  id: string;
  project_name: string | null;
  objective: string | null;
  kpi_type: string | null;
  kpi_target: string | null;
  brand: { id: string; name: string } | null;
};

type CampaignRow = {
  id: string;
  brief_id: string;
  meta_campaign_name: string | null;
  primary_metric: string | null;
  daily_budget: number | null;
  start_date: string | null;
  status: string | null;
  brief: BriefRow | null;
};

type AngleRow = {
  id: string;
  title: string;
  entry_point: string | null;
  status: string | null;
};

type DeliverableRow = {
  id: string;
  placement: Placement | null;
  filename: string | null;
};

type TestCellRow = {
  id: string;
  campaign_id: string;
  deliverable_id: string | null;
  angle_id: string | null;
  ad_name: string | null;
  hook_label: string | null;
  format_label: string | null;
  status: TestCellStatus;
};

type MetricRow = {
  id: string;
  test_cell_id: string | null;
  deliverable_id: string | null;
  date: string | null;
  spend: number | null;
  impressions: number | null;
  three_sec_views: number | null;
  reach: number | null;
  clicks: number | null;
  conversions: number | null;
  hook_rate: number | null;
  hold_rate: number | null;
  thumbstop_rate: number | null;
  ctr: number | null;
  cpa: number | null;
  roas: number | null;
  diagnosis: string | null;
  action_taken: MetricAction;
  notes: string | null;
};

// ---------------- Benchmarks ----------------
const BENCH = {
  hook: { green: 0.25, amber: 0.15 }, // 3-sec view rate
  hold: { green: 0.15, amber: 0.08 }, // hold / thru-play
  ctr: { green: 0.015, amber: 0.008 },
};

type Stage = "hook" | "hold" | "click" | "convert";
type Tier = "green" | "amber" | "red" | "na";

function tierAbove(value: number | null, green: number, amber: number): Tier {
  if (value == null || !Number.isFinite(value)) return "na";
  if (value >= green) return "green";
  if (value >= amber) return "amber";
  return "red";
}

function tierBelow(value: number | null, green: number, amber: number): Tier {
  // For CPA: lower is better
  if (value == null || !Number.isFinite(value)) return "na";
  if (value <= green) return "green";
  if (value <= amber) return "amber";
  return "red";
}

const TIER_STYLES: Record<Tier, string> = {
  green: "bg-emerald-100 border-emerald-700 text-emerald-900",
  amber: "bg-amber-100 border-amber-700 text-amber-900",
  red: "bg-red-100 border-red-700 text-red-900",
  na: "bg-muted/40 border-muted-foreground/40 text-muted-foreground",
};

const TIER_DOT: Record<Tier, string> = {
  green: "bg-emerald-600",
  amber: "bg-amber-500",
  red: "bg-red-600",
  na: "bg-muted-foreground/40",
};

const STATUS_STYLES: Record<TestCellStatus, string> = {
  planned: "border-muted-foreground text-muted-foreground",
  live: "border-[var(--color-rec)] text-[var(--color-rec)]",
  paused: "border-amber-600 text-amber-700",
  winner: "border-emerald-700 text-emerald-700",
  killed: "border-red-700 text-red-700 opacity-70",
};

const ACTIONS: { id: MetricAction; label: string }[] = [
  { id: "none", label: "—" },
  { id: "scale", label: "Scale" },
  { id: "iterate_hook", label: "Iterate hook" },
  { id: "iterate_body", label: "Iterate body" },
  { id: "iterate_offer", label: "Iterate offer" },
  { id: "kill", label: "Kill" },
];

type AiDiagnosis = {
  weakest_stage: Stage | "none";
  diagnosis: string;
  recommended_action: MetricAction;
  confidence_note: string;
};

const PLACEMENT_LABEL: Record<Placement, { label: string; ratio: string }> = {
  reels: { label: "Reels", ratio: "9:16" },
  feed: { label: "Feed", ratio: "4:5" },
  stories: { label: "Stories", ratio: "9:16" },
};

// ---------------- Helpers ----------------
function parseTargetNumber(target: string | null): number | null {
  if (!target) return null;
  const m = target.match(/[\d]+(?:\.[\d]+)?/);
  return m ? Number(m[0]) : null;
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function num(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function copy(text: string) {
  void navigator.clipboard.writeText(text);
  toast.success("Copied");
}

function downloadFile(name: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Aggregate metrics across all rows for a test cell
type Aggregate = {
  spend: number;
  impressions: number;
  three_sec_views: number;
  reach: number;
  clicks: number;
  conversions: number;
  hook_rate: number | null;
  hold_rate: number | null;
  thumbstop_rate: number | null;
  ctr: number | null;
  cpa: number | null;
  roas: number | null;
  diagnosis: string | null;
  action_taken: MetricAction;
  rows: number;
  latest: MetricRow | null;
};

function aggregate(rows: MetricRow[]): Aggregate {
  const sum = (k: keyof MetricRow) =>
    rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const spend = sum("spend");
  const impressions = sum("impressions");
  const three = sum("three_sec_views");
  const reach = sum("reach");
  const clicks = sum("clicks");
  const conv = sum("conversions");
  const hook_rate = impressions ? three / impressions : null;
  const ctr = impressions ? clicks / impressions : null;
  const thumbstop_rate = reach ? three / reach : null;
  const cpa = conv ? spend / conv : null;
  // hold_rate not derivable from raw — average from rows that have it
  const holds = rows.map((r) => r.hold_rate).filter((v): v is number => v != null);
  const hold_rate = holds.length
    ? holds.reduce((a, b) => a + b, 0) / holds.length
    : null;
  const roases = rows.map((r) => r.roas).filter((v): v is number => v != null);
  const roas = roases.length
    ? roases.reduce((a, b) => a + b, 0) / roases.length
    : null;
  const latest = rows.length
    ? [...rows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0]
    : null;
  return {
    spend,
    impressions,
    three_sec_views: three,
    reach,
    clicks,
    conversions: conv,
    hook_rate,
    hold_rate,
    thumbstop_rate,
    ctr,
    cpa,
    roas,
    diagnosis: latest?.diagnosis ?? null,
    action_taken: latest?.action_taken ?? "none",
    rows: rows.length,
    latest,
  };
}

function diagnose(
  agg: Aggregate,
  cpaTarget: number | null,
): { tiers: Record<Stage, Tier>; suggestion: string } {
  const hookT = tierAbove(agg.hook_rate, BENCH.hook.green, BENCH.hook.amber);
  const holdT = tierAbove(agg.hold_rate, BENCH.hold.green, BENCH.hold.amber);
  const clickT = tierAbove(agg.ctr, BENCH.ctr.green, BENCH.ctr.amber);
  let convertT: Tier = "na";
  if (cpaTarget != null && agg.cpa != null) {
    convertT = tierBelow(agg.cpa, cpaTarget, cpaTarget * 1.5);
  } else if (agg.roas != null) {
    convertT = tierAbove(agg.roas, 2, 1);
  }

  let suggestion = "Log more data to read the funnel.";
  const weak = (t: Tier) => t === "red";
  if (agg.rows === 0) {
    suggestion = "No metrics yet — log spend & impressions to start the read.";
  } else if (weak(hookT)) {
    suggestion =
      "Hook is weak — recut the first 3 seconds. The thumb keeps scrolling.";
  } else if (weak(holdT)) {
    suggestion =
      "Hook works, body's weak — tighten the middle and earn the watch.";
  } else if (weak(clickT)) {
    suggestion =
      "They watch but don't click — sharpen the offer, CTA, and end card.";
  } else if (weak(convertT)) {
    suggestion =
      "Eyeballs without economics — test offer/price/landing page, not the creative.";
  } else if (
    [hookT, holdT, clickT, convertT].every(
      (t) => t === "green" || t === "amber",
    )
  ) {
    suggestion =
      "Winner — scale this variant and spin new hooks on the same body.";
  } else {
    suggestion = "Promising — keep spending and recheck once data is denser.";
  }
  return {
    tiers: { hook: hookT, hold: holdT, click: clickT, convert: convertT },
    suggestion,
  };
}

// ---------------- Page ----------------
function PerformancePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    search.campaign ?? null,
  );
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");

  const [cells, setCells] = useState<TestCellRow[]>([]);
  const [angles, setAngles] = useState<AngleRow[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [csvOpen, setCsvOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiResults, setAiResults] = useState<Record<string, AiDiagnosis>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiBatch, setAiBatch] = useState<{ done: number; total: number } | null>(
    null,
  );

  useEffect(() => {
    void loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedId) void loadContext(selectedId);
    else {
      setCells([]);
      setAngles([]);
      setDeliverables([]);
      setMetrics([]);
    }
  }, [selectedId]);

  async function loadCampaigns() {
    const { data, error } = await supabase
      .from("campaigns")
      .select(
        "id, brief_id, meta_campaign_name, primary_metric, daily_budget, start_date, status, brief:briefs(id, project_name, objective, kpi_type, kpi_target, brand:brands(id, name))",
      )
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Failed to load campaigns");
      setCampaigns([]);
      return;
    }
    setCampaigns((data as unknown as CampaignRow[]) ?? []);
  }

  async function loadContext(campaignId: string) {
    setLoading(true);
    const camp = campaigns?.find((c) => c.id === campaignId);
    const briefId = camp?.brief_id;
    const [{ data: tc }, { data: ang }, { data: delv }, { data: met }] =
      await Promise.all([
        supabase.from("test_cells").select("*").eq("campaign_id", campaignId),
        briefId
          ? supabase
              .from("angles")
              .select("id, title, entry_point, status")
              .eq("brief_id", briefId)
          : Promise.resolve({ data: [] as AngleRow[] }),
        supabase
          .from("deliverables")
          .select("id, placement, filename, cut:cuts!inner(brief_id)")
          .eq("cut.brief_id", briefId ?? ""),
        supabase
          .from("metrics")
          .select("*")
          .in(
            "test_cell_id",
            // placeholder — will refilter below
            [],
          ),
      ]);
    const cellRows = (tc as unknown as TestCellRow[]) ?? [];
    setCells(cellRows);
    setAngles((ang as unknown as AngleRow[]) ?? []);
    setDeliverables(
      ((delv as unknown as DeliverableRow[]) ?? []).map((d) => ({
        id: d.id,
        placement: d.placement,
        filename: d.filename,
      })),
    );
    // re-pull metrics with actual cell ids
    if (cellRows.length) {
      const { data: mAll } = await supabase
        .from("metrics")
        .select("*")
        .in(
          "test_cell_id",
          cellRows.map((c) => c.id),
        );
      setMetrics((mAll as unknown as MetricRow[]) ?? []);
    } else {
      setMetrics(met as unknown as MetricRow[]);
    }
    setLoading(false);
  }

  const selected = useMemo(
    () => campaigns?.find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId],
  );

  const filteredCampaigns = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = campaigns ?? [];
    if (!q) return list;
    return list.filter((c) =>
      [c.meta_campaign_name, c.brief?.brand?.name, c.brief?.project_name]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [campaigns, query]);

  // ----- Brief / no campaign picker -----
  if (!selected) {
    return (
      <div className="container max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="label-mono mb-2">PHASE 9 · LEARN</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Performance
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Log results, read the creative funnel (hook → hold → click →
            convert), and close the loop with iterate, scale, or kill.
          </p>
        </div>
        <div className="border border-foreground p-6 rounded-[2px] max-w-2xl">
          <p className="label-mono mb-3">SELECT CAMPAIGN</p>
          <Popover open={picker} onOpenChange={setPicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search by brand, project, or campaign name…
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
            >
              <div className="p-2 border-b">
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to filter…"
                  className="h-8"
                />
              </div>
              <div className="max-h-72 overflow-auto">
                {filteredCampaigns.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No campaigns. Plan one in the Launch module first.
                  </p>
                ) : (
                  filteredCampaigns.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedId(c.id);
                        setPicker(false);
                        void navigate({
                          to: "/performance",
                          search: { campaign: c.id },
                        });
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0"
                    >
                      <p className="font-medium text-sm">
                        {c.brief?.brand?.name ?? "—"} ·{" "}
                        {c.brief?.project_name ?? "Untitled"}
                      </p>
                      <p className="label-mono text-muted-foreground mt-0.5">
                        {c.meta_campaign_name ?? "no name"} ·{" "}
                        {c.brief?.objective ?? "—"}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  }

  const brief = selected.brief;
  const cpaTarget = parseTargetNumber(brief?.kpi_target ?? null);
  const placementsInPlay: Placement[] = Array.from(
    new Set(
      cells
        .map((c) => c.format_label as Placement | null)
        .filter((p): p is Placement => !!p),
    ),
  );

  async function saveMetric(
    cell: TestCellRow,
    patch: Partial<MetricRow>,
    date: string,
  ) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    // upsert per (test_cell_id, date)
    const existing = metrics.find(
      (m) => m.test_cell_id === cell.id && m.date === date,
    );
    if (existing) {
      const { data, error } = await supabase
        .from("metrics")
        .update(patch as never)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setMetrics((prev) =>
        prev.map((m) => (m.id === existing.id ? (data as unknown as MetricRow) : m)),
      );
    } else {
      const { data, error } = await supabase
        .from("metrics")
        .insert({
          user_id: uid,
          test_cell_id: cell.id,
          deliverable_id: cell.deliverable_id ?? undefined,
          date,
          ...patch,
        } as never)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setMetrics((prev) => [...prev, data as unknown as MetricRow]);
    }
  }

  async function updateCellStatus(cellId: string, status: TestCellStatus) {
    setCells((prev) =>
      prev.map((c) => (c.id === cellId ? { ...c, status } : c)),
    );
    await supabase.from("test_cells").update({ status }).eq("id", cellId);
  }

  async function applyAction(cell: TestCellRow, action: MetricAction) {
    const agg = aggregate(metrics.filter((m) => m.test_cell_id === cell.id));
    const date = agg.latest?.date ?? new Date().toISOString().slice(0, 10);
    await saveMetric(cell, { action_taken: action }, date);
    if (action === "scale") void updateCellStatus(cell.id, "winner");
    if (action === "kill") void updateCellStatus(cell.id, "killed");
    if (action === "iterate_hook" || action === "iterate_body") {
      if (cell.angle_id)
        void navigate({ to: "/scripts" });
      toast.success("Action saved — opening Scripts to spin a new variant");
    }
    if (action === "iterate_offer") {
      toast.success(
        "Marked for offer iteration — discuss with the brand and rebrief.",
      );
    }
  }

  async function diagnoseVariant(cell: TestCellRow): Promise<boolean> {
    const cellMetrics = metrics.filter((m) => m.test_cell_id === cell.id);
    const agg = aggregate(cellMetrics);
    const angle = angles.find((a) => a.id === cell.angle_id);
    const camp = selected;
    const briefRow = camp?.brief;
    setAiLoading((prev) => ({ ...prev, [cell.id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: {
          task: "diagnose_variant",
          payload: {
            angle_title: angle?.title ?? null,
            entry_point: angle?.entry_point ?? null,
            archetype: cell.format_label ?? null,
            hook_label: cell.hook_label ?? null,
            hook_text: cell.hook_label ?? null,
            format: cell.format_label ?? null,
            primary_metric: camp?.primary_metric ?? null,
            kpi_type: briefRow?.kpi_type ?? null,
            kpi_target: briefRow?.kpi_target ?? null,
            spend: agg.spend,
            impressions: agg.impressions,
            conversions: agg.conversions,
            hook_rate: agg.hook_rate,
            hold_rate: agg.hold_rate,
            ctr: agg.ctr,
            cpa: agg.cpa,
            roas: agg.roas,
          },
        },
      });
      if (error) throw new Error(error.message);
      const payload = data as { result?: unknown; error?: string };
      if (payload?.error) {
        toast.error(payload.error);
        return false;
      }
      const r = payload?.result as Partial<AiDiagnosis> | undefined;
      if (!r || typeof r !== "object" || typeof r.diagnosis !== "string") {
        toast.error("AI returned an unexpected response. Try again.");
        return false;
      }
      const validStages: Array<Stage | "none"> = [
        "hook",
        "hold",
        "click",
        "convert",
        "none",
      ];
      const validActions: MetricAction[] = [
        "none",
        "scale",
        "iterate_hook",
        "iterate_body",
        "iterate_offer",
        "kill",
      ];
      const clean: AiDiagnosis = {
        weakest_stage: validStages.includes(r.weakest_stage as Stage)
          ? (r.weakest_stage as Stage | "none")
          : "none",
        diagnosis: r.diagnosis,
        recommended_action: validActions.includes(
          r.recommended_action as MetricAction,
        )
          ? (r.recommended_action as MetricAction)
          : "none",
        confidence_note:
          typeof r.confidence_note === "string" ? r.confidence_note : "",
      };
      setAiResults((prev) => ({ ...prev, [cell.id]: clean }));
      // Persist the diagnosis text to the latest metric row
      const date =
        agg.latest?.date ?? new Date().toISOString().slice(0, 10);
      await saveMetric(cell, { diagnosis: clean.diagnosis }, date);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI diagnose failed");
      return false;
    } finally {
      setAiLoading((prev) => {
        const next = { ...prev };
        delete next[cell.id];
        return next;
      });
    }
  }

  async function diagnoseAllLogged() {
    const eligible = cells.filter((c) =>
      metrics.some((m) => m.test_cell_id === c.id),
    );
    if (eligible.length === 0) {
      toast.info("No variants have metrics logged yet.");
      return;
    }
    setAiBatch({ done: 0, total: eligible.length });
    for (let i = 0; i < eligible.length; i++) {
      await diagnoseVariant(eligible[i]);
      setAiBatch({ done: i + 1, total: eligible.length });
    }
    setAiBatch(null);
    toast.success(`Diagnosed ${eligible.length} variant(s)`);
  }

  return (
    <div className="container max-w-7xl mx-auto px-6 py-10">
      <div className="mb-6">
        <button
          onClick={() => {
            setSelectedId(null);
            void navigate({ to: "/performance", search: {} });
          }}
          className="inline-flex items-center gap-1.5 label-mono text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3 w-3" /> Back to campaign select
        </button>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="label-mono mb-1">
              {brief?.brand?.name ?? "—"} · {brief?.project_name ?? "—"}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
              {selected.meta_campaign_name ?? "Untitled campaign"}
              <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 border border-foreground rounded-[2px]">
                {brief?.objective ?? "—"}
              </span>
            </h1>
            <div className="mt-2 flex items-center gap-3 flex-wrap label-mono text-muted-foreground">
              <span>
                Primary metric:{" "}
                <span className="text-foreground">
                  {selected.primary_metric ?? brief?.kpi_type ?? "—"}
                </span>
              </span>
              {brief?.kpi_target && (
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" /> Target:{" "}
                  <span className="text-foreground">{brief.kpi_target}</span>
                </span>
              )}
              <span>{cells.length} variants</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Paste from CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportOpen(true)}
              disabled={cells.length === 0}
            >
              <FileText className="h-3.5 w-3.5" /> Performance report
            </Button>
          </div>
        </div>
      </div>

      {/* Data entry + diagnostic per cell */}
      <section className="space-y-4">
        {cells.length === 0 ? (
          <EmptyHint
            title="No variants in this campaign"
            body="Plan test cells in the Launch & Tests module first, then come back to log results."
          />
        ) : (
          cells.map((cell) => {
            const cellMetrics = metrics.filter(
              (m) => m.test_cell_id === cell.id,
            );
            const agg = aggregate(cellMetrics);
            const angle = angles.find((a) => a.id === cell.angle_id);
            const deliverable = deliverables.find(
              (d) => d.id === cell.deliverable_id,
            );
            const diag = diagnose(agg, cpaTarget);
            return (
              <CellRow
                key={cell.id}
                cell={cell}
                angle={angle}
                deliverable={deliverable}
                agg={agg}
                metrics={cellMetrics}
                diag={diag}
                cpaTarget={cpaTarget}
                brandId={brief?.brand?.id ?? null}
                brandName={brief?.brand?.name ?? null}
                projectName={brief?.project_name ?? null}
                onSave={(patch, date) => saveMetric(cell, patch, date)}
                onSaveDiagnosis={(text) => {
                  const date =
                    agg.latest?.date ?? new Date().toISOString().slice(0, 10);
                  return saveMetric(cell, { diagnosis: text }, date);
                }}
                onAction={(a) => applyAction(cell, a)}
              />
            );
          })
        )}
      </section>

      {/* Heatmap */}
      {cells.length > 0 && (
        <section className="mt-10">
          <div className="mb-4">
            <p className="label-mono mb-1">RESULTS HEATMAP</p>
            <h2 className="font-display text-2xl font-bold">
              Angles × Formats — by {selected.primary_metric ?? "ROAS"}
            </h2>
          </div>
          <Heatmap
            angles={angles}
            placements={placementsInPlay}
            cells={cells}
            metrics={metrics}
            cpaTarget={cpaTarget}
            primaryMetric={selected.primary_metric ?? brief?.kpi_type ?? null}
          />
        </section>
      )}

      {/* Learnings */}
      {cells.length > 0 && (
        <section className="mt-10">
          <LearningsPanel
            angles={angles}
            cells={cells}
            metrics={metrics}
            cpaTarget={cpaTarget}
          />
        </section>
      )}

      {csvOpen && (
        <CsvPasteDialog
          cells={cells}
          onClose={() => setCsvOpen(false)}
          onImport={async (rows) => {
            for (const r of rows) {
              const cell = cells.find(
                (c) =>
                  c.ad_name?.toLowerCase() === r.ad_name.toLowerCase() ||
                  c.id === r.ad_name,
              );
              if (!cell) continue;
              await saveMetric(cell, r.patch, r.date);
            }
            toast.success(`Imported ${rows.length} row(s)`);
            setCsvOpen(false);
          }}
        />
      )}

      {reportOpen && (
        <ReportDialog
          campaign={selected}
          brief={brief}
          cells={cells}
          angles={angles}
          deliverables={deliverables}
          metrics={metrics}
          cpaTarget={cpaTarget}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------- Cell row ----------------
function CellRow({
  cell,
  angle,
  deliverable,
  agg,
  metrics,
  diag,
  cpaTarget,
  brandId,
  brandName,
  projectName,
  onSave,
  onSaveDiagnosis,
  onAction,
}: {
  cell: TestCellRow;
  angle: AngleRow | undefined;
  deliverable: DeliverableRow | undefined;
  agg: Aggregate;
  metrics: MetricRow[];
  diag: { tiers: Record<Stage, Tier>; suggestion: string };
  cpaTarget: number | null;
  brandId: string | null;
  brandName: string | null;
  projectName: string | null;
  onSave: (patch: Partial<MetricRow>, date: string) => Promise<void>;
  onSaveDiagnosis: (text: string) => Promise<void>;
  onAction: (a: MetricAction) => Promise<void>;
}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const latestDate = agg.latest?.date ?? todayISO;
  const [date, setDate] = useState(latestDate);
  const [draft, setDraft] = useState({
    spend: agg.latest?.spend ?? "",
    impressions: agg.latest?.impressions ?? "",
    three_sec_views: agg.latest?.three_sec_views ?? "",
    reach: agg.latest?.reach ?? "",
    clicks: agg.latest?.clicks ?? "",
    conversions: agg.latest?.conversions ?? "",
    hook_rate: agg.latest?.hook_rate ?? "",
    hold_rate: agg.latest?.hold_rate ?? "",
    ctr: agg.latest?.ctr ?? "",
    cpa: agg.latest?.cpa ?? "",
    roas: agg.latest?.roas ?? "",
  });
  const [diagnosisText, setDiagnosisText] = useState(agg.diagnosis ?? "");

  function n(v: string | number | null | undefined): number | null {
    if (v === "" || v == null) return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }

  async function persist() {
    const spend = n(draft.spend);
    const impressions = n(draft.impressions);
    const three = n(draft.three_sec_views);
    const reach = n(draft.reach);
    const clicks = n(draft.clicks);
    const conv = n(draft.conversions);
    // auto-derive if not overridden
    const hook_rate =
      n(draft.hook_rate) ?? (impressions && three ? three / impressions : null);
    const ctr =
      n(draft.ctr) ?? (impressions && clicks ? clicks / impressions : null);
    const thumbstop = reach && three ? three / reach : null;
    const cpa = n(draft.cpa) ?? (spend && conv ? spend / conv : null);
    const hold_rate = n(draft.hold_rate);
    const roas = n(draft.roas);
    await onSave(
      {
        spend,
        impressions,
        three_sec_views: three,
        reach,
        clicks,
        conversions: conv,
        hook_rate,
        ctr,
        thumbstop_rate: thumbstop,
        cpa,
        hold_rate,
        roas,
      },
      date,
    );
    toast.success("Metrics saved");
  }

  return (
    <div className="border border-foreground rounded-[2px]">
      <div className="px-5 py-3 border-b border-foreground bg-muted/40 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm break-words">
              {cell.hook_label || "(no hook label)"}
            </p>
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
                STATUS_STYLES[cell.status],
              )}
            >
              {cell.status}
            </span>
          </div>
          <p className="label-mono text-muted-foreground mt-0.5">
            {angle?.title ?? "—"}
            {angle?.entry_point && <> · {angle.entry_point}</>} ·{" "}
            {cell.format_label
              ? PLACEMENT_LABEL[cell.format_label as Placement]?.label
              : "—"}
            {deliverable?.filename ? <> · {deliverable.filename}</> : null}
          </p>
          <p className="font-mono text-[10px] mt-1 text-muted-foreground break-all">
            {cell.ad_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(cell.status === "winner" || agg.action_taken === "scale") && (
            <Link
              to="/library"
              search={{
                new: "1",
                title:
                  cell.hook_label ||
                  cell.ad_name ||
                  angle?.title ||
                  "Winning variant",
                category: "hook_formula",
                archetype: deliverable?.placement ?? undefined,
                entry_point: angle?.entry_point ?? undefined,
                source_brand_id: brandId ?? undefined,
                source_metric:
                  agg.latest?.roas != null
                    ? `${Number(agg.latest.roas).toFixed(2)}× ROAS`
                    : agg.latest?.cpa != null
                      ? `$${Number(agg.latest.cpa).toFixed(2)} CPA`
                      : undefined,
                performance_tag: "winner",
                prompt_text: [
                  `Hook: ${cell.hook_label ?? "(unlabeled)"}`,
                  angle?.title ? `Angle: ${angle.title}` : null,
                  angle?.entry_point
                    ? `Entry point: ${angle.entry_point}`
                    : null,
                  deliverable?.placement
                    ? `Format: ${deliverable.placement}`
                    : null,
                ]
                  .filter(Boolean)
                  .join("\n"),
                notes: `Saved from ${brandName ?? "campaign"} — ${projectName ?? ""}`,
              }}
            >
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                Save to library
              </Button>
            </Link>
          )}
          <Select
            value={agg.action_taken}
            onValueChange={(v) => void onAction(v as MetricAction)}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-5 grid lg:grid-cols-2 gap-6">
        {/* Entry form */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="label-mono">DATA ENTRY</p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-7 text-xs w-36"
              />
              <Button size="sm" variant="outline" onClick={persist}>
                <Save className="h-3 w-3" /> Save
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field
              label="Spend"
              value={draft.spend}
              onChange={(v) => setDraft((d) => ({ ...d, spend: v }))}
            />
            <Field
              label="Impressions"
              value={draft.impressions}
              onChange={(v) => setDraft((d) => ({ ...d, impressions: v }))}
            />
            <Field
              label="3-sec views"
              value={draft.three_sec_views}
              onChange={(v) => setDraft((d) => ({ ...d, three_sec_views: v }))}
            />
            <Field
              label="Reach"
              value={draft.reach}
              onChange={(v) => setDraft((d) => ({ ...d, reach: v }))}
            />
            <Field
              label="Clicks"
              value={draft.clicks}
              onChange={(v) => setDraft((d) => ({ ...d, clicks: v }))}
            />
            <Field
              label="Conversions"
              value={draft.conversions}
              onChange={(v) => setDraft((d) => ({ ...d, conversions: v }))}
            />
            <Field
              label="Hook rate"
              value={draft.hook_rate}
              onChange={(v) => setDraft((d) => ({ ...d, hook_rate: v }))}
              placeholder="auto"
            />
            <Field
              label="Hold rate"
              value={draft.hold_rate}
              onChange={(v) => setDraft((d) => ({ ...d, hold_rate: v }))}
            />
            <Field
              label="CTR"
              value={draft.ctr}
              onChange={(v) => setDraft((d) => ({ ...d, ctr: v }))}
              placeholder="auto"
            />
            <Field
              label="CPA"
              value={draft.cpa}
              onChange={(v) => setDraft((d) => ({ ...d, cpa: v }))}
              placeholder="auto"
            />
            <Field
              label="ROAS"
              value={draft.roas}
              onChange={(v) => setDraft((d) => ({ ...d, roas: v }))}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {metrics.length} row{metrics.length === 1 ? "" : "s"} logged · totals
            below are aggregated across all dates.
          </p>
        </div>

        {/* Funnel */}
        <div>
          <p className="label-mono mb-3">CREATIVE FUNNEL</p>
          <div className="grid grid-cols-4 gap-2">
            <FunnelStage
              label="HOOK"
              sub="3s view rate"
              value={pct(agg.hook_rate)}
              question="Stopping the scroll?"
              tier={diag.tiers.hook}
            />
            <FunnelStage
              label="HOLD"
              sub="watch-through"
              value={pct(agg.hold_rate)}
              question="Body holding them?"
              tier={diag.tiers.hold}
            />
            <FunnelStage
              label="CLICK"
              sub="CTR"
              value={pct(agg.ctr)}
              question="Message + CTA?"
              tier={diag.tiers.click}
            />
            <FunnelStage
              label="CONVERT"
              sub={cpaTarget != null ? "CPA vs target" : "ROAS"}
              value={
                cpaTarget != null
                  ? agg.cpa != null
                    ? `$${num(agg.cpa)}`
                    : "—"
                  : num(agg.roas) + "x"
              }
              question="Does it pay?"
              tier={diag.tiers.convert}
            />
          </div>

          <div className="mt-4 border border-foreground rounded-[2px] p-3 bg-background">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-rec)]" />
              <p className="label-mono">DIAGNOSIS</p>
            </div>
            <p className="text-sm">{diag.suggestion}</p>
            <Textarea
              value={diagnosisText}
              onChange={(e) => setDiagnosisText(e.target.value)}
              onBlur={() =>
                diagnosisText !== (agg.diagnosis ?? "") &&
                void onSaveDiagnosis(diagnosisText)
              }
              placeholder="Override or refine — what's your read?"
              rows={2}
              className="mt-2 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="label-mono">{label}</Label>
      <Input
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}

function FunnelStage({
  label,
  sub,
  value,
  question,
  tier,
}: {
  label: string;
  sub: string;
  value: string;
  question: string;
  tier: Tier;
}) {
  return (
    <div
      className={cn(
        "border rounded-[2px] p-3",
        TIER_STYLES[tier],
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("h-2 w-2 rounded-full", TIER_DOT[tier])} />
        <p className="font-mono text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="font-display text-xl font-bold leading-tight">{value}</p>
      <p className="label-mono opacity-70 mt-0.5">{sub}</p>
      <p className="text-[11px] mt-2 leading-tight">{question}</p>
    </div>
  );
}

// ---------------- Heatmap ----------------
function Heatmap({
  angles,
  placements,
  cells,
  metrics,
  cpaTarget,
  primaryMetric,
}: {
  angles: AngleRow[];
  placements: Placement[];
  cells: TestCellRow[];
  metrics: MetricRow[];
  cpaTarget: number | null;
  primaryMetric: string | null;
}) {
  const useCpa = cpaTarget != null;

  function cellAgg(angleId: string, p: Placement) {
    const matching = cells.filter(
      (c) => c.angle_id === angleId && c.format_label === p,
    );
    const ms = metrics.filter((m) =>
      matching.some((c) => c.id === m.test_cell_id),
    );
    if (matching.length === 0) return null;
    return { agg: aggregate(ms), variantCount: matching.length };
  }

  function tierFor(agg: Aggregate): Tier {
    if (useCpa && agg.cpa != null) {
      return tierBelow(agg.cpa, cpaTarget!, cpaTarget! * 1.5);
    }
    if (agg.roas != null) return tierAbove(agg.roas, 2, 1);
    return "na";
  }

  return (
    <div className="border border-foreground rounded-[2px] overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-foreground bg-muted/40">
            <th className="text-left p-3 label-mono w-56">ANGLE</th>
            {placements.map((p) => (
              <th key={p} className="text-left p-3 label-mono">
                {PLACEMENT_LABEL[p].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {angles.map((a) => (
            <tr key={a.id} className="border-b border-border align-top">
              <td className="p-3 w-56">
                <p className="font-medium text-sm">{a.title}</p>
                {a.entry_point && (
                  <span className="inline-block mt-1 font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-foreground rounded-[2px]">
                    {a.entry_point}
                  </span>
                )}
              </td>
              {placements.map((p) => {
                const data = cellAgg(a.id, p);
                if (!data)
                  return (
                    <td key={p} className="p-3">
                      <span className="label-mono text-muted-foreground">
                        not tested
                      </span>
                    </td>
                  );
                const t = tierFor(data.agg);
                return (
                  <td key={p} className="p-2">
                    <div
                      className={cn(
                        "border rounded-[2px] p-2.5",
                        TIER_STYLES[t],
                      )}
                    >
                      <p className="font-mono text-[10px] uppercase tracking-wider opacity-80">
                        {data.variantCount} variant
                        {data.variantCount === 1 ? "" : "s"}
                      </p>
                      <p className="font-display text-lg font-bold leading-tight mt-0.5">
                        {useCpa
                          ? data.agg.cpa != null
                            ? `$${num(data.agg.cpa)}`
                            : "—"
                          : data.agg.roas != null
                            ? `${num(data.agg.roas)}x`
                            : "—"}
                      </p>
                      <p className="label-mono opacity-70">
                        {useCpa
                          ? `CPA · target ${cpaTarget}`
                          : `ROAS · ${primaryMetric ?? ""}`}
                      </p>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Learnings ----------------
function LearningsPanel({
  angles,
  cells,
  metrics,
  cpaTarget,
}: {
  angles: AngleRow[];
  cells: TestCellRow[];
  metrics: MetricRow[];
  cpaTarget: number | null;
}) {
  // Score per angle and per format, by tier of aggregate
  function scoreFor(agg: Aggregate): number {
    if (cpaTarget != null && agg.cpa != null) {
      const t = tierBelow(agg.cpa, cpaTarget, cpaTarget * 1.5);
      return t === "green" ? 3 : t === "amber" ? 2 : t === "red" ? 1 : 0;
    }
    if (agg.roas != null) {
      const t = tierAbove(agg.roas, 2, 1);
      return t === "green" ? 3 : t === "amber" ? 2 : t === "red" ? 1 : 0;
    }
    return 0;
  }

  const byAngle = new Map<string, number>();
  const byEntryPoint = new Map<string, number>();
  const byFormat = new Map<string, number>();
  const winningHooks: { label: string; score: number }[] = [];

  for (const cell of cells) {
    const cm = metrics.filter((m) => m.test_cell_id === cell.id);
    if (!cm.length) continue;
    const agg = aggregate(cm);
    const score = scoreFor(agg);
    if (cell.angle_id)
      byAngle.set(
        cell.angle_id,
        (byAngle.get(cell.angle_id) ?? 0) + score,
      );
    const angle = angles.find((a) => a.id === cell.angle_id);
    if (angle?.entry_point)
      byEntryPoint.set(
        angle.entry_point,
        (byEntryPoint.get(angle.entry_point) ?? 0) + score,
      );
    if (cell.format_label)
      byFormat.set(
        cell.format_label,
        (byFormat.get(cell.format_label) ?? 0) + score,
      );
    if (cell.hook_label && score >= 2)
      winningHooks.push({ label: cell.hook_label, score });
  }

  const top = <T,>(m: Map<T, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

  const topAngles = top(byAngle, 3).map(([id, score]) => ({
    title: angles.find((a) => a.id === id)?.title ?? "—",
    score,
  }));
  const topEPs = top(byEntryPoint, 3);
  const topFmts = top(byFormat, 3);

  return (
    <div className="border border-foreground rounded-[2px]">
      <div className="px-5 py-3 border-b border-foreground bg-muted/40 flex items-center gap-2">
        <Trophy className="h-3.5 w-3.5 text-[var(--color-rec)]" />
        <p className="label-mono">LEARNINGS — closes the loop into the next brief</p>
      </div>
      <div className="p-5 grid md:grid-cols-4 gap-4">
        <LearnCol title="Winning angles" items={topAngles.map((t) => t.title)} />
        <LearnCol
          title="Best entry points"
          items={topEPs.map(([k]) => String(k))}
        />
        <LearnCol title="Best formats" items={topFmts.map(([k]) => String(k))} />
        <LearnCol
          title="Hook patterns"
          items={
            winningHooks.length
              ? winningHooks.slice(0, 5).map((h) => h.label)
              : ["Log more data to surface hook patterns"]
          }
        />
      </div>
    </div>
  );
}

function LearnCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="label-mono mb-2">{title.toUpperCase()}</p>
      {items.length === 0 || (items.length === 1 && !items[0]) ? (
        <p className="text-sm text-muted-foreground">No signal yet</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((s, i) => (
            <li key={i} className="text-sm flex items-start gap-1.5">
              <span className="text-[var(--color-rec)] font-mono">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------- CSV Paste ----------------
function CsvPasteDialog({
  cells,
  onClose,
  onImport,
}: {
  cells: TestCellRow[];
  onClose: () => void;
  onImport: (
    rows: { ad_name: string; date: string; patch: Partial<MetricRow> }[],
  ) => Promise<void>;
}) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);

  function parse() {
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) {
      toast.error("Paste a CSV with a header row + data rows");
      return [];
    }
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
    const idx = (names: string[]) =>
      headers.findIndex((h) => names.some((n) => h.includes(n)));
    const i_ad = idx(["ad name", "ad_name", "name"]);
    const i_date = idx(["date", "day", "reporting"]);
    const i_spend = idx(["spend", "amount spent", "cost"]);
    const i_imp = idx(["impressions"]);
    const i_3s = idx(["3-sec", "3s", "three"]);
    const i_reach = idx(["reach"]);
    const i_clicks = idx(["clicks", "link clicks"]);
    const i_conv = idx(["conversions", "purchases", "results"]);
    const i_roas = idx(["roas", "return"]);
    if (i_ad < 0) {
      toast.error("Couldn't find an Ad Name column");
      return [];
    }
    const out: {
      ad_name: string;
      date: string;
      patch: Partial<MetricRow>;
    }[] = [];
    for (let li = 1; li < lines.length; li++) {
      const parts = lines[li].split(sep).map((s) => s.trim());
      if (!parts[i_ad]) continue;
      const numAt = (i: number) =>
        i < 0 ? null : parts[i] ? Number(parts[i].replace(/[$,]/g, "")) : null;
      out.push({
        ad_name: parts[i_ad],
        date:
          (i_date >= 0 && parts[i_date]) ||
          new Date().toISOString().slice(0, 10),
        patch: {
          spend: numAt(i_spend),
          impressions: numAt(i_imp),
          three_sec_views: numAt(i_3s),
          reach: numAt(i_reach),
          clicks: numAt(i_clicks),
          conversions: numAt(i_conv),
          roas: numAt(i_roas),
        },
      });
    }
    return out;
  }

  async function go() {
    const rows = parse();
    if (rows.length === 0) return;
    setBusy(true);
    await onImport(rows);
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Paste Ads Manager CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste the export with a header row. We match rows by{" "}
            <strong>Ad name</strong> against this campaign's variants (
            {cells.length} total). Columns recognized: Ad Name, Date, Spend,
            Impressions, 3-sec Video Views, Reach, Link Clicks, Conversions,
            ROAS.
          </p>
          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={12}
            placeholder={"Ad name,Date,Spend,Impressions,3-sec video views,Reach,Link clicks,Conversions,ROAS"}
            className="font-mono text-xs"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} disabled={busy || !csv.trim()}>
            <Plus className="h-4 w-4" /> Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Report ----------------
function ReportDialog({
  campaign,
  brief,
  cells,
  angles,
  deliverables,
  metrics,
  cpaTarget,
  onClose,
}: {
  campaign: CampaignRow;
  brief: BriefRow | null;
  cells: TestCellRow[];
  angles: AngleRow[];
  deliverables: DeliverableRow[];
  metrics: MetricRow[];
  cpaTarget: number | null;
  onClose: () => void;
}) {
  const lines: string[] = [];
  lines.push(
    `PERFORMANCE REPORT — ${brief?.brand?.name ?? ""} · ${brief?.project_name ?? ""}`,
  );
  lines.push(
    `Campaign: ${campaign.meta_campaign_name ?? ""} | Objective: ${brief?.objective ?? "—"} | Target: ${brief?.kpi_target ?? "—"}`,
  );
  lines.push("");
  for (const cell of cells) {
    const cm = metrics.filter((m) => m.test_cell_id === cell.id);
    const agg = aggregate(cm);
    const angle = angles.find((a) => a.id === cell.angle_id);
    const d = deliverables.find((x) => x.id === cell.deliverable_id);
    const diag = diagnose(agg, cpaTarget);
    lines.push(`▼ ${cell.ad_name ?? cell.id}`);
    lines.push(
      `   ${angle?.title ?? "—"} · ${angle?.entry_point ?? "—"} · ${cell.format_label ?? "—"} · ${d?.filename ?? "—"}`,
    );
    lines.push(
      `   spend $${num(agg.spend)} | imp ${agg.impressions} | clicks ${agg.clicks} | conv ${agg.conversions}`,
    );
    lines.push(
      `   hook ${pct(agg.hook_rate)} (${diag.tiers.hook}) | hold ${pct(agg.hold_rate)} (${diag.tiers.hold}) | ctr ${pct(agg.ctr)} (${diag.tiers.click}) | cpa $${num(agg.cpa)} / roas ${num(agg.roas)}x (${diag.tiers.convert})`,
    );
    lines.push(`   diagnosis: ${agg.diagnosis ?? diag.suggestion}`);
    lines.push(`   action: ${agg.action_taken} | status: ${cell.status}`);
    lines.push("");
  }

  const text = lines.join("\n");
  const json = JSON.stringify(
    {
      campaign: {
        name: campaign.meta_campaign_name,
        objective: brief?.objective,
        target: brief?.kpi_target,
      },
      variants: cells.map((cell) => {
        const cm = metrics.filter((m) => m.test_cell_id === cell.id);
        const agg = aggregate(cm);
        const angle = angles.find((a) => a.id === cell.angle_id);
        const diag = diagnose(agg, cpaTarget);
        return {
          ad_name: cell.ad_name,
          angle: angle?.title,
          entry_point: angle?.entry_point,
          format: cell.format_label,
          status: cell.status,
          metrics: {
            spend: agg.spend,
            impressions: agg.impressions,
            three_sec_views: agg.three_sec_views,
            reach: agg.reach,
            clicks: agg.clicks,
            conversions: agg.conversions,
            hook_rate: agg.hook_rate,
            hold_rate: agg.hold_rate,
            ctr: agg.ctr,
            cpa: agg.cpa,
            roas: agg.roas,
          },
          tiers: diag.tiers,
          diagnosis: agg.diagnosis ?? diag.suggestion,
          action: agg.action_taken,
        };
      }),
    },
    null,
    2,
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Performance report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="label-mono">Text</Label>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => copy(text)}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    downloadFile("performance-report.txt", text)
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </div>
            <pre className="font-mono text-xs bg-muted/40 border rounded-[2px] p-3 max-h-72 overflow-auto whitespace-pre-wrap">
              {text}
            </pre>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="label-mono">JSON</Label>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => copy(json)}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    downloadFile(
                      "performance-report.json",
                      json,
                      "application/json",
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </div>
            <pre className="font-mono text-xs bg-muted/40 border rounded-[2px] p-3 max-h-72 overflow-auto">
              {json}
            </pre>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- helpers UI ----------------
function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-muted-foreground rounded-[2px] p-8 text-center">
      <FlaskConical className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        {body}
      </p>
    </div>
  );
}