import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileText,
  LineChart,
  Plus,
  Rocket,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
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
  brief: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/launch")({
  validateSearch: searchSchema,
  component: LaunchPage,
});

// ---------------- Types ----------------
type Placement = "reels" | "feed" | "stories";
type CampaignType = "advantage_plus" | "manual_abo" | "manual_cbo";
type TestCellStatus = "planned" | "live" | "paused" | "winner" | "killed";

type BriefRow = {
  id: string;
  project_name: string | null;
  status: string | null;
  objective: string | null;
  kpi_type: string | null;
  kpi_target: string | null;
  destination_url: string | null;
  placements: unknown;
  brand: { id: string; name: string } | null;
};

type CampaignRow = {
  id: string;
  brief_id: string;
  meta_campaign_name: string | null;
  objective: string | null;
  structure_type: string | null;
  campaign_type: CampaignType | null;
  daily_budget: number | null;
  start_date: string | null;
  primary_metric: string | null;
  utm_template: string | null;
  naming_convention: string | null;
  notes: string | null;
  status: string | null;
};

type AngleRow = {
  id: string;
  title: string;
  entry_point: string | null;
  status: string | null;
};

type DeliverableRow = {
  id: string;
  cut_id: string;
  placement: Placement | null;
  aspect_ratio: string | null;
  filename: string | null;
  upload_ready: boolean | null;
  duration_seconds: number | null;
  cut: { brief_id: string } | null;
};

type TestCellRow = {
  id: string;
  campaign_id: string;
  deliverable_id: string | null;
  angle_id: string | null;
  ad_name: string | null;
  hook_label: string | null;
  format_label: string | null;
  utm_url: string | null;
  status: TestCellStatus;
  notes: string | null;
};

// ---------------- Constants ----------------
const CAMPAIGN_TYPES: { id: CampaignType; label: string; help: string }[] = [
  {
    id: "advantage_plus",
    label: "Advantage+ Shopping",
    help: "AI-driven. Best for sales/leads at scale. Minimal manual targeting.",
  },
  {
    id: "manual_abo",
    label: "Manual · ABO",
    help: "Ad-set budget optimization. Best when isolating audiences for learning.",
  },
  {
    id: "manual_cbo",
    label: "Manual · CBO",
    help: "Campaign budget optimization. Best for letting Meta allocate across ad sets.",
  },
];

const OBJECTIVE_MAP: Record<string, string> = {
  awareness: "Awareness",
  traffic: "Traffic",
  engagement: "Engagement",
  leads: "Leads",
  sales: "Sales",
};

const STATUS_STYLES: Record<TestCellStatus, string> = {
  planned: "border-muted-foreground text-muted-foreground",
  live: "border-[var(--color-rec)] text-[var(--color-rec)]",
  paused: "border-amber-600 text-amber-700",
  winner: "border-emerald-700 text-emerald-700",
  killed: "border-red-700 text-red-700 opacity-70",
};

const STATUS_OPTIONS: TestCellStatus[] = [
  "planned",
  "live",
  "paused",
  "winner",
  "killed",
];

const PLACEMENT_LABEL: Record<Placement, { label: string; ratio: string }> = {
  reels: { label: "Reels", ratio: "9:16" },
  feed: { label: "Feed", ratio: "4:5" },
  stories: { label: "Stories", ratio: "9:16" },
};

const DEFAULT_NAMING = "{brand}_{angle}_{hook}_{format}_{date}";
const DEFAULT_UTM =
  "utm_source=meta&utm_medium=paid_social&utm_campaign={campaign}&utm_content={ad_name}";

