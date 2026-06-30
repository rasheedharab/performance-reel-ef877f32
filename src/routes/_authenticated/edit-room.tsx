import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  Download,
  Film,
  Loader2,
  Music,
  Package,
  Plus,
  Repeat,
  Search,
  Shuffle,
  Trash2,
  Volume2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getCampaignSignedUrls } from "@/lib/campaign-assets";

const searchSchema = z.object({
  brief: z.string().optional(),
  cut: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/edit-room")({
  validateSearch: searchSchema,
  component: EditRoom,
});

type BriefLite = {
  id: string;
  project_name: string | null;
  status: string | null;
  captions_required: boolean | null;
  brand: { id: string; name: string } | null;
};

type ScriptLite = {
  id: string;
  archetype: string | null;
  hook: string | null;
  vo_script: string | null;
  target_duration: number | null;
};

type ShotLite = {
  id: string;
  shot_number: number | null;
  visual_description: string | null;
  caption_text: string | null;
  duration_seconds: number | null;
};

type AssetLite = {
  id: string;
  shot_id: string | null;
  brief_id: string | null;
  type: "clip" | "voiceover" | "music" | "sfx";
  status: string;
  version: number | null;
  file_url: string | null;
  duration_seconds: number | null;
  voice_id: string | null;
  tool_used: string | null;
  is_selected: boolean;
};

type CutRow = {
  id: string;
  brief_id: string;
  script_id: string | null;
  name: string;
  version: number | null;
  status: string | null;
  total_duration: number | null;
  music_asset_url: string | null;
  vo_asset_url: string | null;
  hook_timing_ok: boolean;
  captions_added: boolean;
  cta_added: boolean;
  brand_frames_ok: boolean;
  color_consistent: boolean;
  export_ready: boolean;
  edit_notes: string | null;
  created_at: string;
};

type CutShotRow = {
  id: string;
  cut_id: string;
  shot_id: string | null;
  asset_id: string | null;
  sequence_order: number;
  transition_note: string | null;
  trim_note: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  approved: "bg-emerald-600/10 text-emerald-700 border-emerald-600/40",
  archived: "bg-background text-muted-foreground border-border opacity-70",
};

function StatusChip({ status }: { status: string | null }) {
  const s = status ?? "draft";
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
        STATUS_STYLE[s] ?? STATUS_STYLE.draft,
      )}
    >
      {s}
    </span>
  );
}

function isHttpUrl(s: string | null | undefined) {
  return !!s && /^https?:\/\//i.test(s);
}

function fmtTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function EditRoom() {
  const { brief: briefParam, cut: cutParam } = Route.useSearch();
  return cutParam ? (
    <CutEditor cutId={cutParam} briefParam={briefParam ?? null} />
  ) : (
    <BriefAndCuts briefParam={briefParam ?? null} />
  );
}

// ===========================================================================
// Brief selector + cuts list
// ===========================================================================

