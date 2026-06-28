import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  Check,
  Film,
  Loader2,
  Music,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  Waves,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getCampaignSignedUrls,
  uploadCampaignFile,
} from "@/lib/campaign-assets";

type AssetStatus = "queued" | "generating" | "review" | "approved" | "rejected";
type AssetType = "clip" | "voiceover" | "music" | "sfx";

const TOOLS = [
  "Veo 3.1",
  "Kling 3.0",
  "Runway Gen-4.5",
  "Arcads",
  "HeyGen",
  "Synthesia",
  "Luma Ray3",
  "Manual / Other",
] as const;

const STATUS_STYLE: Record<AssetStatus, string> = {
  queued:
    "bg-muted text-muted-foreground border-border",
  generating:
    "bg-amber-500/10 text-amber-700 border-amber-500/40 animate-pulse",
  review:
    "bg-foreground text-background border-foreground",
  approved:
    "bg-emerald-600/10 text-emerald-700 border-emerald-600/40",
  rejected:
    "bg-[var(--color-rec)]/10 text-[var(--color-rec)]/80 border-[var(--color-rec)]/30",
};

type ScriptLite = {
  id: string;
  archetype: string | null;
  hook: string | null;
  vo_script: string | null;
  target_duration: number | null;
  duration_seconds: number | null;
  angle: {
    id: string;
    title: string | null;
    brief: {
      id: string;
      project_name: string | null;
      brand: { id: string; name: string } | null;
    } | null;
  } | null;
};

type ShotRow = {
  id: string;
  script_id: string;
  shot_number: number | null;
  visual_description: string | null;
  assigned_tool: string | null;
  duration_seconds: number | null;
  generation_method: string | null;
  reference_image_url: string | null;
};

type AssetRow = {
  id: string;
  shot_id: string | null;
  brief_id: string | null;
  type: AssetType;
  tool_used: string | null;
  model_id: string | null;
  prompt_used: string | null;
  status: AssetStatus;
  version: number | null;
  file_url: string | null;
  cost_estimate: number | null;
  duration_seconds: number | null;
  voice_id: string | null;
  source_text: string | null;
  notes: string | null;
  is_selected: boolean;
  error_message: string | null;
  created_at: string;
};

const searchSchema = z.object({
  script: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/generation")({
  validateSearch: searchSchema,
  component: GenerationBoard,
});

function StatusChip({ status }: { status: AssetStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
        STATUS_STYLE[status],
      )}
    >
      {status}
    </span>
  );
}

function isHttpUrl(s: string | null | undefined) {
  return !!s && /^https?:\/\//i.test(s);
}