// ---------------- Helpers ----------------
function slug(s: string | null | undefined): string {
  return (
    (s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "x"
  );
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function placementFromLabel(label: string): Placement | null {
  const l = label.toLowerCase();
  if (l.includes("reel")) return "reels";
  if (l.includes("stor")) return "stories";
  if (l.includes("feed")) return "feed";
  return null;
}

function todayStamp(date?: string | null): string {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function resolveTokens(
  template: string,
  tokens: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => tokens[k] ?? `{${k}}`);
}

function buildAdName(
  pattern: string,
  ctx: {
    brand: string | null;
    project: string | null;
    angle: string | null;
    hook: string | null;
    format: Placement;
    date: string;
  },
): string {
  return resolveTokens(pattern || DEFAULT_NAMING, {
    brand: slug(ctx.brand),
    project: slug(ctx.project),
    angle: slug(ctx.angle),
    hook: slug(ctx.hook),
    format: ctx.format,
    date: ctx.date,
  });
}

function buildUtmUrl(
  destination: string | null,
  template: string,
  ctx: { campaign: string; ad_name: string },
): string {
  const query = resolveTokens(template || DEFAULT_UTM, {
    campaign: slug(ctx.campaign),
    ad_name: slug(ctx.ad_name),
  });
  if (!destination) return query;
  const sep = destination.includes("?") ? "&" : "?";
  return `${destination}${sep}${query}`;
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

// ---------------- Page ----------------
function LaunchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<BriefRow[] | null>(null);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(
    search.brief ?? null,
  );
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");

  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [angles, setAngles] = useState<AngleRow[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);
  const [cells, setCells] = useState<TestCellRow[]>([]);
  const [deliverableCount, setDeliverableCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [qaSignedOff, setQaSignedOff] = useState<boolean | null>(null);

  useEffect(() => {
    void loadBriefs();
  }, []);

  useEffect(() => {
    if (selectedBriefId) void loadCampaignContext(selectedBriefId);
    else {
      setCampaign(null);
      setAngles([]);
      setDeliverables([]);
      setCells([]);
      setQaSignedOff(null);
    }
  }, [selectedBriefId]);

  async function loadBriefs() {
    const { data, error } = await supabase
      .from("briefs")
      .select(
        "id, project_name, status, objective, kpi_type, kpi_target, destination_url, placements, brand:brands(id, name)",
      )
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Failed to load briefs");
      setBriefs([]);
      return;
    }
    setBriefs((data as unknown as BriefRow[]) ?? []);
  }

  async function loadCampaignContext(briefId: string) {
    setLoading(true);
    const { data: qaRow } = await supabase
      .from("qa_reviews")
      .select("signed_off")
      .eq("brief_id", briefId)
      .maybeSingle();
    setQaSignedOff(!!(qaRow as { signed_off?: boolean } | null)?.signed_off);
    const [{ data: camp }, { data: ang }, { data: delv }] = await Promise.all([
      supabase.from("campaigns").select("*").eq("brief_id", briefId).maybeSingle(),
      supabase
        .from("angles")
        .select("id, title, entry_point, status")
        .eq("brief_id", briefId)
        .order("priority", { ascending: false }),
      supabase
        .from("deliverables")
        .select(
          "id, cut_id, placement, aspect_ratio, filename, upload_ready, duration_seconds, cut:cuts!inner(brief_id)",
        )
        .eq("cut.brief_id", briefId),
    ]);
    const campRow = (camp as unknown as CampaignRow | null) ?? null;
    setCampaign(campRow);
    setAngles((ang as unknown as AngleRow[]) ?? []);
    const deliv = (delv as unknown as DeliverableRow[]) ?? [];
    setDeliverables(deliv);
    setDeliverableCount(deliv.filter((d) => d.upload_ready).length);
    if (campRow) {
      const { data: tc } = await supabase
        .from("test_cells")
        .select("*")
        .eq("campaign_id", campRow.id)
        .order("created_at", { ascending: true });
      setCells((tc as unknown as TestCellRow[]) ?? []);
    } else {
      setCells([]);
    }
    setLoading(false);
  }

  const selectedBrief = useMemo(
    () => briefs?.find((b) => b.id === selectedBriefId) ?? null,
    [briefs, selectedBriefId],
  );

  const filteredBriefs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = briefs ?? [];
    if (!q) return list;
    return list.filter((b) =>
      [b.project_name, b.brand?.name, b.objective]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [briefs, query]);

  // ---------- Brief picker view ----------
  if (!selectedBrief) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-8">
          <p className="label-mono mb-2">PHASE 8 · MEDIA</p>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            Launch & Tests
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Plan the campaign structure, build the creative test matrix, and
            produce an upload-ready launch plan with traceable naming and UTMs.
          </p>
        </div>

        <div className="border border-foreground p-6 rounded-[2px] max-w-2xl">
          <p className="label-mono mb-3">SELECT BRIEF</p>
          <Popover open={picker} onOpenChange={setPicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search briefs by brand, project, or objective…
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
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
                {filteredBriefs.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No briefs.</p>
                ) : (
                  filteredBriefs.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setSelectedBriefId(b.id);
                        setPicker(false);
                        void navigate({ to: "/launch", search: { brief: b.id } });
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0"
                    >
                      <p className="font-medium text-sm">
                        {b.brand?.name ?? "—"} · {b.project_name ?? "Untitled"}
                      </p>
                      <p className="label-mono text-muted-foreground mt-0.5">
                        {b.objective ?? "no objective"} · {b.status ?? "draft"}
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

  // ---------- Open brief view ----------
  const targetPlacements: Placement[] = Array.from(
    new Set(
      asStringArray(selectedBrief.placements)
        .map(placementFromLabel)
        .filter((p): p is Placement => !!p),
    ),
  );

  async function createCampaign() {
    if (!selectedBrief) return;
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    const obj = selectedBrief.objective ?? "sales";
    const suggestedType: CampaignType =
      obj === "sales" || obj === "leads" ? "advantage_plus" : "manual_cbo";
    const name = `${slug(selectedBrief.brand?.name)}-${slug(selectedBrief.project_name)}-${obj}`;
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        user_id: uid,
        brief_id: selectedBrief.id,
        meta_campaign_name: name,
        objective: obj,
        structure_type: suggestedType,
        campaign_type: suggestedType,
        primary_metric: selectedBrief.kpi_type ?? null,
        naming_convention: DEFAULT_NAMING,
        utm_template: DEFAULT_UTM,
        status: "draft",
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setCampaign(data as unknown as CampaignRow);
    toast.success("Campaign drafted");
  }

  async function patchCampaign(patch: Partial<CampaignRow>) {
    if (!campaign) return;
    setCampaign({ ...campaign, ...patch });
    const { error } = await supabase
      .from("campaigns")
      .update(patch)
      .eq("id", campaign.id);
    if (error) toast.error(error.message);
  }

  async function addVariant(input: {
    angle: AngleRow;
    placement: Placement;
    deliverable: DeliverableRow;
    hookLabel: string;
  }) {
    if (!campaign || !selectedBrief) return;
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    const adName = buildAdName(campaign.naming_convention ?? DEFAULT_NAMING, {
      brand: selectedBrief.brand?.name ?? null,
      project: selectedBrief.project_name ?? null,
      angle: input.angle.title,
      hook: input.hookLabel,
      format: input.placement,
      date: todayStamp(campaign.start_date),
    });
    const utmUrl = buildUtmUrl(
      selectedBrief.destination_url ?? null,
      campaign.utm_template ?? DEFAULT_UTM,
      { campaign: campaign.meta_campaign_name ?? "campaign", ad_name: adName },
    );
    const { data, error } = await supabase
      .from("test_cells")
      .insert({
        user_id: uid,
        campaign_id: campaign.id,
        deliverable_id: input.deliverable.id,
        angle_id: input.angle.id,
        ad_name: adName,
        hook_label: input.hookLabel,
        format_label: input.placement,
        utm_url: utmUrl,
        status: "planned" as TestCellStatus,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setCells((prev) => [...prev, data as unknown as TestCellRow]);
  }

  async function updateCell(id: string, patch: Partial<TestCellRow>) {
    if (patch.status === "live" && qaSignedOff === false) {
      toast.error("QA not signed off — clear compliance before going live");
      return;
    }
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase
      .from("test_cells")
      .update(patch)
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  async function deleteCell(id: string) {
    setCells((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("test_cells").delete().eq("id", id);
  }

  async function regenerateNames() {
    if (!campaign || !selectedBrief) return;
    for (const cell of cells) {
      const angle = angles.find((a) => a.id === cell.angle_id);
      if (!angle || !cell.format_label) continue;
      const adName = buildAdName(campaign.naming_convention ?? DEFAULT_NAMING, {
        brand: selectedBrief.brand?.name ?? null,
        project: selectedBrief.project_name ?? null,
        angle: angle.title,
        hook: cell.hook_label,
        format: cell.format_label as Placement,
        date: todayStamp(campaign.start_date),
      });
      const utmUrl = buildUtmUrl(
        selectedBrief.destination_url ?? null,
        campaign.utm_template ?? DEFAULT_UTM,
        { campaign: campaign.meta_campaign_name ?? "campaign", ad_name: adName },
      );
      await updateCell(cell.id, { ad_name: adName, utm_url: utmUrl });
    }
    toast.success("Ad names + UTMs regenerated");
  }

  const cellsByKey = useMemo(() => {
    const map: Record<string, TestCellRow[]> = {};
    for (const c of cells) {
      const key = `${c.angle_id ?? "x"}::${c.format_label ?? "x"}`;
      (map[key] ??= []).push(c);
    }
    return map;
  }, [cells]);

  const statusCounts = useMemo(() => {
    const out: Record<TestCellStatus, number> = {
      planned: 0,
      live: 0,
      paused: 0,
      winner: 0,
      killed: 0,
    };
    for (const c of cells) out[c.status]++;
    return out;
  }, [cells]);

  // preview ad name
  const previewAdName = campaign
    ? buildAdName(campaign.naming_convention ?? DEFAULT_NAMING, {
        brand: selectedBrief.brand?.name ?? null,
        project: selectedBrief.project_name ?? null,
        angle: "pain-relief",
        hook: "stop-itching",
        format: "reels",
        date: todayStamp(campaign.start_date),
      })
    : "";
  const previewUtm = campaign
    ? buildUtmUrl(
        selectedBrief.destination_url ?? null,
        campaign.utm_template ?? DEFAULT_UTM,
        {
          campaign: campaign.meta_campaign_name ?? "campaign",
          ad_name: previewAdName,
        },
      )
    : "";

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mb-6">
        <button
          onClick={() => {
            setSelectedBriefId(null);
            void navigate({ to: "/launch", search: {} });
          }}
          className="inline-flex items-center gap-1.5 label-mono text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3 w-3" /> Back to brief select
        </button>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="label-mono mb-1">
              {selectedBrief.brand?.name ?? "—"} ·{" "}
              {selectedBrief.project_name ?? "—"}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
              Launch plan
              {selectedBrief.objective && (
                <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 border border-foreground rounded-[2px]">
                  {OBJECTIVE_MAP[selectedBrief.objective] ?? selectedBrief.objective}
                </span>
              )}
              <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 border border-muted-foreground text-muted-foreground rounded-[2px]">
                {deliverableCount} upload-ready
              </span>
            </h1>
            {selectedBrief.kpi_type && (
              <p className="label-mono text-muted-foreground mt-2">
                Target {selectedBrief.kpi_type}
                {selectedBrief.kpi_target ? ` · ${selectedBrief.kpi_target}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {campaign && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportOpen(true)}
                  disabled={cells.length === 0 || qaSignedOff === false}
                >
                  <FileText className="h-3.5 w-3.5" /> Export launch plan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/performance",
                    })
                  }
                >
                  <LineChart className="h-3.5 w-3.5" /> View performance →
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {qaSignedOff === false && (
        <div className="border border-[var(--color-rec)] bg-[var(--color-rec)]/5 text-[var(--color-rec)] p-4 rounded-[2px] mb-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">QA not signed off — clear compliance before launching</p>
            <p className="text-xs mt-1 text-[var(--color-rec)]/80">
              The launch plan export and live actions are disabled until this brief passes QA.
            </p>
          </div>
          <Link
            to="/qa"
            search={{ brief: selectedBrief.id }}
            className="font-mono text-[11px] uppercase tracking-wider underline shrink-0"
          >
            Open QA →
          </Link>
        </div>
      )}

      {!campaign ? (
        <div className="border border-foreground p-10 rounded-[2px] text-center">
          <Rocket className="h-8 w-8 mx-auto mb-3" />
          <h2 className="font-display text-2xl font-bold mb-2">
            No campaign yet
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Plan a Meta campaign for this brief. We'll suggest a structure based
            on the brief's objective, then you'll fill in the test matrix.
          </p>
          <Button onClick={createCampaign}>
            <Plus className="h-4 w-4" /> Plan campaign
          </Button>
        </div>
      ) : (
        <>
          <CampaignSetup
            campaign={campaign}
            brief={selectedBrief}
            onPatch={patchCampaign}
            previewAdName={previewAdName}
            previewUtm={previewUtm}
            onRegenerate={regenerateNames}
          />

          <section className="mt-10">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
              <div>
                <p className="label-mono mb-1">TEST MATRIX</p>
                <h2 className="font-display text-2xl font-bold">
                  Angles × Formats
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {cells.length} variant{cells.length === 1 ? "" : "s"} planned ·{" "}
                  {angles.length} angle{angles.length === 1 ? "" : "s"} ·{" "}
                  {targetPlacements.length} format
                  {targetPlacements.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {STATUS_OPTIONS.map((s) => (
                  <span
                    key={s}
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
                      STATUS_STYLES[s],
                    )}
                  >
                    {s} · {statusCounts[s]}
                  </span>
                ))}
              </div>
            </div>

            {angles.length === 0 ? (
              <EmptyHint
                title="No angles on this brief yet"
                body="Go to the Angles workspace and draft entry-point angles. The test matrix uses them as rows."
              />
            ) : targetPlacements.length === 0 ? (
              <EmptyHint
                title="No placements set on the brief"
                body="Open the brief and choose at least one placement (Reels, Feed, Stories) to populate the columns."
              />
            ) : (
              <TestMatrix
                angles={angles}
                placements={targetPlacements}
                cellsByKey={cellsByKey}
                deliverables={deliverables}
                onAdd={addVariant}
                onUpdate={updateCell}
                onDelete={deleteCell}
              />
            )}

            {cells.length > 0 && cells.length < 3 && (
              <p className="text-xs text-muted-foreground mt-4">
                Tip: test genuinely different <em>angles</em> before testing many
                hook variants of the same angle. Diversity beats volume.
              </p>
            )}
          </section>
        </>
      )}

      {campaign && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          campaign={campaign}
          brief={selectedBrief}
          cells={cells}
          angles={angles}
          deliverables={deliverables}
        />
      )}
    </div>
  );
}

// ---------------- Campaign Setup ----------------
function CampaignSetup({
  campaign,
  brief,
  onPatch,
  previewAdName,
  previewUtm,
  onRegenerate,
}: {
  campaign: CampaignRow;
  brief: BriefRow;
  onPatch: (p: Partial<CampaignRow>) => void;
  previewAdName: string;
  previewUtm: string;
  onRegenerate: () => void;
}) {
  const [name, setName] = useState(campaign.meta_campaign_name ?? "");
  const [budget, setBudget] = useState(
    campaign.daily_budget != null ? String(campaign.daily_budget) : "",
  );
  const [startDate, setStartDate] = useState(campaign.start_date ?? "");
  const [metric, setMetric] = useState(
    campaign.primary_metric ?? brief.kpi_type ?? "",
  );
  const [naming, setNaming] = useState(
    campaign.naming_convention ?? DEFAULT_NAMING,
  );
  const [utm, setUtm] = useState(campaign.utm_template ?? DEFAULT_UTM);
  const [notes, setNotes] = useState(campaign.notes ?? "");

  const typeHelp =
    CAMPAIGN_TYPES.find((t) => t.id === campaign.campaign_type)?.help ?? "";

  return (
    <div className="border border-foreground rounded-[2px]">
      <div className="px-6 py-4 border-b border-foreground bg-muted/40">
        <p className="label-mono">CAMPAIGN SETUP</p>
      </div>
      <div className="p-6 grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label className="label-mono">Meta campaign name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => onPatch({ meta_campaign_name: name })}
              placeholder="brand-project-objective"
            />
          </div>
          <div>
            <Label className="label-mono">Campaign type</Label>
            <Select
              value={campaign.campaign_type ?? undefined}
              onValueChange={(v) =>
                onPatch({ campaign_type: v as CampaignType, structure_type: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a structure" />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeHelp && (
              <p className="text-xs text-muted-foreground mt-1.5">{typeHelp}</p>
            )}
          </div>
          <div>
            <Label className="label-mono">Objective (from brief)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={brief.objective ?? ""} readOnly className="bg-muted/50" />
              <span className="label-mono text-muted-foreground whitespace-nowrap">
                → Meta: {OBJECTIVE_MAP[brief.objective ?? ""] ?? "—"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-mono">Daily budget</Label>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                onBlur={() =>
                  onPatch({
                    daily_budget: budget === "" ? null : Number(budget),
                  })
                }
                placeholder="50"
              />
            </div>
            <div>
              <Label className="label-mono">Start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onBlur={() => onPatch({ start_date: startDate || null })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-mono">Primary metric</Label>
              <Input
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                onBlur={() => onPatch({ primary_metric: metric || null })}
                placeholder={brief.kpi_type ?? "CPA"}
              />
            </div>
            <div>
              <Label className="label-mono">Target (from brief)</Label>
              <Input
                value={brief.kpi_target ?? ""}
                readOnly
                className="bg-muted/50"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="label-mono">Naming convention</Label>
              <Button size="sm" variant="ghost" onClick={onRegenerate}>
                Regenerate ad names
              </Button>
            </div>
            <Input
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
              onBlur={() => onPatch({ naming_convention: naming })}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Tokens: <code>{"{brand}"}</code> <code>{"{project}"}</code>{" "}
              <code>{"{angle}"}</code> <code>{"{hook}"}</code>{" "}
              <code>{"{format}"}</code> <code>{"{date}"}</code>
            </p>
            <div className="mt-2 px-3 py-2 bg-muted/40 border border-dashed rounded-[2px] font-mono text-xs break-all">
              <span className="label-mono mr-2">PREVIEW</span>
              {previewAdName}
            </div>
          </div>

          <div>
            <Label className="label-mono">UTM template</Label>
            <Textarea
              value={utm}
              onChange={(e) => setUtm(e.target.value)}
              onBlur={() => onPatch({ utm_template: utm })}
              rows={2}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Tokens: <code>{"{campaign}"}</code> <code>{"{ad_name}"}</code>.
              Appended to brief destination URL.
            </p>
            <div className="mt-2 px-3 py-2 bg-muted/40 border border-dashed rounded-[2px] font-mono text-xs break-all">
              <span className="label-mono mr-2">PREVIEW</span>
              {previewUtm || "(no destination URL on brief)"}
            </div>
          </div>

          <div>
            <Label className="label-mono">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => onPatch({ notes: notes || null })}
              rows={3}
              placeholder="Internal notes for media buyer…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Test Matrix ----------------
function TestMatrix({
  angles,
  placements,
  cellsByKey,
  deliverables,
  onAdd,
  onUpdate,
  onDelete,
}: {
  angles: AngleRow[];
  placements: Placement[];
  cellsByKey: Record<string, TestCellRow[]>;
  deliverables: DeliverableRow[];
  onAdd: (input: {
    angle: AngleRow;
    placement: Placement;
    deliverable: DeliverableRow;
    hookLabel: string;
  }) => Promise<void>;
  onUpdate: (id: string, patch: Partial<TestCellRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState<{
    angle: AngleRow;
    placement: Placement;
  } | null>(null);

  return (
    <>
      <div className="border border-foreground rounded-[2px] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground bg-muted/40">
              <th className="text-left p-3 label-mono w-56">ANGLE</th>
              {placements.map((p) => (
                <th key={p} className="text-left p-3 label-mono">
                  {PLACEMENT_LABEL[p].label}
                  <span className="text-muted-foreground ml-1">
                    {PLACEMENT_LABEL[p].ratio}
                  </span>
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
                  const list = cellsByKey[`${a.id}::${p}`] ?? [];
                  return (
                    <td key={p} className="p-3 min-w-[220px]">
                      <div className="space-y-2">
                        {list.map((c) => {
                          const d = deliverables.find(
                            (x) => x.id === c.deliverable_id,
                          );
                          return (
                            <VariantCard
                              key={c.id}
                              cell={c}
                              deliverable={d}
                              onUpdate={onUpdate}
                              onDelete={onDelete}
                            />
                          );
                        })}
                        <button
                          onClick={() => setAdding({ angle: a, placement: p })}
                          className="w-full border border-dashed border-muted-foreground/50 rounded-[2px] py-2 px-3 text-xs text-muted-foreground hover:text-foreground hover:border-foreground inline-flex items-center justify-center gap-1.5"
                        >
                          <Plus className="h-3 w-3" /> add variant
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <AddVariantDialog
          angle={adding.angle}
          placement={adding.placement}
          deliverables={deliverables.filter(
            (d) => d.placement === adding.placement && d.upload_ready,
          )}
          onClose={() => setAdding(null)}
          onSave={async (deliverable, hookLabel) => {
            await onAdd({
              angle: adding.angle,
              placement: adding.placement,
              deliverable,
              hookLabel,
            });
            setAdding(null);
          }}
        />
      )}
    </>
  );
}

function VariantCard({
  cell,
  deliverable,
  onUpdate,
  onDelete,
}: {
  cell: TestCellRow;
  deliverable: DeliverableRow | undefined;
  onUpdate: (id: string, patch: Partial<TestCellRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="border border-foreground rounded-[2px] p-2.5 bg-background">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-medium leading-tight break-words">
          {cell.hook_label || "(no hook label)"}
        </p>
        <button
          onClick={() => void onDelete(cell.id)}
          className="text-muted-foreground hover:text-[var(--color-rec)] shrink-0"
          title="Delete variant"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <p
        className="label-mono text-muted-foreground truncate"
        title={deliverable?.filename ?? ""}
      >
        {deliverable?.filename ?? "(deliverable missing)"}
      </p>
      <p className="font-mono text-[10px] mt-1 break-all line-clamp-2 text-muted-foreground">
        {cell.ad_name}
      </p>
      <div className="flex items-center justify-between gap-2 mt-2">
        <Select
          value={cell.status}
          onValueChange={(v) =>
            void onUpdate(cell.id, { status: v as TestCellStatus })
          }
        >
          <SelectTrigger
            className={cn(
              "h-6 text-[10px] font-mono uppercase tracking-wider px-2 py-0 border rounded-[2px] w-[88px]",
              STATUS_STYLES[cell.status],
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cell.utm_url && (
          <button
            onClick={() => copy(cell.utm_url ?? "")}
            className="label-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            title="Copy UTM URL"
          >
            <Copy className="h-3 w-3" /> utm
          </button>
        )}
      </div>
    </div>
  );
}

function AddVariantDialog({
  angle,
  placement,
  deliverables,
  onClose,
  onSave,
}: {
  angle: AngleRow;
  placement: Placement;
  deliverables: DeliverableRow[];
  onClose: () => void;
  onSave: (deliverable: DeliverableRow, hookLabel: string) => Promise<void>;
}) {
  const [deliverableId, setDeliverableId] = useState<string>(
    deliverables[0]?.id ?? "",
  );
  const [hookLabel, setHookLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const d = deliverables.find((x) => x.id === deliverableId);
    if (!d) {
      toast.error("Pick a deliverable");
      return;
    }
    if (!hookLabel.trim()) {
      toast.error("Add a short hook label");
      return;
    }
    setSaving(true);
    await onSave(d, hookLabel.trim());
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">
            Add variant · {angle.title} ×{" "}
            <span className="font-mono">
              {PLACEMENT_LABEL[placement].label}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="label-mono">
              Upload-ready deliverable · {PLACEMENT_LABEL[placement].label}
            </Label>
            {deliverables.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-[2px] p-3 mt-1">
                No upload-ready{" "}
                <span className="font-mono">
                  {PLACEMENT_LABEL[placement].label}
                </span>{" "}
                deliverables yet. Mark a variant upload-ready in the Deliverables
                module first.
              </p>
            ) : (
              <Select value={deliverableId} onValueChange={setDeliverableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose deliverable" />
                </SelectTrigger>
                <SelectContent>
                  {deliverables.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.filename ?? d.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="label-mono">Hook label</Label>
            <Input
              value={hookLabel}
              onChange={(e) => setHookLabel(e.target.value)}
              placeholder="e.g. 'stop the itch', 'before/after', 'price reveal'"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Short tag describing the hook used in this variant. Feeds into the
              ad name.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || deliverables.length === 0}>
            <Check className="h-4 w-4" /> Add variant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Export ----------------
function ExportDialog({
  open,
  onClose,
  campaign,
  brief,
  cells,
  angles,
  deliverables,
}: {
  open: boolean;
  onClose: () => void;
  campaign: CampaignRow;
  brief: BriefRow;
  cells: TestCellRow[];
  angles: AngleRow[];
  deliverables: DeliverableRow[];
}) {
  const rows = cells.map((c) => {
    const angle = angles.find((a) => a.id === c.angle_id);
    const d = deliverables.find((x) => x.id === c.deliverable_id);
    return {
      ad_name: c.ad_name ?? "",
      angle: angle?.title ?? "",
      hook_label: c.hook_label ?? "",
      format: c.format_label ?? "",
      filename: d?.filename ?? "",
      utm_url: c.utm_url ?? "",
      status: c.status,
    };
  });

  const header = `LAUNCH PLAN — ${brief.brand?.name ?? ""} · ${brief.project_name ?? ""}\nCampaign: ${campaign.meta_campaign_name ?? ""}\nType: ${campaign.campaign_type ?? "—"} | Objective: ${brief.objective ?? "—"} | Daily: ${campaign.daily_budget ?? "—"} | Start: ${campaign.start_date ?? "—"}\nPrimary metric: ${campaign.primary_metric ?? "—"} | Target: ${brief.kpi_target ?? "—"}\n`;

  const text =
    header +
    "\n" +
    rows
      .map(
        (r) =>
          `• ${r.ad_name}\n    angle:    ${r.angle}\n    hook:     ${r.hook_label}\n    format:   ${r.format}\n    file:     ${r.filename}\n    utm:      ${r.utm_url}\n    status:   ${r.status}`,
      )
      .join("\n\n");

  const json = JSON.stringify(
    {
      campaign: {
        meta_campaign_name: campaign.meta_campaign_name,
        campaign_type: campaign.campaign_type,
        objective: brief.objective,
        daily_budget: campaign.daily_budget,
        start_date: campaign.start_date,
        primary_metric: campaign.primary_metric,
        naming_convention: campaign.naming_convention,
        utm_template: campaign.utm_template,
      },
      brief: {
        brand: brief.brand?.name,
        project: brief.project_name,
        destination_url: brief.destination_url,
        kpi_target: brief.kpi_target,
      },
      variants: rows,
    },
    null,
    2,
  );

  const baseName = `${slug(brief.brand?.name)}-${slug(brief.project_name)}-launch-plan`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Launch plan export</DialogTitle>
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
                  onClick={() => downloadFile(`${baseName}.txt`, text)}
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
                    downloadFile(`${baseName}.json`, json, "application/json")
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

// ---------------- Helpers UI ----------------
function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-muted-foreground rounded-[2px] p-8 text-center">
      <BarChart3 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        {body}
      </p>
    </div>
  );
}