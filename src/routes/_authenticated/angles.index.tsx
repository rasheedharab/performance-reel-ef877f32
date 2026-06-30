import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type EntryPoint = Database["public"]["Enums"]["angle_entry_point"];
type AngleStatus = "draft" | "approved" | "archived";
type BriefStatus = Database["public"]["Enums"]["brief_status"];

const ENTRY_POINTS: EntryPoint[] = [
  "pain",
  "outcome",
  "objection",
  "social_proof",
  "identity",
  "curiosity",
];

const ENTRY_POINT_LABEL: Record<EntryPoint, string> = {
  pain: "Pain",
  outcome: "Outcome",
  objection: "Objection",
  social_proof: "Social proof",
  identity: "Identity",
  curiosity: "Curiosity",
};

const ENTRY_POINT_HELPER: Record<EntryPoint, string> = {
  pain: "lead with the ache they feel today",
  outcome: "lead with the transformation they want",
  objection: "lead by dismantling the thing that stops them",
  social_proof: "lead with who's already doing it",
  identity: "lead with who they become",
  curiosity: "lead with a pattern interrupt they can't ignore",
};

// muted-but-distinct colors per entry point
const ENTRY_POINT_COLOR: Record<
  EntryPoint,
  { bg: string; text: string; border: string; dot: string }
> = {
  pain: {
    bg: "bg-[#E0301E]/10",
    text: "text-[#E0301E]",
    border: "border-[#E0301E]/40",
    dot: "bg-[#E0301E]",
  },
  outcome: {
    bg: "bg-emerald-700/10",
    text: "text-emerald-800",
    border: "border-emerald-700/40",
    dot: "bg-emerald-700",
  },
  objection: {
    bg: "bg-amber-700/10",
    text: "text-amber-800",
    border: "border-amber-700/40",
    dot: "bg-amber-700",
  },
  social_proof: {
    bg: "bg-sky-700/10",
    text: "text-sky-800",
    border: "border-sky-700/40",
    dot: "bg-sky-700",
  },
  identity: {
    bg: "bg-purple-700/10",
    text: "text-purple-800",
    border: "border-purple-700/40",
    dot: "bg-purple-700",
  },
  curiosity: {
    bg: "bg-rose-700/10",
    text: "text-rose-800",
    border: "border-rose-700/40",
    dot: "bg-rose-700",
  },
};

type BriefLite = {
  id: string;
  project_name: string;
  status: BriefStatus;
  brand: { id: string; name: string } | null;
};

type BriefFull = BriefLite & {
  awareness_stage: string | null;
  core_driver: string | null;
  objection: string | null;
  psychographic: string | null;
  benefits: unknown;
  wedge: string | null;
  offer_type: string | null;
  offer_detail: string | null;
  brand_voice: string | null;
  brand_no_go: unknown;
};

type AngleRow = {
  id: string;
  brief_id: string;
  title: string;
  entry_point: EntryPoint | null;
  target_segment: string | null;
  hook_seed: string | null;
  description: string | null;
  status: AngleStatus;
  priority: number;
};

type AngleOverviewRow = AngleRow & {
  brief: {
    id: string;
    project_name: string;
    status: BriefStatus;
    brand: { id: string; name: string } | null;
  } | null;
};

type SuggestedAngle = {
  title: string;
  entry_point: EntryPoint;
  target_segment: string;
  hook_seed: string;
  description: string;
};

function normalizeSuggested(raw: unknown): SuggestedAngle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const ep = typeof r.entry_point === "string" ? r.entry_point.toLowerCase().trim() : "";
  if (!title || !ENTRY_POINTS.includes(ep as EntryPoint)) return null;
  return {
    title,
    entry_point: ep as EntryPoint,
    target_segment: typeof r.target_segment === "string" ? r.target_segment : "",
    hook_seed: typeof r.hook_seed === "string" ? r.hook_seed : "",
    description: typeof r.description === "string" ? r.description : "",
  };
}

const searchSchema = z.object({
  brief: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/angles/")({
  validateSearch: searchSchema,
  component: AnglesWorkspace,
});