function BriefAndCuts({ briefParam }: { briefParam: string | null }) {
  const navigate = useNavigate({ from: Route.fullPath });
  const [briefs, setBriefs] = useState<BriefLite[] | null>(null);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<BriefLite | null>(null);
  const [cuts, setCuts] = useState<CutRow[] | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("briefs")
        .select("id, project_name, status, captions_required, brand:brands(id, name)")
        .order("created_at", { ascending: false });
      setBriefs((data as unknown as BriefLite[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!briefParam) {
      setSelected(null);
      setCuts(null);
      return;
    }
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("briefs")
        .select("id, project_name, status, captions_required, brand:brands(id, name)")
        .eq("id", briefParam)
        .maybeSingle();
      if (!alive) return;
      setSelected((data as unknown as BriefLite) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [briefParam]);

  const reloadCuts = async () => {
    if (!selected) return;
    const { data } = await supabase
      .from("cuts")
      .select(
        "id, brief_id, script_id, name, version, status, total_duration, music_asset_url, vo_asset_url, hook_timing_ok, captions_added, cta_added, brand_frames_ok, color_consistent, export_ready, edit_notes, created_at",
      )
      .eq("brief_id", selected.id)
      .order("created_at", { ascending: false });
    setCuts((data as unknown as CutRow[]) ?? []);
  };

  useEffect(() => {
    void reloadCuts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const filtered = useMemo(() => {
    if (!briefs) return [];
    const q = search.trim().toLowerCase();
    if (!q) return briefs;
    return briefs.filter(
      (b) =>
        (b.project_name ?? "").toLowerCase().includes(q) ||
        (b.brand?.name ?? "").toLowerCase().includes(q),
    );
  }, [briefs, search]);

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="label-mono mb-2">Phase 05 · Edit room</p>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
          Edit Room
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-xl">
          Assemble cuts from selected takes and prep the finishing pass.
        </p>
      </div>

      {/* Brief selector */}
      <div className="border border-border rounded-[3px] bg-card p-4 mb-6 flex flex-wrap items-center gap-4">
        <span className="label-mono">Brief</span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex-1 min-w-[320px] flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 rounded-[3px] text-sm hover:border-foreground/40 transition-colors"
            >
              {selected ? (
                <span className="flex items-center gap-2 truncate">
                  <span className="text-muted-foreground truncate">
                    {selected.brand?.name ?? "—"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium truncate">
                    {selected.project_name ?? "Untitled brief"}
                  </span>
                  <StatusChip status={selected.status} />
                </span>
              ) : (
                <span className="text-muted-foreground">Select a brief…</span>
              )}
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[520px] p-0" align="start">
            <div className="p-2 border-b border-border">
              <Input
                autoFocus
                placeholder="Search briefs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No briefs match.
                </div>
              ) : (
                filtered.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      navigate({ search: { brief: b.id } });
                      setPickerOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-background/60 border-b border-border/60 last:border-b-0 flex items-center gap-2"
                  >
                    <span className="text-sm flex-1 truncate">
                      <span className="text-muted-foreground">
                        {b.brand?.name ?? "—"}
                      </span>{" "}
                      ·{" "}
                      <span className="font-medium">
                        {b.project_name ?? "Untitled"}
                      </span>
                    </span>
                    <StatusChip status={b.status} />
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          onClick={() => setNewOpen(true)}
          disabled={!selected}
        >
          <Plus className="h-3.5 w-3.5" /> New cut
        </Button>
      </div>

      {!selected ? (
        <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
          <p className="label-mono mb-3">No brief selected</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Pick a brief above to start assembling cuts.
          </p>
        </div>
      ) : cuts === null ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : cuts.length === 0 ? (
        <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
          <p className="label-mono mb-3">No cuts yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Start a new cut from one of this brief's scripts.
          </p>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New cut
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {cuts.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate({ search: { brief: selected.id, cut: c.id } })}
              className="w-full text-left border border-border bg-card rounded-[3px] p-4 hover:border-foreground/40 transition-colors flex items-center gap-4"
            >
              <div className="shrink-0 w-12 h-12 border border-foreground rounded-[2px] flex flex-col items-center justify-center bg-foreground text-background">
                <span className="font-mono text-[9px] uppercase opacity-70">Cut</span>
                <span className="font-mono text-xs font-bold leading-none">
                  v{c.version ?? 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-display text-lg font-bold truncate">
                    {c.name}
                  </span>
                  <StatusChip status={c.status} />
                  {c.export_ready && (
                    <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[var(--color-rec)] text-[var(--color-rec)] rounded-[2px]">
                      Export-ready
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {c.total_duration ? `${Number(c.total_duration).toFixed(1)}s` : "—"}
                  </span>
                  <span>·</span>
                  <span>
                    {new Date(c.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      {newOpen && selected && (
        <NewCutDialog
          brief={selected}
          onClose={() => setNewOpen(false)}
          onCreated={(cutId) => {
            setNewOpen(false);
            navigate({ search: { brief: selected.id, cut: cutId } });
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// New cut dialog
// ===========================================================================

function NewCutDialog({
  brief,
  onClose,
  onCreated,
}: {
  brief: BriefLite;
  onClose: () => void;
  onCreated: (cutId: string) => void;
}) {
  const [scripts, setScripts] = useState<ScriptLite[] | null>(null);
  const [scriptId, setScriptId] = useState<string>("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: angles } = await supabase
        .from("angles")
        .select("id")
        .eq("brief_id", brief.id);
      const angleIds = (angles ?? []).map((a) => a.id);
      if (angleIds.length === 0) {
        setScripts([]);
        return;
      }
      const { data } = await supabase
        .from("scripts")
        .select("id, archetype, hook, vo_script, target_duration")
        .in("angle_id", angleIds)
        .order("created_at", { ascending: false });
      setScripts((data as unknown as ScriptLite[]) ?? []);
    })();
  }, [brief.id]);

  const create = async () => {
    if (!scriptId) {
      toast.error("Pick a script");
      return;
    }
    if (!name.trim()) {
      toast.error("Name the cut");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      // Insert cut
      const { data: cut, error } = await supabase
        .from("cuts")
        .insert({
          user_id: userId,
          brief_id: brief.id,
          script_id: scriptId,
          name: name.trim(),
          version: Number(version) || 1,
          status: "draft",
        })
        .select("id")
        .single();
      if (error || !cut) throw error ?? new Error("Insert failed");

      // Auto-populate timeline from selected takes
      const { data: shots } = await supabase
        .from("shots")
        .select("id, shot_number, duration_seconds")
        .eq("script_id", scriptId)
        .order("shot_number", { ascending: true })
        .order("created_at", { ascending: true });
      const shotRows = (shots ?? []) as { id: string; shot_number: number | null; duration_seconds: number | null }[];

      let skipped = 0;
      let total = 0;
      const cutShots: Array<{
        cut_id: string;
        shot_id: string;
        asset_id: string | null;
        sequence_order: number;
      }> = [];
      if (shotRows.length > 0) {
        const shotIds = shotRows.map((s) => s.id);
        const { data: takes } = await supabase
          .from("assets")
          .select("id, shot_id, duration_seconds")
          .in("shot_id", shotIds)
          .eq("is_selected", true);
        const byShot = new Map<string, { id: string; duration_seconds: number | null }>();
        for (const t of (takes ?? []) as { id: string; shot_id: string; duration_seconds: number | null }[]) {
          byShot.set(t.shot_id, { id: t.id, duration_seconds: t.duration_seconds });
        }
        shotRows.forEach((sh, i) => {
          const take = byShot.get(sh.id);
          if (!take) skipped += 1;
          else total += Number(take.duration_seconds ?? sh.duration_seconds ?? 0);
          cutShots.push({
            cut_id: cut.id,
            shot_id: sh.id,
            asset_id: take?.id ?? null,
            sequence_order: i,
          });
        });
        if (cutShots.length > 0) {
          await supabase.from("cut_shots").insert(cutShots);
        }
      }

      // Auto-attach VO and music defaults: first VO/music for this brief
      const { data: audio } = await supabase
        .from("assets")
        .select("id, type, file_url")
        .eq("brief_id", brief.id)
        .is("shot_id", null)
        .in("type", ["voiceover", "music"]);
      let voUrl: string | null = null;
      let musicUrl: string | null = null;
      for (const a of (audio ?? []) as { type: string; file_url: string | null }[]) {
        if (a.type === "voiceover" && !voUrl) voUrl = a.file_url;
        if (a.type === "music" && !musicUrl) musicUrl = a.file_url;
      }

      await supabase
        .from("cuts")
        .update({
          total_duration: total > 0 ? total : null,
          vo_asset_url: voUrl,
          music_asset_url: musicUrl,
          captions_added: brief.captions_required ? false : false,
        })
        .eq("id", cut.id);

      if (skipped > 0) {
        toast.warning(`Cut created · ${skipped} shot(s) had no selected take`);
      } else {
        toast.success("Cut created");
      }
      onCreated(cut.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">New cut</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="label-mono mb-1">Based on script</p>
            {scripts === null ? (
              <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading scripts…
              </div>
            ) : scripts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                This brief has no scripts yet.
              </p>
            ) : (
              <Select value={scriptId} onValueChange={setScriptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a script…" />
                </SelectTrigger>
                <SelectContent>
                  {scripts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-mono text-[10px] uppercase mr-2 text-muted-foreground">
                        {s.archetype ?? "—"}
                      </span>
                      {s.hook?.split("\n")[0] || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2">
              <p className="label-mono mb-1">Cut name</p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Master 9:16"
              />
            </div>
            <div>
              <p className="label-mono mb-1">Version</p>
              <Input
                type="number"
                min={1}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            We'll auto-populate the timeline from each shot's selected take.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={create} disabled={busy || !scripts?.length}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Cut editor — timeline + finishing checklist
// ===========================================================================

type Row = CutShotRow & {
  shot: ShotLite | null;
  asset: AssetLite | null;
};

function CutEditor({ cutId, briefParam }: { cutId: string; briefParam: string | null }) {
  const navigate = useNavigate({ from: Route.fullPath });
  const [cut, setCut] = useState<CutRow | null>(null);
  const [brief, setBrief] = useState<BriefLite | null>(null);
  const [script, setScript] = useState<ScriptLite | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [briefAssets, setBriefAssets] = useState<AssetLite[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<Row | null>(null);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const loadAll = async () => {
    const { data: c } = await supabase
      .from("cuts")
      .select(
        "id, brief_id, script_id, name, version, status, total_duration, music_asset_url, vo_asset_url, hook_timing_ok, captions_added, cta_added, brand_frames_ok, color_consistent, export_ready, edit_notes, created_at",
      )
      .eq("id", cutId)
      .maybeSingle();
    const cutRow = (c as unknown as CutRow) ?? null;
    setCut(cutRow);
    if (!cutRow) return;

    const [briefRes, scriptRes, csRes, briefAssetsRes] = await Promise.all([
      supabase
        .from("briefs")
        .select("id, project_name, status, captions_required, brand:brands(id, name)")
        .eq("id", cutRow.brief_id)
        .maybeSingle(),
      cutRow.script_id
        ? supabase
            .from("scripts")
            .select("id, archetype, hook, vo_script, target_duration")
            .eq("id", cutRow.script_id)
            .maybeSingle()
        : Promise.resolve({ data: null } as { data: ScriptLite | null }),
      supabase
        .from("cut_shots")
        .select("id, cut_id, shot_id, asset_id, sequence_order, transition_note, trim_note")
        .eq("cut_id", cutId)
        .order("sequence_order", { ascending: true }),
      supabase
        .from("assets")
        .select("id, shot_id, brief_id, type, status, version, file_url, duration_seconds, voice_id, tool_used, is_selected")
        .eq("brief_id", cutRow.brief_id)
        .is("shot_id", null),
    ]);

    setBrief((briefRes.data as unknown as BriefLite) ?? null);
    setScript((scriptRes.data as unknown as ScriptLite) ?? null);
    setBriefAssets((briefAssetsRes.data as unknown as AssetLite[]) ?? []);

    const csRows = (csRes.data as unknown as CutShotRow[]) ?? [];
    const shotIds = csRows.map((r) => r.shot_id).filter((x): x is string => !!x);
    const assetIds = csRows.map((r) => r.asset_id).filter((x): x is string => !!x);
    const [shotsRes, assetsRes] = await Promise.all([
      shotIds.length > 0
        ? supabase
            .from("shots")
            .select("id, shot_number, visual_description, caption_text, duration_seconds")
            .in("id", shotIds)
        : Promise.resolve({ data: [] }),
      assetIds.length > 0
        ? supabase
            .from("assets")
            .select("id, shot_id, brief_id, type, status, version, file_url, duration_seconds, voice_id, tool_used, is_selected")
            .in("id", assetIds)
        : Promise.resolve({ data: [] }),
    ]);
    const shotMap = new Map<string, ShotLite>();
    for (const s of (shotsRes.data as unknown as ShotLite[]) ?? []) shotMap.set(s.id, s);
    const assetMap = new Map<string, AssetLite>();
    for (const a of (assetsRes.data as unknown as AssetLite[]) ?? []) assetMap.set(a.id, a);

    const merged: Row[] = csRows.map((r) => ({
      ...r,
      shot: r.shot_id ? shotMap.get(r.shot_id) ?? null : null,
      asset: r.asset_id ? assetMap.get(r.asset_id) ?? null : null,
    }));
    setRows(merged);
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutId]);

  // Signed URLs
  useEffect(() => {
    if (!rows && !cut) return;
    const paths = new Set<string>();
    rows?.forEach((r) => {
      if (r.asset?.file_url && !isHttpUrl(r.asset.file_url)) paths.add(r.asset.file_url);
    });
    if (cut?.vo_asset_url && !isHttpUrl(cut.vo_asset_url)) paths.add(cut.vo_asset_url);
    if (cut?.music_asset_url && !isHttpUrl(cut.music_asset_url)) paths.add(cut.music_asset_url);
    for (const a of briefAssets) {
      if (a.file_url && !isHttpUrl(a.file_url)) paths.add(a.file_url);
    }
    const needed = Array.from(paths).filter((p) => !signedUrls[p]);
    if (needed.length === 0) return;
    void (async () => {
      const next = await getCampaignSignedUrls(needed);
      setSignedUrls((prev) => ({ ...prev, ...next }));
    })();
  }, [rows, cut, briefAssets, signedUrls]);

  const totalDuration = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce(
      (sum, r) => sum + Number(r.asset?.duration_seconds ?? r.shot?.duration_seconds ?? 0),
      0,
    );
  }, [rows]);

  // Persist total_duration when it changes
  useEffect(() => {
    if (!cut || rows === null) return;
    if (Number(cut.total_duration ?? 0) === totalDuration) return;
    void supabase.from("cuts").update({ total_duration: totalDuration }).eq("id", cut.id);
  }, [totalDuration, cut, rows]);

  const setRow = async (rowId: string, patch: Partial<CutShotRow>) => {
    setRows((prev) => prev?.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) ?? null);
    await supabase.from("cut_shots").update(patch).eq("id", rowId);
  };

  const move = async (rowId: string, dir: -1 | 1) => {
    if (!rows) return;
    const idx = rows.findIndex((r) => r.id === rowId);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= rows.length) return;
    const next = [...rows];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const renumbered = next.map((r, i) => ({ ...r, sequence_order: i }));
    setRows(renumbered);
    await Promise.all(
      renumbered.map((r) =>
        supabase.from("cut_shots").update({ sequence_order: r.sequence_order }).eq("id", r.id),
      ),
    );
  };

  const removeRow = async (rowId: string) => {
    if (!rows) return;
    await supabase.from("cut_shots").delete().eq("id", rowId);
    const next = rows.filter((r) => r.id !== rowId).map((r, i) => ({ ...r, sequence_order: i }));
    setRows(next);
    await Promise.all(
      next.map((r) =>
        supabase.from("cut_shots").update({ sequence_order: r.sequence_order }).eq("id", r.id),
      ),
    );
  };

  const swapTake = async (row: Row, newAssetId: string) => {
    await setRow(row.id, { asset_id: newAssetId });
    // refresh asset details for that row
    const { data: a } = await supabase
      .from("assets")
      .select("id, shot_id, brief_id, type, status, version, file_url, duration_seconds, voice_id, tool_used, is_selected")
      .eq("id", newAssetId)
      .maybeSingle();
    if (a) {
      setRows((prev) =>
        prev?.map((r) => (r.id === row.id ? { ...r, asset: a as unknown as AssetLite } : r)) ?? null,
      );
    }
    setSwapFor(null);
  };

  const setChecklist = async (patch: Partial<CutRow>) => {
    if (!cut) return;
    setSavingChecklist(true);
    setCut({ ...cut, ...patch });
    await supabase.from("cuts").update(patch).eq("id", cut.id);
    setSavingChecklist(false);
  };

  const setAudio = async (kind: "vo" | "music", url: string | null) => {
    if (!cut) return;
    const patch = kind === "vo" ? { vo_asset_url: url } : { music_asset_url: url };
    setCut({ ...cut, ...patch });
    await supabase.from("cuts").update(patch).eq("id", cut.id);
  };

  const checklistItems = useMemo(() => {
    if (!cut) return [];
    return [
      { key: "hook_timing_ok" as const, label: "Hook lands in first 3s", value: cut.hook_timing_ok, required: false },
      {
        key: "captions_added" as const,
        label: "Burned-in captions added",
        value: cut.captions_added,
        required: !!brief?.captions_required,
      },
      { key: "cta_added" as const, label: "Clear CTA on the end frame", value: cut.cta_added, required: false },
      { key: "brand_frames_ok" as const, label: "Brand frames / logo present", value: cut.brand_frames_ok, required: false },
      { key: "color_consistent" as const, label: "Color / consistency pass", value: cut.color_consistent, required: false },
    ];
  }, [cut, brief]);

  const completionPct = useMemo(() => {
    if (checklistItems.length === 0) return 0;
    const done = checklistItems.filter((c) => c.value).length;
    return Math.round((done / checklistItems.length) * 100);
  }, [checklistItems]);

  const canExportReady = useMemo(() => {
    if (!cut) return false;
    // All required items pass + at least one row with an asset
    const requiredOk = checklistItems.every((c) => !c.required || c.value);
    const hasAtLeastOneTake = (rows ?? []).some((r) => r.asset_id);
    return requiredOk && hasAtLeastOneTake;
  }, [cut, checklistItems, rows]);

  const markExportReady = async () => {
    if (!cut) return;
    await supabase
      .from("cuts")
      .update({ export_ready: true, status: "approved" })
      .eq("id", cut.id);
    setCut({ ...cut, export_ready: true, status: "approved" });
    toast.success("Marked export-ready");
  };

  const duplicate = async () => {
    if (!cut || !rows) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: newCut, error } = await supabase
      .from("cuts")
      .insert({
        user_id: userId,
        brief_id: cut.brief_id,
        script_id: cut.script_id,
        name: cut.name,
        version: (cut.version ?? 1) + 1,
        status: "draft",
        vo_asset_url: cut.vo_asset_url,
        music_asset_url: cut.music_asset_url,
      })
      .select("id")
      .single();
    if (error || !newCut) {
      toast.error(error?.message ?? "Failed");
      return;
    }
    const clones = rows.map((r) => ({
      cut_id: newCut.id,
      shot_id: r.shot_id,
      asset_id: r.asset_id,
      sequence_order: r.sequence_order,
      transition_note: r.transition_note,
      trim_note: r.trim_note,
    }));
    if (clones.length > 0) await supabase.from("cut_shots").insert(clones);
    toast.success(`Duplicated as v${(cut.version ?? 1) + 1}`);
    navigate({ search: { brief: cut.brief_id, cut: newCut.id } });
  };

  if (!cut) {
    return (
      <div className="px-4 sm:px-8 py-12 sm:py-20 text-center">
        <Loader2 className="h-5 w-5 animate-spin inline-block text-muted-foreground" />
      </div>
    );
  }

  const voiceovers = briefAssets.filter((a) => a.type === "voiceover");
  const musics = briefAssets.filter((a) => a.type === "music");

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/edit-room"
          search={{ brief: cut.brief_id }}
          className="inline-flex items-center gap-1.5 label-mono text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3 w-3" /> Back to cuts
        </Link>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="label-mono mb-1">
              {brief?.brand?.name ?? "—"} · {brief?.project_name ?? "—"}
              {script?.archetype && <> · {script.archetype}</>}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
              {cut.name}
              <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 border border-foreground rounded-[2px]">
                v{cut.version ?? 1}
              </span>
              <StatusChip status={cut.status} />
              {cut.export_ready && (
                <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[var(--color-rec)] text-[var(--color-rec)] rounded-[2px]">
                  Export-ready
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={duplicate}>
              <Copy className="h-3.5 w-3.5" /> Duplicate as new version
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download className="h-3.5 w-3.5" /> Export shot manifest
            </Button>
            <Button
              size="sm"
              onClick={() =>
                navigate({ to: "/deliverables", search: { cut: cut.id } })
              }
            >
              <Package className="h-3.5 w-3.5" /> Build deliverables →
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <p className="label-mono">Timeline</p>
            <p className="font-mono text-xs text-muted-foreground">
              Total {totalDuration.toFixed(1)}s
              {script?.target_duration ? (
                <span className="ml-1">
                  / target {script.target_duration}s
                </span>
              ) : null}
            </p>
          </div>

          {(rows ?? []).length === 0 ? (
            <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-12 text-center">
              <p className="label-mono mb-2">Timeline is empty</p>
              <p className="text-sm text-muted-foreground">
                Add shots from the script's storyboard.
              </p>
            </div>
          ) : (
            <ol className="space-y-2">
              {(() => {
                let cumulative = 0;
                return rows!.map((r, idx) => {
                  const dur = Number(r.asset?.duration_seconds ?? r.shot?.duration_seconds ?? 0);
                  const inTc = cumulative;
                  cumulative += dur;
                  const outTc = cumulative;
                  const url = r.asset?.file_url
                    ? isHttpUrl(r.asset.file_url)
                      ? r.asset.file_url
                      : signedUrls[r.asset.file_url] ?? null
                    : null;
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "border rounded-[3px] bg-card p-3 flex gap-3",
                        r.asset_id ? "border-border" : "border-[var(--color-rec)]/40",
                      )}
                    >
                      {/* Sequence + reorder */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="w-10 h-10 border border-foreground rounded-[2px] flex flex-col items-center justify-center bg-foreground text-background">
                          <span className="font-mono text-[8px] uppercase opacity-70">Seq</span>
                          <span className="font-mono text-xs font-bold leading-none">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => move(r.id, -1)}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(r.id, 1)}
                          disabled={idx === rows!.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Thumb */}
                      <div className="w-32 shrink-0 aspect-video bg-muted/40 rounded-[2px] overflow-hidden flex items-center justify-center">
                        {url ? (
                          <video
                            src={url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <Film className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm leading-snug line-clamp-2">
                              <span className="font-mono text-[10px] uppercase text-muted-foreground mr-1.5">
                                Shot {r.shot?.shot_number ?? "—"}
                              </span>
                              {r.shot?.visual_description || (
                                <span className="text-muted-foreground italic">
                                  No visual description
                                </span>
                              )}
                            </p>
                            {r.shot?.caption_text && (
                              <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-foreground/70 border-l-2 border-foreground pl-2">
                                ❝ {r.shot.caption_text}
                              </p>
                            )}
                            {!r.asset_id && (
                              <p className="mt-1 text-[11px] text-[var(--color-rec)] font-mono uppercase tracking-wider">
                                ⚠ No take selected for this shot
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {fmtTimecode(inTc)} → {fmtTimecode(outTc)} · {dur.toFixed(1)}s
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSwapFor(r)}
                              title="Swap take"
                            >
                              <Shuffle className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeRow(r.id)}
                              title="Remove from cut"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Transition note (e.g. hard cut, whip pan)"
                            value={r.transition_note ?? ""}
                            onChange={(e) =>
                              setRows(
                                (prev) =>
                                  prev?.map((x) =>
                                    x.id === r.id ? { ...x, transition_note: e.target.value } : x,
                                  ) ?? null,
                              )
                            }
                            onBlur={(e) =>
                              setRow(r.id, { transition_note: e.target.value || null })
                            }
                            className="h-8 text-xs"
                          />
                          <Input
                            placeholder="Trim note (e.g. start at 0.5s, hold last frame)"
                            value={r.trim_note ?? ""}
                            onChange={(e) =>
                              setRows(
                                (prev) =>
                                  prev?.map((x) =>
                                    x.id === r.id ? { ...x, trim_note: e.target.value } : x,
                                  ) ?? null,
                              )
                            }
                            onBlur={(e) =>
                              setRow(r.id, { trim_note: e.target.value || null })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </li>
                  );
                });
              })()}
            </ol>
          )}

          {/* Audio slots */}
          <div className="border border-border bg-card rounded-[3px] p-4 space-y-3">
            <p className="label-mono">Audio bed</p>
            <div className="grid md:grid-cols-2 gap-3">
              <AudioSlot
                label="Voiceover"
                icon={<Volume2 className="h-3 w-3" />}
                options={voiceovers}
                value={cut.vo_asset_url}
                signedUrls={signedUrls}
                onChange={(url) => setAudio("vo", url)}
              />
              <AudioSlot
                label="Music"
                icon={<Music className="h-3 w-3" />}
                options={musics}
                value={cut.music_asset_url}
                signedUrls={signedUrls}
                onChange={(url) => setAudio("music", url)}
              />
            </div>
          </div>
        </section>

        {/* Finishing checklist */}
        <aside className="space-y-4">
          <div className="border border-border bg-card rounded-[3px] p-4 sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <p className="label-mono">Finishing checklist</p>
              {savingChecklist && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Completion
                </span>
                <span className="font-mono text-xs">{completionPct}%</span>
              </div>
              <Progress value={completionPct} />
            </div>
            <ul className="space-y-2">
              {checklistItems.map((item) => (
                <li key={item.key} className="flex items-start gap-2">
                  <Checkbox
                    id={item.key}
                    checked={item.value}
                    onCheckedChange={(v) =>
                      setChecklist({ [item.key]: !!v } as Partial<CutRow>)
                    }
                    className="mt-0.5"
                  />
                  <label htmlFor={item.key} className="text-sm cursor-pointer flex-1">
                    {item.label}
                    {item.required && (
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-[var(--color-rec)] text-[var(--color-rec)] rounded-[2px]">
                        Required
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-4 border-t border-border">
              {cut.export_ready ? (
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Marked export-ready
                </div>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!canExportReady}
                  onClick={markExportReady}
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark export-ready
                </Button>
              )}
              {!canExportReady && !cut.export_ready && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  All required checks must pass and the timeline must have at least one take.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Swap take dialog */}
      {swapFor && (
        <SwapTakeDialog
          row={swapFor}
          signedUrls={signedUrls}
          onClose={() => setSwapFor(null)}
          onPick={(assetId) => swapTake(swapFor, assetId)}
        />
      )}

      {/* Export manifest */}
      {exportOpen && (
        <ExportManifestDialog
          cut={cut}
          brief={brief}
          script={script}
          rows={rows ?? []}
          signedUrls={signedUrls}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Audio slot
// ===========================================================================

function AudioSlot({
  label,
  icon,
  options,
  value,
  signedUrls,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  options: AssetLite[];
  value: string | null;
  signedUrls: Record<string, string>;
  onChange: (url: string | null) => void;
}) {
  const resolved = value
    ? isHttpUrl(value)
      ? value
      : signedUrls[value] ?? null
    : null;

  return (
    <div className="border border-border rounded-[3px] p-3 bg-background">
      <p className="label-mono inline-flex items-center gap-1.5 mb-2">
        {icon} {label}
      </p>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No {label.toLowerCase()} on this brief yet.
        </p>
      ) : (
        <Select
          value={value ?? "__none"}
          onValueChange={(v) => onChange(v === "__none" ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">— None —</SelectItem>
            {options.map((a) => (
              <SelectItem key={a.id} value={a.file_url ?? ""}>
                {a.voice_id || a.tool_used || `Untitled #${a.id.slice(0, 4)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {resolved && <audio src={resolved} controls className="w-full h-8 mt-2" />}
    </div>
  );
}

// ===========================================================================
// Swap take dialog
// ===========================================================================

function SwapTakeDialog({
  row,
  signedUrls,
  onClose,
  onPick,
}: {
  row: Row;
  signedUrls: Record<string, string>;
  onClose: () => void;
  onPick: (assetId: string) => void;
}) {
  const [takes, setTakes] = useState<AssetLite[] | null>(null);

  useEffect(() => {
    if (!row.shot_id) {
      setTakes([]);
      return;
    }
    const shotId = row.shot_id;
    void (async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, shot_id, brief_id, type, status, version, file_url, duration_seconds, voice_id, tool_used, is_selected")
        .eq("shot_id", shotId)
        .order("version", { ascending: true });
      setTakes((data as unknown as AssetLite[]) ?? []);
    })();
  }, [row.shot_id]);

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Repeat className="h-4 w-4" /> Swap take · Shot {row.shot?.shot_number ?? "—"}
          </DialogTitle>
        </DialogHeader>
        {takes === null ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline-block" />
          </div>
        ) : takes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No takes exist for this shot.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
            {takes.map((a) => {
              const url = a.file_url
                ? isHttpUrl(a.file_url)
                  ? a.file_url
                  : signedUrls[a.file_url] ?? null
                : null;
              const isCurrent = a.id === row.asset_id;
              return (
                <button
                  key={a.id}
                  onClick={() => onPick(a.id)}
                  disabled={isCurrent}
                  className={cn(
                    "border rounded-[3px] overflow-hidden text-left disabled:opacity-50",
                    isCurrent
                      ? "border-[var(--color-rec)] ring-1 ring-[var(--color-rec)]/50"
                      : "border-border hover:border-foreground/40",
                  )}
                >
                  <div className="aspect-video bg-muted/40 flex items-center justify-center">
                    {url ? (
                      <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <Film className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="p-2 text-xs flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      v{a.version ?? 1} · {a.tool_used || "—"}
                    </span>
                    {a.is_selected && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-rec)]">
                        Final
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Export manifest dialog
// ===========================================================================

type ManifestShot = {
  sequence: number;
  shot_number: number | null;
  visual_description: string | null;
  caption_text: string | null;
  duration_seconds: number;
  tc_in: string;
  tc_out: string;
  file_url: string | null;
  transition_note: string | null;
  trim_note: string | null;
};

function buildManifest(
  cut: CutRow,
  brief: BriefLite | null,
  script: ScriptLite | null,
  rows: Row[],
  signedUrls: Record<string, string>,
) {
  let cumulative = 0;
  const shots: ManifestShot[] = rows.map((r, i) => {
    const dur = Number(r.asset?.duration_seconds ?? r.shot?.duration_seconds ?? 0);
    const tcIn = fmtTimecode(cumulative);
    cumulative += dur;
    const tcOut = fmtTimecode(cumulative);
    const raw = r.asset?.file_url ?? null;
    const url = raw ? (isHttpUrl(raw) ? raw : signedUrls[raw] ?? raw) : null;
    return {
      sequence: i + 1,
      shot_number: r.shot?.shot_number ?? null,
      visual_description: r.shot?.visual_description ?? null,
      caption_text: r.shot?.caption_text ?? null,
      duration_seconds: dur,
      tc_in: tcIn,
      tc_out: tcOut,
      file_url: url,
      transition_note: r.transition_note,
      trim_note: r.trim_note,
    };
  });
  const voUrl = cut.vo_asset_url
    ? isHttpUrl(cut.vo_asset_url)
      ? cut.vo_asset_url
      : signedUrls[cut.vo_asset_url] ?? cut.vo_asset_url
    : null;
  const musicUrl = cut.music_asset_url
    ? isHttpUrl(cut.music_asset_url)
      ? cut.music_asset_url
      : signedUrls[cut.music_asset_url] ?? cut.music_asset_url
    : null;
  return {
    cut: {
      id: cut.id,
      name: cut.name,
      version: cut.version,
      total_duration_seconds: cumulative,
      status: cut.status,
      export_ready: cut.export_ready,
    },
    brief: brief
      ? { id: brief.id, project_name: brief.project_name, brand: brief.brand?.name ?? null }
      : null,
    script: script
      ? { id: script.id, archetype: script.archetype, hook: script.hook, vo_script: script.vo_script, target_duration: script.target_duration }
      : null,
    audio: { voiceover_url: voUrl, music_url: musicUrl },
    shots,
  };
}

function manifestToText(m: ReturnType<typeof buildManifest>): string {
  const lines: string[] = [];
  lines.push(`# ${m.cut.name} (v${m.cut.version ?? 1})`);
  if (m.brief) lines.push(`Brief: ${m.brief.brand ?? "—"} · ${m.brief.project_name ?? "—"}`);
  if (m.script?.archetype) lines.push(`Script archetype: ${m.script.archetype}`);
  lines.push(`Total: ${m.cut.total_duration_seconds.toFixed(1)}s`);
  lines.push("");
  if (m.script?.hook) {
    lines.push(`HOOK: ${m.script.hook}`);
    lines.push("");
  }
  if (m.script?.vo_script) {
    lines.push("VO SCRIPT:");
    lines.push(m.script.vo_script);
    lines.push("");
  }
  lines.push("AUDIO:");
  lines.push(`  Voiceover: ${m.audio.voiceover_url ?? "—"}`);
  lines.push(`  Music:     ${m.audio.music_url ?? "—"}`);
  lines.push("");
  lines.push("TIMELINE:");
  for (const s of m.shots) {
    lines.push(
      `  [${String(s.sequence).padStart(2, "0")}] ${s.tc_in}–${s.tc_out} (${s.duration_seconds.toFixed(1)}s)  Shot ${s.shot_number ?? "—"}`,
    );
    if (s.visual_description) lines.push(`       ${s.visual_description}`);
    if (s.caption_text) lines.push(`       CAPTION: ${s.caption_text}`);
    if (s.file_url) lines.push(`       FILE: ${s.file_url}`);
    if (s.transition_note) lines.push(`       TRANSITION: ${s.transition_note}`);
    if (s.trim_note) lines.push(`       TRIM: ${s.trim_note}`);
  }
  return lines.join("\n");
}

function ExportManifestDialog({
  cut,
  brief,
  script,
  rows,
  signedUrls,
  onClose,
}: {
  cut: CutRow;
  brief: BriefLite | null;
  script: ScriptLite | null;
  rows: Row[];
  signedUrls: Record<string, string>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"text" | "json">("text");
  const manifest = useMemo(
    () => buildManifest(cut, brief, script, rows, signedUrls),
    [cut, brief, script, rows, signedUrls],
  );
  const text = useMemo(() => manifestToText(manifest), [manifest]);
  const json = useMemo(() => JSON.stringify(manifest, null, 2), [manifest]);

  const content = tab === "text" ? text : json;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const download = () => {
    const blob = new Blob([content], {
      type: tab === "json" ? "application/json" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = cut.name.replace(/[^a-z0-9.\-_]/gi, "_");
    a.href = url;
    a.download = `${safe}-v${cut.version ?? 1}-manifest.${tab === "json" ? "json" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Export shot manifest</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-1">
          {(["text", "json"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "label-mono px-2 py-1 border rounded-[2px]",
                tab === t
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "text" ? "Readable" : "JSON"}
            </button>
          ))}
        </div>
        <pre className="bg-background border border-border rounded-[3px] p-3 text-xs font-mono max-h-[420px] overflow-auto whitespace-pre-wrap">
          {content}
        </pre>
        <DialogFooter className="!justify-between">
          <Button variant="outline" onClick={onClose}>
            <X className="h-3.5 w-3.5" /> Close
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
            <Button onClick={download}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
