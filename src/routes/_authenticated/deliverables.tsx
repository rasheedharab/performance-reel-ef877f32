import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Film,
  Loader2,
  Package,
  Plus,
  Rocket,
  Search,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  uploadCampaignFile,
  getCampaignSignedUrls,
} from "@/lib/campaign-assets";

const searchSchema = z.object({
  cut: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/deliverables")({
  validateSearch: searchSchema,
  component: DeliverablesPage,
});

// ---------- Spec constants (Meta) ----------
type Placement = "reels" | "feed" | "stories";
type AspectRatio = "9:16" | "4:5" | "1:1";

type PlacementSpec = {
  placement: Placement;
  label: string;
  aspect: AspectRatio;
  width: number;
  height: number;
  resolution: string; // "1080x1920"
  durationMin: number;
  durationMax: number;
  durationNote: string;
  safe: { top: number; bottom: number; side: number }; // % of height/width
  safeNote: string;
};

const SPECS: Record<Placement, PlacementSpec> = {
  reels: {
    placement: "reels",
    label: "Reels",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    resolution: "1080x1920",
    durationMin: 5,
    durationMax: 90,
    durationNote: "5–90s. Sweet spot 15–30s for awareness.",
    safe: { top: 14, bottom: 20, side: 6 },
    safeNote: "Top ~14% (~250px) and bottom ~20% reserved for UI. Side margins ~6%.",
  },
  stories: {
    placement: "stories",
    label: "Stories",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    resolution: "1080x1920",
    durationMin: 1,
    durationMax: 60,
    durationNote: "Auto-splits into 20s segments past 20s. Keep ≤20s when possible.",
    safe: { top: 14, bottom: 35, side: 6 },
    safeNote: "Top ~14% (~250px) and bottom ~20–35% reserved for profile + sticker UI. Side margins ~6%.",
  },
  feed: {
    placement: "feed",
    label: "Feed",
    aspect: "4:5",
    width: 1080,
    height: 1350,
    resolution: "1080x1350",
    durationMin: 1,
    durationMax: 60,
    durationNote: "1–60s typical; shorter performs better in-feed.",
    safe: { top: 6, bottom: 12, side: 6 },
    safeNote: "~6% margins; bottom ~12% to clear caption/CTA overlay.",
  },
};

const FILE_SPEC = {
  container: "MP4 or MOV",
  codec: "H.264 (High profile)",
  audio: "AAC, 128 kbps+, stereo",
  resolution: "1080p (full)",
  maxSize: "≤1 GB recommended, 4 GB hard max",
  framerate: "30fps (24/25 acceptable)",
};

// Parse a brief.placements label like "Reels 9:16" → "reels"
function placementFromLabel(label: string): Placement | null {
  const l = label.toLowerCase();
  if (l.includes("reel")) return "reels";
  if (l.includes("stor")) return "stories";
  if (l.includes("feed")) return "feed";
  if (l.includes("1:1") || l.includes("square") || l.includes("carousel")) return "feed";
  return null;
}

function slug(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "untitled";
}

function makeFilename(
  brand: string | null,
  project: string | null,
  cutName: string,
  version: number,
  ratio: AspectRatio,
): string {
  const r = ratio.replace(":", "x");
  return `${slug(brand)}-${slug(project)}-${slug(cutName)}-v${version}-${r}.mp4`;
}

// ---------- Types ----------
type CutRow = {
  id: string;
  brief_id: string;
  script_id: string | null;
  name: string;
  version: number | null;
  status: string | null;
  export_ready: boolean | null;
  total_duration: number | null;
  brief: {
    id: string;
    project_name: string | null;
    captions_required: boolean | null;
    placements: unknown;
    brand: { id: string; name: string } | null;
  } | null;
  script: { id: string; archetype: string | null } | null;
};