function EntryPointChip({
  ep,
  active = true,
  size = "sm",
}: {
  ep: EntryPoint;
  active?: boolean;
  size?: "sm" | "xs";
}) {
  const c = ENTRY_POINT_COLOR[ep];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono uppercase tracking-wider border rounded-[2px]",
        size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5",
        active ? `${c.bg} ${c.text} ${c.border}` : "bg-transparent text-muted-foreground/50 border-border/60",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? c.dot : "bg-muted-foreground/30")} />
      {ENTRY_POINT_LABEL[ep]}
    </span>
  );
}

function StatusChip({ status }: { status: AngleStatus }) {
  const styles: Record<AngleStatus, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    approved: "bg-foreground text-background border-foreground",
    archived: "bg-transparent text-muted-foreground/60 border-border/60",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

function BriefStatusChip({ status }: { status: BriefStatus }) {
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
        "inline-flex items-center font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px]",
        styles[status],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function AnglesWorkspace() {
  const { brief: briefParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [briefs, setBriefs] = useState<BriefLite[] | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [overview, setOverview] = useState<AngleOverviewRow[] | null>(null);
  const [overviewBrandFilter, setOverviewBrandFilter] = useState<string>("all");

  const [selectedBrief, setSelectedBrief] = useState<BriefFull | null>(null);
  const [angles, setAngles] = useState<AngleRow[] | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AngleRow | null>(null);
  const [detail, setDetail] = useState<AngleRow | null>(null);
  const [psychoExpanded, setPsychoExpanded] = useState(false);

  // AI suggestions
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedAngle[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("briefs")
        .select("id, project_name, status, brand:brands(id, name)")
        .order("created_at", { ascending: false });
      setBriefs((data as unknown as BriefLite[]) ?? []);
    })();
  }, []);

  // Load all angles for the overview grid (when no brief is selected)
  useEffect(() => {
    if (briefParam) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("angles")
        .select(
          "id, brief_id, title, entry_point, target_segment, hook_seed, description, status, priority, brief:briefs(id, project_name, status, brand:brands(id, name))",
        )
        .order("status", { ascending: true })
        .order("priority", { ascending: true });
      if (alive) setOverview((data as unknown as AngleOverviewRow[]) ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [briefParam]);

  // Load full brief when selected
  useEffect(() => {
    if (!briefParam) {
      setSelectedBrief(null);
      setAngles(null);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("briefs")
        .select(
          "id, project_name, status, awareness_stage, core_driver, objection, psychographic, benefits, wedge, offer_type, offer_detail, brand:brands(id, name, brand_voice, no_go_list)",
        )
        .eq("id", briefParam)
        .maybeSingle();
      if (alive) {
        if (!data) {
          setSelectedBrief(null);
        } else {
          const d = data as unknown as {
            id: string;
            project_name: string;
            status: BriefStatus;
            awareness_stage: string | null;
            core_driver: string | null;
            objection: string | null;
            psychographic: string | null;
            benefits: unknown;
            wedge: string | null;
            offer_type: string | null;
            offer_detail: string | null;
            brand: { id: string; name: string; brand_voice: string | null; no_go_list: unknown } | null;
          };
          setSelectedBrief({
            id: d.id,
            project_name: d.project_name,
            status: d.status,
            awareness_stage: d.awareness_stage,
            core_driver: d.core_driver,
            objection: d.objection,
            psychographic: d.psychographic,
            benefits: d.benefits,
            wedge: d.wedge,
            offer_type: d.offer_type,
            offer_detail: d.offer_detail,
            brand: d.brand ? { id: d.brand.id, name: d.brand.name } : null,
            brand_voice: d.brand?.brand_voice ?? null,
            brand_no_go: d.brand?.no_go_list ?? null,
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [briefParam]);

  const loadAngles = async (briefId: string) => {
    const { data } = await supabase
      .from("angles")
      .select("id, brief_id, title, entry_point, target_segment, hook_seed, description, status, priority")
      .eq("brief_id", briefId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });
    setAngles((data as unknown as AngleRow[]) ?? []);
  };

  useEffect(() => {
    if (briefParam) loadAngles(briefParam);
  }, [briefParam]);

  const filteredBriefs = useMemo(() => {
    if (!briefs) return [];
    const allowed: BriefStatus[] = showDrafts
      ? ["draft", "locked", "in_production", "live", "archived"]
      : ["locked", "in_production"];
    const s = search.trim().toLowerCase();
    return briefs
      .filter((b) => allowed.includes(b.status))
      .filter((b) => {
        if (!s) return true;
        return (
          b.project_name.toLowerCase().includes(s) ||
          (b.brand?.name ?? "").toLowerCase().includes(s)
        );
      });
  }, [briefs, showDrafts, search]);

  const selectBrief = (id: string) => {
    navigate({ search: { brief: id } });
    setPickerOpen(false);
  };

  const usedEntryPoints = useMemo(() => {
    const set = new Set<EntryPoint>();
    angles?.forEach((a) => {
      if (a.entry_point) set.add(a.entry_point);
    });
    return set;
  }, [angles]);

  const requestSuggestions = async () => {
    if (!selectedBrief) return;
    setSuggesting(true);
    setSuggestError(null);
    setSuggestions(null);
    setSuggestOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: {
          task: "suggest_angles",
          payload: {
            awareness_stage: selectedBrief.awareness_stage,
            core_driver: selectedBrief.core_driver,
            objection: selectedBrief.objection,
            psychographic: selectedBrief.psychographic,
            benefits: selectedBrief.benefits,
            wedge: selectedBrief.wedge,
            offer_type: selectedBrief.offer_type,
            offer_detail: selectedBrief.offer_detail,
            brand_voice: selectedBrief.brand_voice,
            no_go_list: selectedBrief.brand_no_go,
          },
        },
      });
      if (error) throw new Error(error.message);
      const payload = data as { result?: { angles?: SuggestedAngle[] }; error?: string };
      if (payload?.error) {
        setSuggestError(payload.error);
        return;
      }
      const raw = payload?.result?.angles;
      if (!Array.isArray(raw)) {
        setSuggestError("AI did not return any angles. Try again.");
        return;
      }
      const cleaned = raw
        .map((a) => normalizeSuggested(a))
        .filter((a): a is SuggestedAngle => a !== null);
      if (cleaned.length === 0) {
        setSuggestError("AI returned no usable angles. Try again.");
        return;
      }
      setSuggestions(cleaned);
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSuggesting(false);
    }
  };

  const addSuggested = async (s: SuggestedAngle): Promise<boolean> => {
    if (!selectedBrief) return false;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Not signed in");
      return false;
    }
    const nextPriority = angles?.length ?? 0;
    const { error } = await supabase.from("angles").insert({
      brief_id: selectedBrief.id,
      user_id: userId,
      title: s.title.trim(),
      entry_point: s.entry_point,
      target_segment: s.target_segment?.trim() || null,
      hook_seed: s.hook_seed?.trim() || null,
      description: s.description?.trim() || null,
      priority: nextPriority,
      status: "draft",
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    await loadAngles(selectedBrief.id);
    return true;
  };

  const benefitStrings = useMemo(() => {
    if (!selectedBrief?.benefits) return [];
    const b = selectedBrief.benefits as unknown;
    if (Array.isArray(b)) return b.filter((x) => typeof x === "string" && x.trim()) as string[];
    if (typeof b === "object" && b) {
      return Object.values(b as Record<string, unknown>).filter(
        (x) => typeof x === "string" && (x as string).trim(),
      ) as string[];
    }
    return [];
  }, [selectedBrief]);

  const reorder = async (angle: AngleRow, dir: -1 | 1) => {
    if (!angles) return;
    const idx = angles.findIndex((a) => a.id === angle.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= angles.length) return;
    const other = angles[swapIdx];
    const next = [...angles];
    next[idx] = { ...other, priority: angle.priority };
    next[swapIdx] = { ...angle, priority: other.priority };
    // Ensure unique priorities — re-number sequentially
    const renum = next.map((a, i) => ({ ...a, priority: i }));
    setAngles(renum);
    const updates = renum.map((a) =>
      supabase.from("angles").update({ priority: a.priority }).eq("id", a.id),
    );
    await Promise.all(updates);
  };

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="label-mono mb-2">Phase 01 · Strategy</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Angles</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-xl">
          Translate the brief into distinct entry points worth testing.
        </p>
      </div>

      {/* Brief selector */}
      <div className="border border-border rounded-[3px] bg-card p-4 mb-6 flex flex-wrap items-center gap-4">
        <span className="label-mono">Brief</span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex-1 min-w-[280px] flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 rounded-[3px] text-sm hover:border-foreground/40 transition-colors"
            >
              {selectedBrief ? (
                <span className="flex items-center gap-2 truncate">
                  <span className="text-muted-foreground truncate">
                    {selectedBrief.brand?.name ?? "—"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium truncate">{selectedBrief.project_name}</span>
                  <BriefStatusChip status={selectedBrief.status} />
                </span>
              ) : (
                <span className="text-muted-foreground">Select a brief…</span>
              )}
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="start">
            <div className="p-2 border-b border-border">
              <Input
                placeholder="Search briefs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filteredBriefs.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No briefs match.
                </div>
              ) : (
                filteredBriefs.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => selectBrief(b.id)}
                    className="w-full text-left px-3 py-2 hover:bg-background/60 border-b border-border/60 last:border-b-0 flex items-center gap-2"
                  >
                    <span className="text-xs text-muted-foreground truncate w-32 shrink-0">
                      {b.brand?.name ?? "—"}
                    </span>
                    <span className="text-sm font-medium flex-1 truncate">
                      {b.project_name}
                    </span>
                    <BriefStatusChip status={b.status} />
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={showDrafts} onCheckedChange={setShowDrafts} />
          <span className="label-mono">Show drafts too</span>
        </label>
      </div>

      {!selectedBrief ? (
        <AnglesOverview
          rows={overview}
          brandFilter={overviewBrandFilter}
          onBrandFilter={setOverviewBrandFilter}
          onPick={(briefId) => navigate({ search: { brief: briefId } })}
        />
      ) : (
        <>
          {selectedBrief.status === "draft" && (
            <div className="mb-6 border border-border bg-card px-4 py-3 rounded-[3px] text-xs text-muted-foreground">
              <span className="label-mono mr-2 text-[var(--color-rec)]">Heads up</span>
              Lock the brief before moving to production.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* LEFT: brief context */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="border border-border rounded-[3px] bg-card p-5">
                <p className="label-mono mb-4 text-[var(--color-rec)]">The brief says</p>
                <dl className="space-y-4 text-sm">
                  <BriefField label="Awareness stage" value={selectedBrief.awareness_stage} />
                  <BriefField label="Core driver" value={selectedBrief.core_driver} />
                  <BriefField label="#1 objection" value={selectedBrief.objection} />
                  <div>
                    <dt className="label-mono mb-1">Psychographic</dt>
                    <dd className="text-foreground">
                      {selectedBrief.psychographic ? (
                        <>
                          <p
                            className={cn(
                              "whitespace-pre-wrap",
                              !psychoExpanded && "line-clamp-3",
                            )}
                          >
                            {selectedBrief.psychographic}
                          </p>
                          {selectedBrief.psychographic.length > 140 && (
                            <button
                              onClick={() => setPsychoExpanded((v) => !v)}
                              className="label-mono mt-1 text-muted-foreground hover:text-foreground"
                            >
                              {psychoExpanded ? "Collapse" : "Expand"}
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-mono mb-1">Benefits</dt>
                    <dd>
                      {benefitStrings.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {benefitStrings.map((b, i) => (
                            <li key={i} className="text-foreground">
                              · {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </dd>
                  </div>
                  <BriefField label="The wedge" value={selectedBrief.wedge} />
                </dl>
              </div>
            </aside>

            {/* RIGHT: working area */}
            <section>
              {/* Coverage strip */}
              <div className="border border-border rounded-[3px] bg-card p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="label-mono">Coverage</p>
                  <p className="text-xs text-muted-foreground">
                    {usedEntryPoints.size} / {ENTRY_POINTS.length} entry points
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ENTRY_POINTS.map((ep) => (
                    <EntryPointChip key={ep} ep={ep} active={usedEntryPoints.has(ep)} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Test different angles, not one angle five ways.
                </p>
              </div>

              {/* Angle grid */}
              <div className="flex items-center justify-between mb-3">
                <p className="label-mono">Angles</p>
                <div className="flex items-center gap-2">
                  <SuggestButton
                    coreDriver={selectedBrief.core_driver}
                    loading={suggesting}
                    onClick={requestSuggestions}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    New angle
                  </Button>
                </div>
              </div>

              {angles === null ? (
                <div className="border border-border rounded-[3px] bg-card animate-pulse h-48" />
              ) : angles.length === 0 ? (
                <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-12 text-center">
                  <p className="label-mono mb-3">No angles yet</p>
                  <p className="text-sm text-muted-foreground mb-5">
                    Sketch the first entry point for this brief.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    New angle
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {angles.map((a, i) => (
                    <article
                      key={a.id}
                      className="border border-border bg-card rounded-[3px] p-5 flex flex-col gap-3 hover:border-foreground/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {a.entry_point ? (
                          <EntryPointChip ep={a.entry_point} />
                        ) : (
                          <span className="label-mono text-muted-foreground/60">No entry point</span>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => reorder(a, -1)}
                            disabled={i === 0}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => reorder(a, 1)}
                            disabled={i === angles.length - 1}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <button
                        className="text-left"
                        onClick={() => setDetail(a)}
                      >
                        <h3 className="font-display text-lg font-bold leading-tight mb-1">
                          {a.title}
                        </h3>
                        {a.target_segment && (
                          <p className="label-mono text-muted-foreground mb-2">
                            {a.target_segment}
                          </p>
                        )}
                        {a.hook_seed && (
                          <p className="text-sm italic text-foreground/80 mb-2">
                            "{a.hook_seed}"
                          </p>
                        )}
                        {a.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {a.description}
                          </p>
                        )}
                      </button>
                      <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <StatusChip status={a.status} />
                        <button
                          onClick={() => {
                            setEditing(a);
                            setFormOpen(true);
                          }}
                          className="label-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {selectedBrief && (
        <AngleFormDialog
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setEditing(null);
          }}
          briefId={selectedBrief.id}
          existing={editing}
          nextPriority={angles?.length ?? 0}
          onSaved={async () => {
            await loadAngles(selectedBrief.id);
          }}
        />
      )}

      <AngleDetailDialog
        angle={detail}
        brief={selectedBrief}
        onOpenChange={(o) => !o && setDetail(null)}
        onEdit={(a) => {
          setDetail(null);
          setEditing(a);
          setFormOpen(true);
        }}
        onStatusChange={async (a, status) => {
          await supabase.from("angles").update({ status }).eq("id", a.id);
          if (selectedBrief) await loadAngles(selectedBrief.id);
          setDetail({ ...a, status });
        }}
      />

      <SuggestDrawer
        open={suggestOpen}
        onOpenChange={(o) => {
          setSuggestOpen(o);
          if (!o) {
            setSuggestions(null);
            setSuggestError(null);
          }
        }}
        loading={suggesting}
        error={suggestError}
        suggestions={suggestions}
        setSuggestions={setSuggestions}
        onAdd={addSuggested}
        onRetry={requestSuggestions}
      />
    </div>
  );
}

function BriefField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="label-mono mb-1">{label}</dt>
      <dd className="text-foreground">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function AngleFormDialog({
  open,
  onOpenChange,
  briefId,
  existing,
  nextPriority,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  briefId: string;
  existing: AngleRow | null;
  nextPriority: number;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [entryPoint, setEntryPoint] = useState<EntryPoint | "">("");
  const [targetSegment, setTargetSegment] = useState("");
  const [hookSeed, setHookSeed] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<number>(0);
  const [status, setStatus] = useState<AngleStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setEntryPoint(existing.entry_point ?? "");
      setTargetSegment(existing.target_segment ?? "");
      setHookSeed(existing.hook_seed ?? "");
      setDescription(existing.description ?? "");
      setPriority(existing.priority);
      setStatus(existing.status);
    } else {
      setTitle("");
      setEntryPoint("");
      setTargetSegment("");
      setHookSeed("");
      setDescription("");
      setPriority(nextPriority);
      setStatus("draft");
    }
    setErrors({});
  }, [open, existing, nextPriority]);

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required.";
    if (!entryPoint) errs.entry_point = "Entry point is required.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Not signed in");
      setSaving(false);
      return;
    }

    const payload = {
      brief_id: briefId,
      user_id: userId,
      title: title.trim(),
      entry_point: entryPoint as EntryPoint,
      target_segment: targetSegment.trim() || null,
      hook_seed: hookSeed.trim() || null,
      description: description.trim() || null,
      priority,
      status,
    };

    const { error } = existing
      ? await supabase.from("angles").update(payload).eq("id", existing.id)
      : await supabase.from("angles").insert(payload);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(existing ? "Angle updated" : "Angle saved");
    await onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <p className="label-mono">{existing ? "Edit angle" : "New angle"}</p>
          <DialogTitle className="font-display text-2xl">
            {existing ? existing.title : "Sketch a new angle"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Field label="Title" required error={errors.title}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The angle in a few words"
            />
          </Field>

          <Field label="Entry point" required error={errors.entry_point}>
            <Select
              value={entryPoint || undefined}
              onValueChange={(v) => setEntryPoint(v as EntryPoint)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick an entry point" />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_POINTS.map((ep) => (
                  <SelectItem key={ep} value={ep}>
                    {ENTRY_POINT_LABEL[ep]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {entryPoint && (
              <p className="text-xs text-muted-foreground mt-1.5 italic">
                {ENTRY_POINT_LABEL[entryPoint as EntryPoint]} — {ENTRY_POINT_HELPER[entryPoint as EntryPoint]}.
              </p>
            )}
          </Field>

          <Field label="Target segment">
            <Input
              value={targetSegment}
              onChange={(e) => setTargetSegment(e.target.value)}
              placeholder="Who within the audience this speaks to loudest"
            />
          </Field>

          <Field label="Hook seed">
            <Input
              value={hookSeed}
              onChange={(e) => setHookSeed(e.target.value)}
              placeholder='A one-line starting hook — e.g. "Your bloating isn\u2019t food. It\u2019s the rinse."'
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The angle articulated — core message and promise"
              rows={4}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority">
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as AngleStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {existing ? "Save changes" : "Save angle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label-mono mb-1.5 flex items-center gap-1">
        {label}
        {required && <span className="text-[var(--color-rec)]">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs mt-1 text-[var(--color-rec)] font-mono uppercase tracking-wider">
          {error}
        </p>
      )}
    </div>
  );
}

function AngleDetailDialog({
  angle,
  brief,
  onOpenChange,
  onEdit,
  onStatusChange,
}: {
  angle: AngleRow | null;
  brief: BriefFull | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (a: AngleRow) => void;
  onStatusChange: (a: AngleRow, status: AngleStatus) => Promise<void>;
}) {
  return (
    <Dialog open={!!angle} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {angle && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                {angle.entry_point && <EntryPointChip ep={angle.entry_point} />}
                <StatusChip status={angle.status} />
              </div>
              <DialogTitle className="font-display text-3xl leading-tight">
                {angle.title}
              </DialogTitle>
              {brief && (
                <p className="text-xs text-muted-foreground mt-1">
                  {brief.brand?.name ?? "—"} · {brief.project_name}
                </p>
              )}
            </DialogHeader>

            <div className="py-4 space-y-5 border-t border-border">
              {angle.target_segment && (
                <div>
                  <p className="label-mono mb-1">Target segment</p>
                  <p className="text-sm">{angle.target_segment}</p>
                </div>
              )}
              {angle.hook_seed && (
                <div>
                  <p className="label-mono mb-1">Hook seed</p>
                  <p className="text-base italic">"{angle.hook_seed}"</p>
                </div>
              )}
              {angle.description && (
                <div>
                  <p className="label-mono mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{angle.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <p className="label-mono mb-1">Priority</p>
                  <p className="font-mono text-sm">{angle.priority}</p>
                </div>
                <div>
                  <p className="label-mono mb-1">Change status</p>
                  <Select
                    value={angle.status}
                    onValueChange={(v) => onStatusChange(angle, v as AngleStatus)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onEdit(angle)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button asChild>
                <Link to="/scripts" search={{ angle: angle.id }}>
                  Write scripts
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuggestButton({
  coreDriver,
  loading,
  onClick,
}: {
  coreDriver: string | null;
  loading: boolean;
  onClick: () => void;
}) {
  const disabled = !coreDriver || loading;
  const btn = (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {loading ? "Drafting angles…" : "Suggest angles"}
    </Button>
  );
  if (coreDriver) return btn;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>{btn}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          Add a core driver to the brief first — the AI needs audience context to draft useful angles.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SuggestDrawer({
  open,
  onOpenChange,
  loading,
  error,
  suggestions,
  setSuggestions,
  onAdd,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loading: boolean;
  error: string | null;
  suggestions: SuggestedAngle[] | null;
  setSuggestions: (s: SuggestedAngle[] | null) => void;
  onAdd: (s: SuggestedAngle) => Promise<boolean>;
  onRetry: () => void;
}) {
  const [addingAll, setAddingAll] = useState(false);

  const updateAt = (idx: number, patch: Partial<SuggestedAngle>) => {
    if (!suggestions) return;
    setSuggestions(suggestions.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const dismissAt = (idx: number) => {
    if (!suggestions) return;
    setSuggestions(suggestions.filter((_, i) => i !== idx));
  };
  const addAt = async (idx: number) => {
    if (!suggestions) return;
    const ok = await onAdd(suggestions[idx]);
    if (ok) {
      toast.success("Angle added as draft");
      dismissAt(idx);
    }
  };
  const addAll = async () => {
    if (!suggestions) return;
    setAddingAll(true);
    const remaining: SuggestedAngle[] = [];
    let added = 0;
    for (const s of suggestions) {
      const ok = await onAdd(s);
      if (ok) added += 1;
      else remaining.push(s);
    }
    setAddingAll(false);
    if (added > 0) toast.success(`Added ${added} angle${added === 1 ? "" : "s"}`);
    setSuggestions(remaining);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-[var(--color-rec)]" />
            <p className="label-mono">AI suggestions</p>
          </div>
          <SheetTitle className="font-display text-2xl">Drafted angles</SheetTitle>
          <p className="text-xs text-muted-foreground mt-1 italic">
            AI drafts — edit before adding. You're the director.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="label-mono">Drafting angles…</p>
            </div>
          )}

          {!loading && error && (
            <div className="border border-[var(--color-rec)]/40 bg-[var(--color-rec)]/5 rounded-[3px] p-4">
              <p className="label-mono text-[var(--color-rec)] mb-1">Something went wrong</p>
              <p className="text-sm text-foreground/80 mb-3">{error}</p>
              <Button size="sm" variant="outline" onClick={onRetry}>
                Try again
              </Button>
            </div>
          )}

          {!loading && !error && suggestions && suggestions.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <p className="label-mono mb-2">All clear</p>
              <p>No more suggestions to review.</p>
            </div>
          )}

          {!loading &&
            !error &&
            suggestions?.map((s, idx) => (
              <article
                key={idx}
                className="border border-border bg-card rounded-[3px] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Select
                    value={s.entry_point}
                    onValueChange={(v) => updateAt(idx, { entry_point: v as EntryPoint })}
                  >
                    <SelectTrigger className="h-7 w-auto gap-1.5 border-0 bg-transparent p-0 hover:bg-transparent focus:ring-0 [&>svg]:hidden">
                      <span className="block">
                        <EntryPointChip ep={s.entry_point} />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {ENTRY_POINTS.map((ep) => (
                        <SelectItem key={ep} value={ep}>
                          {ENTRY_POINT_LABEL[ep]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => dismissAt(idx)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div>
                  <label className="label-mono mb-1 block">Title</label>
                  <Input
                    value={s.title}
                    onChange={(e) => updateAt(idx, { title: e.target.value })}
                    className="font-display text-base"
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Target segment</label>
                  <Input
                    value={s.target_segment}
                    onChange={(e) => updateAt(idx, { target_segment: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Hook seed</label>
                  <Input
                    value={s.hook_seed}
                    onChange={(e) => updateAt(idx, { hook_seed: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-mono mb-1 block">Description</label>
                  <Textarea
                    value={s.description}
                    onChange={(e) => updateAt(idx, { description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <Button size="sm" variant="ghost" onClick={() => dismissAt(idx)}>
                    Dismiss
                  </Button>
                  <Button size="sm" onClick={() => addAt(idx)}>
                    Add
                  </Button>
                </div>
              </article>
            ))}
        </div>

        {!loading && !error && suggestions && suggestions.length > 1 && (
          <div className="border-t border-border p-4 flex items-center justify-between gap-2 bg-card">
            <p className="text-xs text-muted-foreground">
              {suggestions.length} draft{suggestions.length === 1 ? "" : "s"} remaining
            </p>
            <Button size="sm" onClick={addAll} disabled={addingAll}>
              {addingAll && <Loader2 className="h-4 w-4 animate-spin" />}
              Add all
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