function GenerationBoard() {
  const { script: scriptParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [scripts, setScripts] = useState<ScriptLite[] | null>(null);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [selected, setSelected] = useState<ScriptLite | null>(null);
  const [shots, setShots] = useState<ShotRow[] | null>(null);
  const [assets, setAssets] = useState<AssetRow[] | null>(null);

  const [manualOpen, setManualOpen] = useState<{ shot: ShotRow } | null>(null);
  const [audioOpen, setAudioOpen] = useState<{ type: AssetType } | null>(null);
  const [generateOpen, setGenerateOpen] = useState<{ shot: ShotRow } | null>(null);
  const [voGenOpen, setVoGenOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState<AssetRow | null>(null);

  // signed URL cache for storage-path file_urls
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("scripts")
        .select(
          "id, archetype, hook, vo_script, target_duration, duration_seconds, angle:angles(id, title, brief:briefs(id, project_name, brand:brands(id, name)))",
        )
        .order("created_at", { ascending: false });
      setScripts((data as unknown as ScriptLite[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!scriptParam) {
      setSelected(null);
      setShots(null);
      setAssets(null);
      return;
    }
    let alive = true;
    (async () => {
      const { data: scriptData } = await supabase
        .from("scripts")
        .select(
          "id, archetype, hook, vo_script, target_duration, duration_seconds, angle:angles(id, title, brief:briefs(id, project_name, brand:brands(id, name)))",
        )
        .eq("id", scriptParam)
        .maybeSingle();
      if (!alive) return;
      setSelected((scriptData as unknown as ScriptLite) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [scriptParam]);

  const briefId = selected?.angle?.brief?.id ?? null;

  const reloadBoard = async () => {
    if (!selected) return;
    const { data: shotData } = await supabase
      .from("shots")
      .select(
        "id, script_id, shot_number, visual_description, assigned_tool, duration_seconds, generation_method, reference_image_url",
      )
      .eq("script_id", selected.id)
      .order("shot_number", { ascending: true })
      .order("created_at", { ascending: true });
    const shotRows = (shotData as unknown as ShotRow[]) ?? [];
    setShots(shotRows);

    const shotIds = shotRows.map((s) => s.id);
    let clipAssets: AssetRow[] = [];
    if (shotIds.length > 0) {
      const { data: a } = await supabase
        .from("assets")
        .select(
          "id, shot_id, brief_id, type, tool_used, model_id, prompt_used, status, version, file_url, cost_estimate, duration_seconds, voice_id, source_text, notes, is_selected, error_message, created_at",
        )
        .in("shot_id", shotIds)
        .order("version", { ascending: true });
      clipAssets = (a as unknown as AssetRow[]) ?? [];
    }

    let briefAssets: AssetRow[] = [];
    if (briefId) {
      const { data: b } = await supabase
        .from("assets")
        .select(
          "id, shot_id, brief_id, type, tool_used, model_id, prompt_used, status, version, file_url, cost_estimate, duration_seconds, voice_id, source_text, notes, is_selected, error_message, created_at",
        )
        .eq("brief_id", briefId)
        .is("shot_id", null)
        .order("created_at", { ascending: true });
      briefAssets = (b as unknown as AssetRow[]) ?? [];
    }
    setAssets([...clipAssets, ...briefAssets]);
  };

  useEffect(() => {
    if (selected) void reloadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, briefId]);

  // Poll fal for any assets currently generating.
  useEffect(() => {
    if (!assets) return;
    const pending = assets.filter((a) => a.status === "generating");
    if (pending.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      let anyChanged = false;
      for (const a of pending) {
        try {
          const { data, error } = await supabase.functions.invoke("check-generation", {
            body: { asset_id: a.id },
            headers: { Authorization: `Bearer ${token}` },
          });
          if (cancelled) return;
          if (error) continue;
          const newStatus = (data as { status?: string } | null)?.status;
          if (newStatus && newStatus !== "generating") anyChanged = true;
        } catch {
          // ignore transient errors, retry next tick
        }
      }
      if (!cancelled && anyChanged) await reloadBoard();
    };
    const id = setInterval(tick, 6000);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  // resolve signed URLs for storage-path file_urls
  useEffect(() => {
    if (!assets) return;
    const needed = assets
      .map((a) => a.file_url)
      .filter((u): u is string => !!u && !isHttpUrl(u) && !signedUrls[u]);
    if (needed.length === 0) return;
    (async () => {
      const next = await getCampaignSignedUrls(Array.from(new Set(needed)));
      setSignedUrls((prev) => ({ ...prev, ...next }));
    })();
  }, [assets, signedUrls]);

  const filteredScripts = useMemo(() => {
    if (!scripts) return [];
    const s = search.trim().toLowerCase();
    if (!s) return scripts;
    return scripts.filter(
      (x) =>
        (x.hook ?? "").toLowerCase().includes(s) ||
        (x.archetype ?? "").toLowerCase().includes(s) ||
        (x.angle?.title ?? "").toLowerCase().includes(s) ||
        (x.angle?.brief?.project_name ?? "").toLowerCase().includes(s) ||
        (x.angle?.brief?.brand?.name ?? "").toLowerCase().includes(s),
    );
  }, [scripts, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: ScriptLite[] }>();
    for (const s of filteredScripts) {
      const key = s.angle?.brief?.id ?? "_orphan";
      const label =
        (s.angle?.brief?.brand?.name ?? "—") +
        " · " +
        (s.angle?.brief?.project_name ?? "—");
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(s);
    }
    return Array.from(map.values());
  }, [filteredScripts]);

  // ---- helpers ----------------------------------------------------------

  const assetsByShot = useMemo(() => {
    const m = new Map<string, AssetRow[]>();
    (assets ?? []).forEach((a) => {
      if (!a.shot_id) return;
      if (!m.has(a.shot_id)) m.set(a.shot_id, []);
      m.get(a.shot_id)!.push(a);
    });
    return m;
  }, [assets]);

  const audioAssets = useMemo(() => {
    return (assets ?? []).filter((a) => a.shot_id == null);
  }, [assets]);

  const selectedTakeCount = useMemo(() => {
    if (!shots) return 0;
    let n = 0;
    for (const sh of shots) {
      const list = assetsByShot.get(sh.id) ?? [];
      if (list.some((a) => a.is_selected)) n += 1;
    }
    return n;
  }, [shots, assetsByShot]);

  const totalCost = useMemo(
    () =>
      (assets ?? []).reduce(
        (sum, a) => sum + (a.cost_estimate ? Number(a.cost_estimate) : 0),
        0,
      ),
    [assets],
  );

  const setSelectedTake = async (shotId: string, assetId: string) => {
    if (!assets) return;
    const shotAssets = assetsByShot.get(shotId) ?? [];
    // optimistic
    setAssets((prev) =>
      (prev ?? []).map((a) =>
        a.shot_id === shotId
          ? { ...a, is_selected: a.id === assetId }
          : a,
      ),
    );
    await Promise.all(
      shotAssets.map((a) =>
        supabase
          .from("assets")
          .update({ is_selected: a.id === assetId })
          .eq("id", a.id),
      ),
    );
  };

  const updateStatus = async (asset: AssetRow, status: AssetStatus) => {
    const { error } = await supabase
      .from("assets")
      .update({ status })
      .eq("id", asset.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await reloadBoard();
    setDetailOpen((cur) => (cur && cur.id === asset.id ? { ...cur, status } : cur));
  };

  const deleteAsset = async (asset: AssetRow) => {
    const { error } = await supabase.from("assets").delete().eq("id", asset.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Asset removed");
    setDetailOpen(null);
    await reloadBoard();
  };

  // ---- UI ---------------------------------------------------------------

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="label-mono mb-2">Phase 04 · Generation</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Generation Board
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-xl">
          Track every take per shot. Mark the final version once it's approved.
        </p>
      </div>

      {/* Storyboard selector */}
      <div className="border border-border rounded-[3px] bg-card p-4 mb-6 flex flex-wrap items-center gap-4">
        <span className="label-mono">Storyboard</span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex-1 min-w-[320px] flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 rounded-[3px] text-sm hover:border-foreground/40 transition-colors"
            >
              {selected ? (
                <span className="flex items-center gap-2 truncate">
                  <span className="text-muted-foreground truncate">
                    {selected.angle?.brief?.brand?.name ?? "—"} ·{" "}
                    {selected.angle?.brief?.project_name ?? "—"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  {selected.archetype && (
                    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px]">
                      {selected.archetype}
                    </span>
                  )}
                  <span className="font-medium truncate">
                    {selected.hook?.split("\n")[0] || "Untitled script"}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Select a storyboard…
                </span>
              )}
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[520px] p-0" align="start">
            <div className="p-2 border-b border-border">
              <Input
                placeholder="Search scripts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {grouped.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No storyboards match.
                </div>
              ) : (
                grouped.map((g) => (
                  <div key={g.label}>
                    <div className="label-mono px-3 py-1.5 bg-background/60 border-b border-border/60 text-[10px]">
                      {g.label}
                    </div>
                    {g.items.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          navigate({ search: { script: s.id } });
                          setPickerOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-background/60 border-b border-border/60 last:border-b-0 flex items-center gap-2"
                      >
                        {s.archetype && (
                          <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px] shrink-0">
                            {s.archetype}
                          </span>
                        )}
                        <span className="text-sm flex-1 truncate">
                          {s.hook?.split("\n")[0] || (
                            <span className="text-muted-foreground italic">
                              Untitled
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {!selected ? (
        <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
          <p className="label-mono mb-3">No storyboard selected</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Pick a storyboard above to start tracking takes.
          </p>
        </div>
      ) : (
        <>
          {/* Progress strip */}
          <div className="border border-border rounded-[3px] bg-card p-4 mb-6 grid md:grid-cols-2 gap-4">
            <div>
              <p className="label-mono mb-2">Selected takes</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold">
                  {selectedTakeCount}
                </span>
                <span className="text-muted-foreground text-sm">
                  of {shots?.length ?? 0} shots
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-background border border-border rounded-[2px] overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{
                    width: shots && shots.length > 0
                      ? `${(selectedTakeCount / shots.length) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
            <div>
              <p className="label-mono mb-2">Estimated cost</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold">
                  ${totalCost.toFixed(2)}
                </span>
                <span className="text-muted-foreground text-sm">
                  across {(assets ?? []).length} assets
                </span>
              </div>
            </div>
          </div>

          {/* Shot board */}
          <div className="space-y-4 mb-12">
            {(shots ?? []).length === 0 ? (
              <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-12 text-center">
                <p className="label-mono mb-2">No shots in this storyboard</p>
                <p className="text-sm text-muted-foreground">
                  Add shots in Storyboard first.
                </p>
              </div>
            ) : (
              shots!.map((shot) => (
                <ShotPanel
                  key={shot.id}
                  shot={shot}
                  assets={assetsByShot.get(shot.id) ?? []}
                  signedUrls={signedUrls}
                  onAddManual={() => setManualOpen({ shot })}
                  onGenerate={() => setGenerateOpen({ shot })}
                  onSelectTake={(assetId) => setSelectedTake(shot.id, assetId)}
                  onOpenDetail={(a) => setDetailOpen(a)}
                />
              ))
            )}
          </div>

          {/* Audio panel */}
          <AudioPanel
            script={selected}
            assets={audioAssets}
            signedUrls={signedUrls}
            onAdd={(type) => setAudioOpen({ type })}
            onGenerateVo={() => setVoGenOpen(true)}
            onOpenDetail={(a) => setDetailOpen(a)}
          />
        </>
      )}

      {/* Dialogs */}
      {manualOpen && selected && (
        <ManualAddDialog
          shot={manualOpen.shot}
          briefId={briefId}
          existingVersionCount={
            (assetsByShot.get(manualOpen.shot.id) ?? []).length
          }
          onClose={() => setManualOpen(null)}
          onSaved={async () => {
            setManualOpen(null);
            await reloadBoard();
          }}
        />
      )}

      {audioOpen && selected && briefId && (
        <AudioAddDialog
          type={audioOpen.type}
          briefId={briefId}
          defaultSourceText={
            audioOpen.type === "voiceover" ? selected.vo_script ?? "" : ""
          }
          onClose={() => setAudioOpen(null)}
          onSaved={async () => {
            setAudioOpen(null);
            await reloadBoard();
          }}
        />
      )}

      {generateOpen && selected && (
        <GenerateClipDialog
          shot={generateOpen.shot}
          briefId={briefId}
          existingVersionCount={
            (assetsByShot.get(generateOpen.shot.id) ?? []).length
          }
          onClose={() => setGenerateOpen(null)}
          onSubmitted={async () => {
            setGenerateOpen(null);
            await reloadBoard();
          }}
        />
      )}

      {voGenOpen && selected && briefId && (
        <GenerateVoiceoverDialog
          briefId={briefId}
          defaultSourceText={selected.vo_script ?? ""}
          onClose={() => setVoGenOpen(false)}
          onSaved={async () => {
            setVoGenOpen(false);
            await reloadBoard();
          }}
        />
      )}

      {detailOpen && (
        <AssetDetailDialog
          asset={detailOpen}
          signedUrls={signedUrls}
          onClose={() => setDetailOpen(null)}
          onUpdateStatus={(s) => updateStatus(detailOpen, s)}
          onSaveNotes={async (notes) => {
            const { error } = await supabase
              .from("assets")
              .update({ notes })
              .eq("id", detailOpen.id);
            if (error) toast.error(error.message);
            else {
              toast.success("Notes saved");
              await reloadBoard();
              setDetailOpen({ ...detailOpen, notes });
            }
          }}
          onDelete={() => deleteAsset(detailOpen)}
        />
      )}
    </div>
  );
}

// ============== Shot panel ==============

function ShotPanel({
  shot,
  assets,
  signedUrls,
  onAddManual,
  onGenerate,
  onSelectTake,
  onOpenDetail,
}: {
  shot: ShotRow;
  assets: AssetRow[];
  signedUrls: Record<string, string>;
  onAddManual: () => void;
  onGenerate: () => void;
  onSelectTake: (assetId: string) => void;
  onOpenDetail: (a: AssetRow) => void;
}) {
  return (
    <article className="border border-border bg-card rounded-[3px] p-4">
      <header className="flex items-start gap-4 mb-4">
        <div className="shrink-0 w-12 h-12 border border-foreground rounded-[2px] flex flex-col items-center justify-center bg-foreground text-background">
          <span className="font-mono text-[9px] uppercase opacity-70">Shot</span>
          <span className="font-mono text-base font-bold leading-none">
            {String(shot.shot_number ?? "—").padStart(2, "0")}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug line-clamp-2">
            {shot.visual_description || (
              <span className="text-muted-foreground italic">
                No visual description
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {shot.assigned_tool && (
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px] bg-background">
                {shot.assigned_tool}
              </span>
            )}
            {shot.generation_method && (
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px] bg-background">
                {shot.generation_method}
              </span>
            )}
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px] bg-background">
              target {shot.duration_seconds ?? 0}s
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onGenerate}
            title="Generate with fal.ai"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAddManual}
          >
            <Upload className="h-3.5 w-3.5" />
            Add manually
          </Button>
          <Button type="button" size="sm" onClick={onAddManual}>
            <Plus className="h-3.5 w-3.5" />
            New version
          </Button>
        </div>
      </header>

      {assets.length === 0 ? (
        <div className="border border-dashed border-border rounded-[3px] p-6 text-center">
          <p className="label-mono text-muted-foreground">No takes yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {assets.map((a) => (
            <VersionCard
              key={a.id}
              asset={a}
              signedUrls={signedUrls}
              onSelectTake={() => onSelectTake(a.id)}
              onOpenDetail={() => onOpenDetail(a)}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function VersionCard({
  asset,
  signedUrls,
  onSelectTake,
  onOpenDetail,
}: {
  asset: AssetRow;
  signedUrls: Record<string, string>;
  onSelectTake: () => void;
  onOpenDetail: () => void;
}) {
  const url =
    asset.file_url
      ? isHttpUrl(asset.file_url)
        ? asset.file_url
        : signedUrls[asset.file_url] ?? null
      : null;
  return (
    <div
      className={cn(
        "border rounded-[3px] bg-background overflow-hidden flex flex-col group",
        asset.is_selected
          ? "border-[var(--color-rec)] ring-1 ring-[var(--color-rec)]/50"
          : "border-border hover:border-foreground/40",
      )}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        className="aspect-video bg-muted/40 relative flex items-center justify-center"
      >
        {url ? (
          <video
            src={url}
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <Film className="h-6 w-6 text-muted-foreground/40" />
        )}
        <span className="absolute top-1.5 left-1.5">
          <StatusChip status={asset.status} />
        </span>
        <span className="absolute top-1.5 right-1.5 font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-foreground bg-background/90 rounded-[2px]">
          v{asset.version ?? 1}
        </span>
      </button>
      <div className="p-2.5 flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between gap-2 min-h-[18px]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground truncate">
            {asset.tool_used || asset.model_id || "Manual"}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {asset.duration_seconds ? `${asset.duration_seconds}s` : ""}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
            <input
              type="radio"
              checked={asset.is_selected}
              onChange={onSelectTake}
              className="accent-[var(--color-rec)] h-3 w-3"
            />
            <span className={cn(
              asset.is_selected ? "text-[var(--color-rec)] font-medium" : "text-muted-foreground",
            )}>
              {asset.is_selected ? "Final take" : "Use this take"}
            </span>
          </label>
          {asset.cost_estimate != null && (
            <span className="font-mono text-[10px] text-muted-foreground">
              ${Number(asset.cost_estimate).toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============== Audio panel ==============

function AudioPanel({
  script,
  assets,
  signedUrls,
  onAdd,
  onGenerateVo,
  onOpenDetail,
}: {
  script: ScriptLite;
  assets: AssetRow[];
  signedUrls: Record<string, string>;
  onAdd: (type: AssetType) => void;
  onGenerateVo: () => void;
  onOpenDetail: (a: AssetRow) => void;
}) {
  const voiceovers = assets.filter((a) => a.type === "voiceover");
  const music = assets.filter((a) => a.type === "music");
  const sfx = assets.filter((a) => a.type === "sfx");

  return (
    <section className="border border-border bg-card rounded-[3px] p-5">
      <header className="mb-4">
        <p className="label-mono mb-1">Audio</p>
        <h2 className="font-display text-xl font-bold">Voiceover · Music · SFX</h2>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Voiceover */}
        <div className="border border-border rounded-[3px] p-3 bg-background">
          <div className="flex items-center justify-between mb-2">
            <p className="label-mono inline-flex items-center gap-1.5">
              <Volume2 className="h-3 w-3" /> Voiceover
            </p>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={onGenerateVo}>
                <Sparkles className="h-3 w-3" /> Generate
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAdd("voiceover")}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
          </div>
          {script.vo_script ? (
            <div className="text-xs whitespace-pre-wrap border-l-2 border-border pl-2 text-foreground/80 mb-3 max-h-32 overflow-y-auto">
              {script.vo_script}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic mb-3">
              No VO script on this script yet.
            </p>
          )}
          <AudioList items={voiceovers} signedUrls={signedUrls} onOpenDetail={onOpenDetail} />
        </div>

        {/* Music */}
        <div className="border border-border rounded-[3px] p-3 bg-background">
          <div className="flex items-center justify-between mb-2">
            <p className="label-mono inline-flex items-center gap-1.5">
              <Music className="h-3 w-3" /> Music
            </p>
            <Button size="sm" variant="outline" onClick={() => onAdd("music")}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          <AudioList items={music} signedUrls={signedUrls} onOpenDetail={onOpenDetail} />
        </div>

        {/* SFX */}
        <div className="border border-border rounded-[3px] p-3 bg-background">
          <div className="flex items-center justify-between mb-2">
            <p className="label-mono inline-flex items-center gap-1.5">
              <Waves className="h-3 w-3" /> SFX
            </p>
            <Button size="sm" variant="outline" onClick={() => onAdd("sfx")}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          <AudioList items={sfx} signedUrls={signedUrls} onOpenDetail={onOpenDetail} />
        </div>
      </div>
    </section>
  );
}

function AudioList({
  items,
  signedUrls,
  onOpenDetail,
}: {
  items: AssetRow[];
  signedUrls: Record<string, string>;
  onOpenDetail: (a: AssetRow) => void;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No clips yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((a) => {
        const url =
          a.file_url
            ? isHttpUrl(a.file_url)
              ? a.file_url
              : signedUrls[a.file_url] ?? null
            : null;
        return (
          <li key={a.id} className="border border-border rounded-[2px] p-2 bg-card">
            <button
              onClick={() => onOpenDetail(a)}
              className="w-full text-left flex items-center justify-between gap-2 mb-1.5"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                {a.voice_id || a.tool_used || "Untitled"}
              </span>
              <StatusChip status={a.status} />
            </button>
            {url ? (
              <audio src={url} controls className="w-full h-8" />
            ) : (
              <p className="text-[11px] text-muted-foreground italic">
                No file attached
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ============== Manual add dialog ==============

function ManualAddDialog({
  shot,
  briefId,
  existingVersionCount,
  onClose,
  onSaved,
}: {
  shot: ShotRow;
  briefId: string | null;
  existingVersionCount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tool, setTool] = useState<string>(shot.assigned_tool || "Manual / Other");
  const [duration, setDuration] = useState<string>(
    shot.duration_seconds ? String(shot.duration_seconds) : "",
  );
  const [cost, setCost] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (mode === "url" && !url.trim()) {
      toast.error("Paste a video URL or switch to upload.");
      return;
    }
    if (mode === "upload" && !file) {
      toast.error("Choose a file first.");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("Not signed in.");
        return;
      }
      let file_url: string;
      if (mode === "upload" && file && briefId) {
        file_url = await uploadCampaignFile(userId, briefId, file);
      } else if (mode === "upload" && file && !briefId) {
        // fallback: still upload under shot id namespace
        file_url = await uploadCampaignFile(userId, shot.id, file);
      } else {
        file_url = url.trim();
      }

      const payload = {
        shot_id: shot.id,
        user_id: userId,
        type: "clip" as AssetType,
        status: "review" as AssetStatus,
        version: existingVersionCount + 1,
        tool_used: tool,
        file_url,
        duration_seconds: duration ? Number(duration) : null,
        cost_estimate: cost ? Number(cost) : null,
        prompt_used: prompt || null,
      };
      const { error } = await supabase.from("assets").insert(payload);
      if (error) throw error;
      toast.success("Take saved");
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            Add take · Shot {shot.shot_number ?? "—"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-1">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={cn(
              "label-mono px-2 py-1 border rounded-[2px]",
              mode === "upload"
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={cn(
              "label-mono px-2 py-1 border rounded-[2px]",
              mode === "url"
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Paste URL
          </button>
        </div>

        {mode === "upload" ? (
          <div className="border border-dashed border-border rounded-[3px] p-4 text-center">
            <input
              ref={fileInput}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Choose video
            </Button>
            {file && (
              <p className="text-xs text-muted-foreground mt-2 truncate">
                {file.name}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="label-mono mb-1">Video URL</p>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="label-mono mb-1">Tool used</p>
            <Select value={tool} onValueChange={setTool}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TOOLS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="label-mono mb-1">Duration (s)</p>
            <Input
              type="number"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div>
            <p className="label-mono mb-1">Cost estimate ($)</p>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="label-mono mb-1">Prompt / notes</p>
          <Textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Prompt used or any context for this take…"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save take
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Audio add dialog ==============

function AudioAddDialog({
  type,
  briefId,
  defaultSourceText,
  onClose,
  onSaved,
}: {
  type: AssetType;
  briefId: string;
  defaultSourceText: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState("");
  const [sourceText, setSourceText] = useState(defaultSourceText);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const label =
    type === "voiceover" ? "voiceover" : type === "music" ? "music track" : "SFX clip";

  const save = async () => {
    if (mode === "url" && !url.trim()) {
      toast.error("Paste a URL or switch to upload.");
      return;
    }
    if (mode === "upload" && !file) {
      toast.error("Choose a file first.");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("Not signed in.");
        return;
      }
      let file_url: string;
      if (mode === "upload" && file) {
        file_url = await uploadCampaignFile(userId, briefId, file);
      } else {
        file_url = url.trim();
      }
      const payload = {
        brief_id: briefId,
        shot_id: null,
        user_id: userId,
        type,
        status: "review" as AssetStatus,
        file_url,
        voice_id: type === "voiceover" ? voice || null : null,
        source_text: type === "voiceover" ? sourceText || null : null,
        tool_used: type !== "voiceover" ? voice || null : null,
      };
      const { error } = await supabase.from("assets").insert(payload);
      if (error) throw error;
      toast.success(`${label} saved`);
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display capitalize">Add {label}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={cn(
              "label-mono px-2 py-1 border rounded-[2px]",
              mode === "upload"
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={cn(
              "label-mono px-2 py-1 border rounded-[2px]",
              mode === "url"
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Paste URL
          </button>
        </div>

        {mode === "upload" ? (
          <div className="border border-dashed border-border rounded-[3px] p-4 text-center">
            <input
              ref={fileInput}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Choose file
            </Button>
            {file && (
              <p className="text-xs text-muted-foreground mt-2 truncate">
                {file.name}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="label-mono mb-1">URL</p>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        )}

        <div>
          <p className="label-mono mb-1">
            {type === "voiceover" ? "Voice label" : "Source / tool"}
          </p>
          <Input
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            placeholder={
              type === "voiceover"
                ? "e.g. ElevenLabs · Bria"
                : type === "music"
                  ? "e.g. Suno · Epidemic"
                  : "e.g. Freesound"
            }
          />
        </div>

        {type === "voiceover" && (
          <div>
            <p className="label-mono mb-1">Source text</p>
            <Textarea
              rows={4}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Asset detail dialog ==============

function AssetDetailDialog({
  asset,
  signedUrls,
  onClose,
  onUpdateStatus,
  onSaveNotes,
  onDelete,
}: {
  asset: AssetRow;
  signedUrls: Record<string, string>;
  onClose: () => void;
  onUpdateStatus: (s: AssetStatus) => void;
  onSaveNotes: (notes: string) => void;
  onDelete: () => void;
}) {
  const url =
    asset.file_url
      ? isHttpUrl(asset.file_url)
        ? asset.file_url
        : signedUrls[asset.file_url] ?? null
      : null;
  const [notes, setNotes] = useState(asset.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const isAudio = asset.type !== "clip";

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display capitalize flex items-center gap-2">
            {asset.type}
            <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-foreground rounded-[2px]">
              v{asset.version ?? 1}
            </span>
            <StatusChip status={asset.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/40 rounded-[3px] overflow-hidden flex items-center justify-center min-h-[200px]">
          {url ? (
            isAudio ? (
              <audio src={url} controls className="w-full m-4" />
            ) : (
              <video src={url} controls className="w-full max-h-[420px]" />
            )
          ) : (
            <p className="text-sm text-muted-foreground py-12">No preview available</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="label-mono">Tool</p>
            <p>{asset.tool_used || asset.model_id || "—"}</p>
          </div>
          <div>
            <p className="label-mono">Duration</p>
            <p>{asset.duration_seconds ? `${asset.duration_seconds}s` : "—"}</p>
          </div>
          <div>
            <p className="label-mono">Cost estimate</p>
            <p>
              {asset.cost_estimate != null
                ? `$${Number(asset.cost_estimate).toFixed(2)}`
                : "—"}
            </p>
          </div>
          {asset.voice_id && (
            <div>
              <p className="label-mono">Voice</p>
              <p>{asset.voice_id}</p>
            </div>
          )}
        </div>

        {(asset.prompt_used || asset.source_text) && (
          <div className="border-t border-border pt-3">
            <p className="label-mono mb-1">
              {asset.type === "voiceover" ? "Source text" : "Prompt used"}
            </p>
            <p className="text-sm whitespace-pre-wrap text-foreground/80">
              {asset.source_text || asset.prompt_used}
            </p>
          </div>
        )}

        {asset.error_message && (
          <div className="border-t border-[var(--color-rec)]/40 pt-3">
            <p className="label-mono text-[var(--color-rec)] mb-1">Error</p>
            <p className="text-sm text-[var(--color-rec)]/90">{asset.error_message}</p>
          </div>
        )}

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-1">
            <p className="label-mono">Version notes</p>
            {!editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="label-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="flex flex-col gap-2">
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setNotes(asset.notes ?? ""); setEditingNotes(false); }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => { onSaveNotes(notes); setEditingNotes(false); }}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap text-foreground/80">
              {notes || <span className="text-muted-foreground italic">No notes</span>}
            </p>
          )}
        </div>

        <DialogFooter className="!justify-between items-center">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 label-mono text-[var(--color-rec)] hover:underline"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onUpdateStatus("rejected")}
              disabled={asset.status === "rejected"}
            >
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onUpdateStatus("approved")}
              disabled={asset.status === "approved"}
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}