type Deliverable = {
  id: string;
  cut_id: string;
  placement: Placement | null;
  aspect_ratio: AspectRatio | null;
  resolution: string | null;
  duration_seconds: number | null;
  safe_zone_ok: boolean;
  duration_ok: boolean;
  captions_burned: boolean;
  audio_ok: boolean;
  resolution_ok: boolean;
  filename: string | null;
  file_url: string | null;
  upload_ready: boolean;
  status: string | null;
  notes: string | null;
  spec_checked: boolean | null;
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

// ---------- Page ----------
function DeliverablesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [cuts, setCuts] = useState<CutRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(search.cut ?? null);
  const [showAll, setShowAll] = useState(false);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [allSheetOpen, setAllSheetOpen] = useState(false);

  useEffect(() => {
    void loadCuts();
  }, []);

  useEffect(() => {
    if (selectedId) void loadDeliverables(selectedId);
    else setDeliverables([]);
  }, [selectedId]);

  async function loadCuts() {
    const { data, error } = await supabase
      .from("cuts")
      .select(
        "id, brief_id, script_id, name, version, status, export_ready, total_duration, brief:briefs(id, project_name, captions_required, placements, brand:brands(id, name)), script:scripts(id, archetype)",
      )
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Failed to load cuts");
      setCuts([]);
      return;
    }
    setCuts((data as unknown as CutRow[]) ?? []);
  }

  async function loadDeliverables(cutId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("deliverables")
      .select("*")
      .eq("cut_id", cutId)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Failed to load variants");
      return;
    }
    const rows = (data as unknown as Deliverable[]) ?? [];
    setDeliverables(rows);
    const paths = rows
      .map((r) => r.file_url)
      .filter((u): u is string => !!u && !u.startsWith("http"));
    if (paths.length) setSigned(await getCampaignSignedUrls(paths));
    else setSigned({});
  }

  const selectedCut = useMemo(
    () => cuts?.find((c) => c.id === selectedId) ?? null,
    [cuts, selectedId],
  );

  const visibleCuts = useMemo(() => {
    const list = (cuts ?? []).filter((c) => showAll || c.export_ready);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      [c.name, c.brief?.project_name, c.brief?.brand?.name]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [cuts, query, showAll]);

  async function generateVariantSet() {
    if (!selectedCut) return;
    const labels = asStringArray(selectedCut.brief?.placements);
    const wanted = Array.from(
      new Set(labels.map(placementFromLabel).filter((p): p is Placement => !!p)),
    );
    if (wanted.length === 0) {
      toast.error("Brief has no placements set");
      return;
    }
    const existing = new Set(deliverables.map((d) => d.placement));
    const toInsert = wanted.filter((p) => !existing.has(p));
    if (toInsert.length === 0) {
      toast.message("All placement variants already exist");
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    const captionsRequired = selectedCut.brief?.captions_required === true;
    const duration = selectedCut.total_duration ?? 0;
    const rows = toInsert.map((p) => {
      const spec = SPECS[p];
      const ratio = spec.aspect;
      const filename = makeFilename(
        selectedCut.brief?.brand?.name ?? null,
        selectedCut.brief?.project_name ?? null,
        selectedCut.name,
        selectedCut.version ?? 1,
        ratio,
      );
      const durOk =
        duration > 0 && duration >= spec.durationMin && duration <= spec.durationMax;
      return {
        user_id: uid,
        cut_id: selectedCut.id,
        placement: p,
        aspect_ratio: ratio,
        resolution: spec.resolution,
        duration_seconds: duration || null,
        filename,
        captions_burned: false,
        safe_zone_ok: false,
        duration_ok: durOk,
        audio_ok: false,
        resolution_ok: false,
        upload_ready: false,
        status: "draft",
        notes: captionsRequired ? "Brief requires burned-in captions." : null,
      };
    });
    const { error } = await supabase.from("deliverables").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Created ${rows.length} variant${rows.length === 1 ? "" : "s"}`);
    await loadDeliverables(selectedCut.id);
  }

  async function patchDeliverable(id: string, patch: Partial<Deliverable>) {
    const prev = deliverables;
    setDeliverables((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase
      .from("deliverables")
      .update(patch as never)
      .eq("id", id);
    if (error) {
      setDeliverables(prev);
      toast.error(error.message);
    }
  }

  async function removeDeliverable(id: string) {
    if (!confirm("Delete this variant?")) return;
    const { error } = await supabase.from("deliverables").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setDeliverables((d) => d.filter((x) => x.id !== id));
  }

  const totalChecks = 5;
  const setStats = useMemo(() => {
    if (deliverables.length === 0) return { ready: 0, total: 0 };
    return {
      ready: deliverables.filter((d) => d.upload_ready).length,
      total: deliverables.length,
    };
  }, [deliverables]);

  // ---------- Render ----------
  if (!selectedCut) {
    return (
      <div className="container max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="label-mono mb-2">EXPORTS · PHASE 6</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2">
            Deliverables
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Per-placement spec sheets and compliance tracking. Pick a cut that's
            marked export-ready to generate its variant set.
          </p>
        </div>

        <div className="border border-foreground rounded-[2px] p-6 bg-card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="label-mono">Pick a cut</p>
            <label className="flex items-center gap-2 label-mono cursor-pointer">
              <Switch checked={showAll} onCheckedChange={setShowAll} />
              Show all cuts
            </label>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by brand, project, or cut name…"
              className="pl-9"
            />
          </div>
          <CutList
            cuts={visibleCuts}
            onPick={(id) => setSelectedId(id)}
            loading={cuts === null}
          />
        </div>
      </div>
    );
  }

  const brief = selectedCut.brief;
  const placementLabels = asStringArray(brief?.placements);
  const briefPlacements = Array.from(
    new Set(placementLabels.map(placementFromLabel).filter((p): p is Placement => !!p)),
  );
  const captionsRequired = brief?.captions_required === true;

  return (
    <div className="container max-w-7xl mx-auto px-6 py-10">
      <div className="mb-6">
        <button
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1.5 label-mono text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3 w-3" /> Back to cut list
        </button>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="label-mono mb-1">
              {brief?.brand?.name ?? "—"} · {brief?.project_name ?? "—"}
              {selectedCut.script?.archetype && (
                <> · {selectedCut.script.archetype}</>
              )}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
              {selectedCut.name}
              <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 border border-foreground rounded-[2px]">
                v{selectedCut.version ?? 1}
              </span>
              {selectedCut.export_ready ? (
                <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[var(--color-rec)] text-[var(--color-rec)] rounded-[2px]">
                  Export-ready
                </span>
              ) : (
                <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-muted-foreground text-muted-foreground rounded-[2px]">
                  Not export-ready
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAllSheetOpen(true)}
              disabled={deliverables.length === 0}
            >
              <FileText className="h-3.5 w-3.5" /> Spec sheet for all variants
            </Button>
            <Button size="sm" onClick={generateVariantSet}>
              <Plus className="h-3.5 w-3.5" /> Generate variant set
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate({
                  to: "/launch",
                  search: { brief: selectedCut.brief?.id ?? undefined },
                })
              }
              disabled={setStats.ready === 0}
            >
              <Rocket className="h-3.5 w-3.5" /> Plan launch →
            </Button>
          </div>
        </div>
      </div>

      {/* Cut context strip */}
      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total duration" value={`${selectedCut.total_duration?.toFixed?.(1) ?? "—"}s`} />
        <Stat
          label="Brief placements"
          value={briefPlacements.length > 0 ? briefPlacements.join(" · ") : "None set"}
        />
        <Stat label="Captions required" value={captionsRequired ? "Yes" : "No"} />
        <Stat
          label="Upload-ready"
          value={`${setStats.ready} / ${setStats.total}`}
        />
      </div>

      {/* Meta quality note */}
      <div className="border border-[var(--color-rec)] rounded-[2px] p-4 mb-6 bg-card">
        <p className="label-mono text-[var(--color-rec)] mb-1">Quality is a ranking signal</p>
        <p className="text-sm">
          Meta's delivery system treats creative resolution &amp; quality as an
          auction signal. Always export at full <strong>1080p</strong>, H.264 +
          AAC, MP4/MOV. A low-res render loses the auction before targeting
          even fires.
        </p>
      </div>

      {loading && deliverables.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading variants…
        </div>
      ) : deliverables.length === 0 ? (
        <div className="border border-dashed border-foreground rounded-[2px] p-10 text-center">
          <Package className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-display text-xl font-semibold mb-1">No variants yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Hit <em>Generate variant set</em> to create one card per placement
            the brief targets.
          </p>
          <Button onClick={generateVariantSet}>
            <Plus className="h-3.5 w-3.5" /> Generate variant set
          </Button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {deliverables.map((d) => (
            <VariantCard
              key={d.id}
              deliverable={d}
              cut={selectedCut}
              signedUrl={d.file_url ? signed[d.file_url] : undefined}
              captionsRequired={captionsRequired}
              onPatch={(p) => patchDeliverable(d.id, p)}
              onDelete={() => removeDeliverable(d.id)}
              onFileUploaded={async (path) => {
                await patchDeliverable(d.id, { file_url: path });
                const map = await getCampaignSignedUrls([path]);
                setSigned((s) => ({ ...s, ...map }));
              }}
            />
          ))}
        </div>
      )}

      <AllSpecSheetDialog
        open={allSheetOpen}
        onOpenChange={setAllSheetOpen}
        cut={selectedCut}
        deliverables={deliverables}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-foreground rounded-[2px] p-3 bg-card">
      <p className="label-mono text-muted-foreground mb-1">{label}</p>
      <p className="font-display font-semibold text-base truncate">{value}</p>
    </div>
  );
}

function CutList({
  cuts,
  onPick,
  loading,
}: {
  cuts: CutRow[];
  onPick: (id: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading cuts…
      </div>
    );
  }
  if (cuts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No cuts match. Cuts must be marked <em>export-ready</em> in the Edit
        Room (or toggle "Show all cuts" above).
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {cuts.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => onPick(c.id)}
            className="w-full text-left py-3 flex items-center gap-3 hover:bg-muted/40 px-2 -mx-2 rounded-[2px]"
          >
            <Film className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="label-mono mb-0.5">
                {c.brief?.brand?.name ?? "—"} · {c.brief?.project_name ?? "—"}
                {c.script?.archetype && <> · {c.script.archetype}</>}
              </p>
              <p className="font-display font-semibold truncate">
                {c.name}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  v{c.version ?? 1}
                </span>
              </p>
            </div>
            {c.export_ready ? (
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[var(--color-rec)] text-[var(--color-rec)] rounded-[2px]">
                Ready
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-muted-foreground text-muted-foreground rounded-[2px]">
                Draft
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------- Variant card ----------
function VariantCard({
  deliverable,
  cut,
  signedUrl,
  captionsRequired,
  onPatch,
  onDelete,
  onFileUploaded,
}: {
  deliverable: Deliverable;
  cut: CutRow;
  signedUrl?: string;
  captionsRequired: boolean;
  onPatch: (p: Partial<Deliverable>) => void;
  onDelete: () => void;
  onFileUploaded: (path: string) => void;
}) {
  const d = deliverable;
  const spec = d.placement ? SPECS[d.placement] : null;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlVal, setUrlVal] = useState("");

  const dur = d.duration_seconds ?? cut.total_duration ?? 0;
  const durationOkAuto =
    !!spec && dur > 0 && dur >= spec.durationMin && dur <= spec.durationMax;
  const durationLabel = spec
    ? dur > 0
      ? `${dur.toFixed(1)}s · target ${spec.durationMin}–${spec.durationMax}s`
      : `target ${spec.durationMin}–${spec.durationMax}s`
    : "—";

  const checks: { key: keyof Deliverable; label: string; value: boolean; required?: boolean }[] = [
    { key: "safe_zone_ok", label: "Safe-zone clear", value: d.safe_zone_ok },
    { key: "duration_ok", label: "Duration in range", value: d.duration_ok },
    {
      key: "captions_burned",
      label: "Captions burned in",
      value: d.captions_burned,
      required: captionsRequired,
    },
    { key: "audio_ok", label: "Audio present & AAC", value: d.audio_ok },
    { key: "resolution_ok", label: "Exported at 1080p", value: d.resolution_ok },
  ];
  const passed = checks.filter((c) => c.value).length;
  const allPass = passed === checks.length;

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      const path = await uploadCampaignFile(uid, cut.brief_id, file);
      onFileUploaded(path);
      toast.success("File uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border border-foreground rounded-[2px] bg-card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-foreground text-background rounded-[2px]">
              {spec?.label ?? d.placement ?? "—"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-foreground rounded-[2px]">
              {d.aspect_ratio ?? "—"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-foreground rounded-[2px]">
              {d.resolution ?? spec?.resolution ?? "—"}
            </span>
            {d.upload_ready && (
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[var(--color-rec)] text-background rounded-[2px]">
                Upload-ready
              </span>
            )}
          </div>
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-[var(--color-rec)]"
            aria-label="Delete"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="font-mono text-xs break-all">{d.filename ?? "—"}</p>
      </div>

      <div className="p-4 grid md:grid-cols-2 gap-4">
        {/* Safe-zone preview */}
        <div>
          <p className="label-mono mb-2">Safe-zone</p>
          {spec ? (
            <SafeZonePreview spec={spec} />
          ) : (
            <div className="h-40 border border-dashed border-foreground rounded-[2px]" />
          )}
          {spec && (
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              {spec.safeNote}
            </p>
          )}
        </div>

        {/* Checklist */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label-mono">Compliance</p>
            <p className="font-mono text-[11px]">
              {passed}/{checks.length}
            </p>
          </div>
          <Progress value={(passed / checks.length) * 100} className="h-1.5 mb-3" />
          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.key as string} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={c.value}
                  onCheckedChange={(v) =>
                    onPatch({ [c.key]: !!v } as Partial<Deliverable>)
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <span className={cn(c.value && "line-through text-muted-foreground")}>
                    {c.label}
                  </span>
                  {c.required && !c.value && (
                    <span className="ml-1 font-mono text-[10px] text-[var(--color-rec)] uppercase">
                      required
                    </span>
                  )}
                  {c.key === "duration_ok" && spec && (
                    <p className="text-[11px] text-muted-foreground">
                      {durationLabel}
                      {!durationOkAuto && dur > 0 && (
                        <span className="ml-1 text-[var(--color-rec)]">
                          · out of range
                        </span>
                      )}
                    </p>
                  )}
                  {c.key === "safe_zone_ok" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-[11px] text-muted-foreground hover:underline">
                          What's the safe zone?
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-xs max-w-xs">
                        {spec?.safeNote ?? "Keep text and logos away from UI overlays."}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* File slot */}
      <div className="p-4 border-t border-border space-y-2">
        <p className="label-mono">Rendered export</p>
        {signedUrl ? (
          <div className="space-y-2">
            <video
              src={signedUrl}
              controls
              className="w-full max-h-56 bg-black rounded-[2px]"
            />
            <div className="flex items-center gap-2">
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="label-mono text-[var(--color-rec)] hover:underline"
              >
                <Download className="h-3 w-3 inline" /> Open file
              </a>
              <button
                onClick={() => onPatch({ file_url: null })}
                className="label-mono text-muted-foreground hover:text-foreground ml-auto"
              >
                Remove
              </button>
            </div>
          </div>
        ) : d.file_url?.startsWith("http") ? (
          <div className="flex items-center justify-between gap-2">
            <a
              href={d.file_url}
              target="_blank"
              rel="noreferrer"
              className="label-mono text-[var(--color-rec)] hover:underline truncate"
            >
              {d.file_url}
            </a>
            <button
              onClick={() => onPatch({ file_url: null })}
              className="label-mono text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer">
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={uploading}
              >
                <span>
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Upload render
                </span>
              </Button>
              <input
                type="file"
                accept="video/mp4,video/quicktime"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUrlOpen((v) => !v)}
            >
              Paste URL
            </Button>
            {urlOpen && (
              <div className="flex items-center gap-2 w-full">
                <Input
                  value={urlVal}
                  placeholder="https://…"
                  onChange={(e) => setUrlVal(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (urlVal.trim()) {
                      onPatch({ file_url: urlVal.trim() });
                      setUrlVal("");
                      setUrlOpen(false);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
          <FileText className="h-3.5 w-3.5" /> Spec sheet
        </Button>
        <label
          className={cn(
            "flex items-center gap-2 label-mono cursor-pointer",
            !allPass && "opacity-50 cursor-not-allowed",
          )}
          title={!allPass ? "All compliance checks must pass" : undefined}
        >
          <Switch
            checked={d.upload_ready}
            disabled={!allPass}
            onCheckedChange={(v) =>
              onPatch({
                upload_ready: !!v,
                status: v ? "approved" : "draft",
              })
            }
          />
          Upload-ready
        </label>
      </div>

      <SpecSheetDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        cut={cut}
        deliverable={d}
      />
    </div>
  );
}

// ---------- Safe-zone preview ----------
function SafeZonePreview({ spec }: { spec: PlacementSpec }) {
  // Keep visual scale modest: width fixed, height by aspect.
  const w = 140;
  const h = Math.round((w * spec.height) / spec.width);
  const topPx = (spec.safe.top / 100) * h;
  const bottomPx = (spec.safe.bottom / 100) * h;
  const sidePx = (spec.safe.side / 100) * w;
  return (
    <div className="flex items-center justify-center">
      <div
        className="relative bg-muted rounded-[2px] border border-foreground overflow-hidden"
        style={{ width: w, height: h }}
      >
        <div
          className="absolute inset-x-0 top-0 bg-[var(--color-rec)]/25"
          style={{ height: topPx }}
        />
        <div
          className="absolute inset-x-0 bottom-0 bg-[var(--color-rec)]/25"
          style={{ height: bottomPx }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-[var(--color-rec)]/15"
          style={{ width: sidePx }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-[var(--color-rec)]/15"
          style={{ width: sidePx }}
        />
        <div
          className="absolute border border-dashed border-foreground"
          style={{
            top: topPx,
            bottom: bottomPx,
            left: sidePx,
            right: sidePx,
          }}
        />
        <p className="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-foreground/70">
          {spec.aspect}
        </p>
      </div>
    </div>
  );
}

// ---------- Spec sheets ----------
function buildSpecText(cut: CutRow, d: Deliverable): string {
  const spec = d.placement ? SPECS[d.placement] : null;
  const brand = cut.brief?.brand?.name ?? "—";
  const project = cut.brief?.project_name ?? "—";
  const lines = [
    `EXPORT SPEC SHEET`,
    `Brand:        ${brand}`,
    `Project:      ${project}`,
    `Cut:          ${cut.name}  (v${cut.version ?? 1})`,
    `Source ref:   cut_id=${cut.id}`,
    ``,
    `Placement:    ${spec?.label ?? d.placement ?? "—"}`,
    `Aspect ratio: ${d.aspect_ratio ?? "—"}`,
    `Resolution:   ${d.resolution ?? spec?.resolution ?? "—"} (export at full 1080p)`,
    `Duration:     ${d.duration_seconds?.toFixed?.(1) ?? "—"}s  (target ${
      spec ? `${spec.durationMin}–${spec.durationMax}s` : "—"
    })`,
    `Duration note: ${spec?.durationNote ?? "—"}`,
    ``,
    `Safe zone:`,
    `  Top:    ${spec?.safe.top ?? "—"}%`,
    `  Bottom: ${spec?.safe.bottom ?? "—"}%`,
    `  Sides:  ${spec?.safe.side ?? "—"}%`,
    `  Note:   ${spec?.safeNote ?? "—"}`,
    ``,
    `File requirements:`,
    `  Container:   ${FILE_SPEC.container}`,
    `  Video codec: ${FILE_SPEC.codec}`,
    `  Audio:       ${FILE_SPEC.audio}`,
    `  Resolution:  ${FILE_SPEC.resolution}`,
    `  Framerate:   ${FILE_SPEC.framerate}`,
    `  Max size:    ${FILE_SPEC.maxSize}`,
    ``,
    `Filename:     ${d.filename ?? "—"}`,
    ``,
    `Note: Meta's delivery system treats creative quality/resolution as a`,
    `ranking signal. A low-res render loses the auction. Export at 1080p.`,
  ];
  return lines.join("\n");
}

function SpecSheetDialog({
  open,
  onOpenChange,
  cut,
  deliverable,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cut: CutRow;
  deliverable: Deliverable;
}) {
  const text = useMemo(() => buildSpecText(cut, deliverable), [cut, deliverable]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export spec · {deliverable.filename}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={text}
          readOnly
          rows={22}
          className="font-mono text-xs"
        />
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(text);
              toast.success("Spec copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button size="sm" onClick={() => downloadText(text, `${deliverable.filename ?? "spec"}.txt`)}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllSpecSheetDialog({
  open,
  onOpenChange,
  cut,
  deliverables,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cut: CutRow;
  deliverables: Deliverable[];
}) {
  const text = useMemo(() => {
    return deliverables
      .map((d) => buildSpecText(cut, d))
      .join("\n\n────────────────────────────\n\n");
  }, [cut, deliverables]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Spec sheet · {cut.name} v{cut.version ?? 1}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={text}
          readOnly
          rows={26}
          className="font-mono text-xs"
        />
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(text);
              toast.success("Spec sheet copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy all
          </Button>
          <Button
            size="sm"
            onClick={() =>
              downloadText(text, `${slug(cut.name)}-v${cut.version ?? 1}-spec.txt`)
            }
          >
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
