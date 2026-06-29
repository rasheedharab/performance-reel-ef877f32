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
  DialogDescription,
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
  // Prompt slots — used for auto-compile in the generate dialog.
  subject: string | null;
  subject_tokens: string | null;
  action: string | null;
  setting: string | null;
  lighting: string | null;
  lens: string | null;
  style_grade: string | null;
  mood: string | null;
  dialogue: string | null;
  sfx: string | null;
  ambient: string | null;
  negative_prompt: string | null;
  seed: number | null;
  camera_move: string | null;
  motion_intensity: string | null;
  prompt_word_target: number | null;
  compiled_prompt: string | null;
  compiled_negative: string | null;
  compiled_audio: string | null;
  compiled_for_tool: string | null;
  compiled_at: string | null;
};

type AssetRow = {
  id: string;
  shot_id: string | null;
  brief_id: string | null;
  type: AssetType;
  tool_used: string | null;
  model_id: string | null;
  prompt_used: string | null;
  negative_used: string | null;
  audio_used: string | null;
  seed_used: number | null;
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
  render_tier: "draft" | "final";
  ab_group_id: string | null;
  variant_label: string | null;
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
  const [brandLockedSeed, setBrandLockedSeed] = useState<number | null>(null);

  const [manualOpen, setManualOpen] = useState<{ shot: ShotRow } | null>(null);
  const [audioOpen, setAudioOpen] = useState<{ type: AssetType } | null>(null);
  const [generateOpen, setGenerateOpen] = useState<{
    shot: ShotRow;
    prefill?: {
      prompt: string;
      negative: string | null;
      audio: string | null;
      seed: number | null;
      familyKey?: string;
    } | null;
    lockTier?: RenderTier;
  } | null>(null);
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
  const brandId = selected?.angle?.brief?.brand?.id ?? null;

  // Style-bible locked seed → default seed across the campaign.
  useEffect(() => {
    if (!brandId) {
      setBrandLockedSeed(null);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("style_bibles")
        .select("locked_seed")
        .eq("brand_id", brandId)
        .maybeSingle();
      if (!alive) return;
      const s = (data as { locked_seed?: number | null } | null)?.locked_seed;
      setBrandLockedSeed(typeof s === "number" ? s : null);
    })();
    return () => {
      alive = false;
    };
  }, [brandId]);

  const reloadBoard = async () => {
    if (!selected) return;
    const { data: shotData } = await supabase
      .from("shots")
      .select(
        "id, script_id, shot_number, visual_description, assigned_tool, duration_seconds, generation_method, reference_image_url, subject, subject_tokens, action, setting, lighting, lens, style_grade, mood, dialogue, sfx, ambient, negative_prompt, seed, camera_move, motion_intensity, prompt_word_target, compiled_prompt, compiled_negative, compiled_audio, compiled_for_tool, compiled_at",
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
          "id, shot_id, brief_id, type, tool_used, model_id, prompt_used, negative_used, audio_used, seed_used, status, version, file_url, cost_estimate, duration_seconds, voice_id, source_text, notes, is_selected, error_message, created_at, render_tier",
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
          "id, shot_id, brief_id, type, tool_used, model_id, prompt_used, negative_used, audio_used, seed_used, status, version, file_url, cost_estimate, duration_seconds, voice_id, source_text, notes, is_selected, error_message, created_at, render_tier",
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

  // Split spend by tier (clips only — voiceovers etc. are tier-agnostic).
  const tierSpend = useMemo(() => {
    let draft = 0;
    let final = 0;
    for (const a of assets ?? []) {
      if (a.type !== "clip") continue;
      const c = a.cost_estimate ? Number(a.cost_estimate) : 0;
      if (a.render_tier === "final") final += c;
      else draft += c;
    }
    return { draft, final };
  }, [assets]);

  // Shots whose currently-selected take is still a draft → candidates for promotion.
  const draftSelected = useMemo(() => {
    const out: { shot: ShotRow; asset: AssetRow }[] = [];
    for (const sh of shots ?? []) {
      const list = assetsByShot.get(sh.id) ?? [];
      const sel = list.find((a) => a.is_selected && a.type === "clip");
      if (sel && sel.render_tier !== "final") out.push({ shot: sh, asset: sel });
    }
    return out;
  }, [shots, assetsByShot]);

  const finalSelectedCount = useMemo(() => {
    let n = 0;
    for (const sh of shots ?? []) {
      const list = assetsByShot.get(sh.id) ?? [];
      const sel = list.find((a) => a.is_selected && a.type === "clip");
      if (sel && sel.render_tier === "final") n += 1;
    }
    return n;
  }, [shots, assetsByShot]);

  // Open the Generate dialog pre-populated to re-run an existing draft asset as final.
  const renderFinalFromAsset = (shot: ShotRow, asset: AssetRow) => {
    const family = getFamilyByModelId(asset.model_id);
    setGenerateOpen({
      shot,
      lockTier: "final",
      prefill: {
        prompt: asset.prompt_used ?? "",
        negative: asset.negative_used ?? null,
        audio: asset.audio_used ?? null,
        seed: asset.seed_used ?? null,
        familyKey: family?.key,
      },
    });
  };

  // Promote every selected-draft take to a final-tier render in one batch.
  // Reuses the exact compiled_prompt / negative / audio / seed already on the
  // approved draft asset — only the model_id swaps to the flagship variant.
  const batchRenderFinal = async () => {
    if (draftSelected.length === 0) return;
    const toastId = toast.loading(
      `Queuing ${draftSelected.length} final render${draftSelected.length === 1 ? "" : "s"}…`,
    );
    let queued = 0;
    let failed = 0;
    for (const { shot, asset } of draftSelected) {
      const family = getFamilyByModelId(asset.model_id);
      if (!family) {
        failed += 1;
        continue;
      }
      const dur = shot.duration_seconds ?? asset.duration_seconds ?? 8;
      const existing = assetsByShot.get(shot.id) ?? [];
      const method =
        (shot.generation_method as "text-to-video" | "image-to-video" | null) ??
        "text-to-video";
      const { error } = await supabase.functions.invoke("generate-clip", {
        body: {
          shot_id: shot.id,
          brief_id: briefId,
          prompt: asset.prompt_used ?? "",
          negative_prompt: asset.negative_used ?? null,
          audio_prompt: family.supportsAudio ? asset.audio_used ?? null : null,
          seed: asset.seed_used ?? null,
          generation_method: method,
          reference_image_url:
            method === "image-to-video" ? shot.reference_image_url ?? null : null,
          duration_seconds: dur,
          aspect_ratio: "9:16",
          model_id: family.final.id,
          tool_used: `${family.label} · ${family.final.label}`,
          render_tier: "final",
          cost_estimate: estimateCost(family.final, dur),
          version: existing.length + 1,
        },
      });
      if (error) failed += 1;
      else queued += 1;
    }
    toast.dismiss(toastId);
    if (failed === 0) {
      toast.success(`Queued ${queued} final render${queued === 1 ? "" : "s"}.`);
    } else {
      toast.error(`Queued ${queued}, failed ${failed}.`);
    }
    await reloadBoard();
  };

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
          <div className="border border-border rounded-[3px] bg-card p-4 mb-6 grid md:grid-cols-3 gap-4">
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
              <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <span>
                  <span className="text-foreground font-medium">{finalSelectedCount}</span> final
                </span>
                <span>
                  <span className="text-foreground font-medium">{draftSelected.length}</span> draft
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-background border border-border rounded-[2px] overflow-hidden flex">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{
                    width: shots && shots.length > 0
                      ? `${(finalSelectedCount / shots.length) * 100}%`
                      : "0%",
                  }}
                />
                <div
                  className="h-full bg-foreground/30 transition-all"
                  style={{
                    width: shots && shots.length > 0
                      ? `${(draftSelected.length / shots.length) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
            <div>
              <p className="label-mono mb-2">Spend by tier</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold">
                  ${totalCost.toFixed(2)}
                </span>
                <span className="text-muted-foreground text-sm">
                  total
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <span>
                  draft <span className="text-foreground">${tierSpend.draft.toFixed(2)}</span>
                </span>
                <span>
                  final <span className="text-foreground">${tierSpend.final.toFixed(2)}</span>
                </span>
              </div>
            </div>
            <div>
              <p className="label-mono mb-2">Promote to final</p>
              {draftSelected.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  All selected takes are final renders.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    {draftSelected.length} selected{" "}
                    {draftSelected.length === 1 ? "take is" : "takes are"} still draft.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const estimate = draftSelected.reduce((sum, { shot, asset }) => {
                        const fam = getFamilyByModelId(asset.model_id);
                        const dur = shot.duration_seconds ?? asset.duration_seconds ?? 8;
                        return sum + (fam ? estimateCost(fam.final, dur) : 0);
                      }, 0);
                      const ok = window.confirm(
                        `Render ${draftSelected.length} selected take${
                          draftSelected.length === 1 ? "" : "s"
                        } as final?\n\nEstimated cost: ~$${estimate.toFixed(2)}.\nEach uses the same compiled prompt, negative, and seed — only the model swaps to the flagship variant.`,
                      );
                      if (!ok) return;
                      void batchRenderFinal();
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Render all selected as final
                  </Button>
                </>
              )}
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
                  onRenderFinal={(a) => renderFinalFromAsset(shot, a)}
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
          brandLockedSeed={brandLockedSeed}
          existingVersionCount={
            (assetsByShot.get(generateOpen.shot.id) ?? []).length
          }
          prefill={generateOpen.prefill ?? null}
          lockTier={generateOpen.lockTier}
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
  onRenderFinal,
  onSelectTake,
  onOpenDetail,
}: {
  shot: ShotRow;
  assets: AssetRow[];
  signedUrls: Record<string, string>;
  onAddManual: () => void;
  onGenerate: () => void;
  onRenderFinal: (asset: AssetRow) => void;
  onSelectTake: (assetId: string) => void;
  onOpenDetail: (a: AssetRow) => void;
}) {
  const selected = assets.find((a) => a.is_selected && a.type === "clip");
  const selectedIsDraft = selected ? selected.render_tier !== "final" : false;
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
        <>
          {selected && selectedIsDraft && (
            <div className="mb-3 flex items-center justify-between gap-3 border border-dashed border-foreground/40 bg-background rounded-[3px] px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Selected take is a{" "}
                <span className="font-mono uppercase text-foreground">draft</span> —
                render final?
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRenderFinal(selected)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Render final
              </Button>
            </div>
          )}
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
          <VersionDiffStrip assets={assets} />
        </>
      )}
    </article>
  );
}

// Small diff strip: shows what changed in prompt_used / seed_used / negative_used
// between the latest two clip versions, so the team can correlate prompt deltas
// with take quality.
function VersionDiffStrip({ assets }: { assets: AssetRow[] }) {
  const clips = assets
    .filter((a) => a.type === "clip")
    .slice()
    .sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
  if (clips.length < 2) return null;
  const a = clips[clips.length - 2];
  const b = clips[clips.length - 1];

  const rows: Array<{ label: string; from: string; to: string; changed: boolean }> = [
    {
      label: "Prompt",
      from: a.prompt_used ?? "",
      to: b.prompt_used ?? "",
      changed: (a.prompt_used ?? "") !== (b.prompt_used ?? ""),
    },
    {
      label: "Negative",
      from: a.negative_used ?? "",
      to: b.negative_used ?? "",
      changed: (a.negative_used ?? "") !== (b.negative_used ?? ""),
    },
    {
      label: "Seed",
      from: a.seed_used != null ? String(a.seed_used) : "—",
      to: b.seed_used != null ? String(b.seed_used) : "—",
      changed: (a.seed_used ?? null) !== (b.seed_used ?? null),
    },
    {
      label: "Model",
      from: a.tool_used ?? a.model_id ?? "—",
      to: b.tool_used ?? b.model_id ?? "—",
      changed:
        (a.tool_used ?? a.model_id ?? "") !== (b.tool_used ?? b.model_id ?? ""),
    },
  ];
  const anyChanged = rows.some((r) => r.changed);
  if (!anyChanged) return null;

  return (
    <div className="mt-3 border border-border rounded-[3px] bg-background p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="label-mono">
          Prompt diff · v{a.version ?? 1} → v{b.version ?? 1}
        </p>
        <span className="font-mono text-[10px] text-muted-foreground">
          What changed between the last two takes
        </span>
      </div>
      <ul className="space-y-1.5 text-xs">
        {rows
          .filter((r) => r.changed)
          .map((r) => (
            <li key={r.label} className="grid grid-cols-[80px_1fr] gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground pt-0.5">
                {r.label}
              </span>
              <div className="space-y-1">
                <div className="flex gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground pt-0.5 shrink-0">
                    from
                  </span>
                  <span className="whitespace-pre-wrap text-foreground/60 line-through decoration-[var(--color-rec)]/40">
                    {r.from || <span className="italic text-muted-foreground">empty</span>}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-700 pt-0.5 shrink-0">
                    to
                  </span>
                  <span className="whitespace-pre-wrap">
                    {r.to || <span className="italic text-muted-foreground">empty</span>}
                  </span>
                </div>
              </div>
            </li>
          ))}
      </ul>
    </div>
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
        {asset.type === "clip" && (
          <span
            className={cn(
              "absolute bottom-1.5 left-1.5 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-[2px] border",
              asset.render_tier === "final"
                ? "bg-foreground text-background border-foreground"
                : "bg-background/80 text-muted-foreground border-border",
            )}
            title={asset.render_tier === "final" ? "Flagship render" : "Cheap iteration"}
          >
            {asset.render_tier === "final" ? "Final" : "Draft"}
          </span>
        )}
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

        {asset.type === "clip" &&
          (asset.negative_used || asset.audio_used || asset.seed_used != null) && (
            <div className="border-t border-border pt-3 grid grid-cols-1 gap-2 text-sm">
              {asset.negative_used && (
                <div>
                  <p className="label-mono mb-0.5">Negative</p>
                  <p className="whitespace-pre-wrap text-foreground/80">
                    {asset.negative_used}
                  </p>
                </div>
              )}
              {asset.audio_used && (
                <div>
                  <p className="label-mono mb-0.5">Audio cue</p>
                  <p className="whitespace-pre-wrap text-foreground/80">
                    {asset.audio_used}
                  </p>
                </div>
              )}
              {asset.seed_used != null && (
                <div>
                  <p className="label-mono mb-0.5">Seed</p>
                  <p className="font-mono text-xs text-foreground/80">{asset.seed_used}</p>
                </div>
              )}
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

// ============== Generate clip dialog (fal.ai) ==============

// Two-tier model family map. Each family pairs a CHEAP "draft" variant
// (fast / lite / turbo) with the FINAL flagship model. Cost-per-second is
// approximate — the user sees the live estimate before they spend.
// NOTE: fal.ai model slugs marked `placeholder` should be confirmed against
// the fal.ai docs before going live; they're set to the closest known route
// so the UI is functional today.
type TierVariant = {
  id: string;
  label: string;
  costPerSecond: number; // USD/sec, approximate
};
type ModelFamily = {
  key: string;
  label: string;
  compileTool: string; // storyboard `assigned_tool` value used by compile_prompt
  method: "text-to-video" | "image-to-video";
  supportsAudio: boolean;
  draft: TierVariant;
  final: TierVariant;
};

const MODEL_FAMILIES: ModelFamily[] = [
  {
    key: "veo-3-1-t2v",
    label: "Veo 3.1",
    compileTool: "Veo 3.1",
    method: "text-to-video",
    supportsAudio: true,
    draft: { id: "fal-ai/veo3/fast", label: "Veo 3.1 Fast", costPerSecond: 0.05 },
    final: { id: "fal-ai/veo3", label: "Veo 3.1 Quality", costPerSecond: 0.15 },
  },
  {
    key: "kling-3-t2v",
    label: "Kling 3.0",
    compileTool: "Kling 3.0",
    method: "text-to-video",
    supportsAudio: false,
    draft: {
      id: "fal-ai/kling-video/v2.1/standard/text-to-video",
      label: "Kling Turbo (T2V)",
      costPerSecond: 0.04,
    },
    final: {
      id: "fal-ai/kling-video/v2.1/master/text-to-video",
      label: "Kling 3.0 4K (T2V)",
      costPerSecond: 0.12,
    },
  },
  {
    key: "kling-3-i2v",
    label: "Kling 3.0 (I2V)",
    compileTool: "Kling 3.0",
    method: "image-to-video",
    supportsAudio: false,
    draft: {
      id: "fal-ai/kling-video/v2.1/standard/image-to-video",
      label: "Kling Turbo (I2V)",
      costPerSecond: 0.05,
    },
    final: {
      id: "fal-ai/kling-video/v2.1/master/image-to-video",
      label: "Kling 3.0 4K (I2V)",
      costPerSecond: 0.13,
    },
  },
  {
    key: "runway-gen-4-t2v",
    label: "Runway Gen-4.5",
    compileTool: "Runway Gen-4.5",
    method: "text-to-video",
    supportsAudio: false,
    draft: {
      id: "fal-ai/runway-gen4/turbo", // placeholder — confirm slug
      label: "Gen-4 Turbo",
      costPerSecond: 0.05,
    },
    final: {
      id: "fal-ai/runway-gen4", // placeholder — confirm slug
      label: "Gen-4.5",
      costPerSecond: 0.15,
    },
  },
  {
    key: "runway-gen-4-i2v",
    label: "Runway Gen-4.5 (I2V)",
    compileTool: "Runway Gen-4.5",
    method: "image-to-video",
    supportsAudio: false,
    draft: {
      id: "fal-ai/runway-gen4/turbo/image-to-video", // placeholder
      label: "Gen-4 Turbo (I2V)",
      costPerSecond: 0.05,
    },
    final: {
      id: "fal-ai/runway-gen4/image-to-video", // placeholder
      label: "Gen-4.5 (I2V)",
      costPerSecond: 0.15,
    },
  },
  {
    key: "luma-ray3-i2v",
    label: "Luma Ray3",
    compileTool: "Luma Ray3",
    method: "image-to-video",
    supportsAudio: false,
    draft: {
      id: "fal-ai/luma-dream-machine/ray-3/fast", // placeholder
      label: "Ray3 Fast",
      costPerSecond: 0.04,
    },
    final: {
      id: "fal-ai/luma-dream-machine/ray-3", // placeholder — HDR variant
      label: "Ray3 HDR",
      costPerSecond: 0.12,
    },
  },
];

type RenderTier = "draft" | "final";

function getFamilyByModelId(modelId: string | null | undefined): ModelFamily | null {
  if (!modelId) return null;
  return (
    MODEL_FAMILIES.find(
      (f) => f.draft.id === modelId || f.final.id === modelId,
    ) ?? null
  );
}
function getTierForModelId(modelId: string | null | undefined): RenderTier | null {
  const f = getFamilyByModelId(modelId);
  if (!f) return null;
  return f.final.id === modelId ? "final" : "draft";
}
function estimateCost(variant: TierVariant, durationSeconds: number) {
  return Math.max(0, variant.costPerSecond * Math.max(1, durationSeconds || 8));
}

function buildCompilePayload(shot: ShotRow, compileTool: string) {
  return {
    assigned_tool: compileTool,
    subject: shot.subject,
    subject_tokens: shot.subject_tokens,
    action: shot.action,
    setting: shot.setting,
    lighting: shot.lighting,
    lens: shot.lens,
    style_grade: shot.style_grade,
    mood: shot.mood,
    dialogue: shot.dialogue,
    sfx: shot.sfx,
    ambient: shot.ambient,
    negative_prompt: shot.negative_prompt,
    seed: shot.seed,
    camera_move: shot.camera_move,
    motion_intensity: shot.motion_intensity,
    duration_seconds: shot.duration_seconds,
    generation_method: shot.generation_method,
    has_anchor_image: !!shot.reference_image_url,
    prompt_word_target: shot.prompt_word_target ?? 60,
  };
}

type CompiledResult = {
  compiled_prompt: string;
  negative_prompt: string;
  audio_prompt: string | null;
  seed: number | null;
  warnings: string[];
};

function GenerateClipDialog({
  shot,
  briefId,
  brandLockedSeed,
  existingVersionCount,
  prefill,
  lockTier,
  onClose,
  onSubmitted,
}: {
  shot: ShotRow;
  briefId: string | null;
  brandLockedSeed: number | null;
  existingVersionCount: number;
  // Pre-populated from a sibling asset when promoting a draft → final.
  prefill?: {
    prompt: string;
    negative: string | null;
    audio: string | null;
    seed: number | null;
    familyKey?: string;
  } | null;
  lockTier?: RenderTier;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const initialMethod: "text-to-video" | "image-to-video" =
    shot.generation_method === "image-to-video" ? "image-to-video" : "text-to-video";
  const [method, setMethod] = useState(initialMethod);

  // Pick the family best matching the shot's storyboard assigned_tool if possible.
  const initialFamilyKey = useMemo(() => {
    if (prefill?.familyKey) {
      const f = MODEL_FAMILIES.find((x) => x.key === prefill.familyKey);
      if (f) return f.key;
    }
    const matchTool = shot.assigned_tool ?? "";
    const m =
      MODEL_FAMILIES.find(
        (x) => x.method === initialMethod && x.compileTool === matchTool,
      ) ?? MODEL_FAMILIES.find((x) => x.method === initialMethod);
    return (m ?? MODEL_FAMILIES[0]).key;
  }, [shot.assigned_tool, initialMethod, prefill?.familyKey]);

  const [familyKey, setFamilyKey] = useState<string>(initialFamilyKey);
  const [tier, setTier] = useState<RenderTier>(lockTier ?? "draft");

  const availableFamilies = MODEL_FAMILIES.filter((f) => f.method === method);
  const selectedFamily: ModelFamily =
    availableFamilies.find((f) => f.key === familyKey) ?? availableFamilies[0];
  const selectedVariant: TierVariant =
    tier === "final" ? selectedFamily.final : selectedFamily.draft;

  // Editable compiled prompt fields. We populate on mount + on model change via
  // compile_prompt; user can refine before spending credits.
  const [compiling, setCompiling] = useState(false);
  const [compiledPrompt, setCompiledPrompt] = useState(prefill?.prompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState(prefill?.negative ?? "");
  const [audioPrompt, setAudioPrompt] = useState(prefill?.audio ?? "");
  const [seed, setSeed] = useState<string>(() => {
    if (prefill && prefill.seed != null) return String(prefill.seed);
    const s = shot.seed ?? brandLockedSeed;
    return s != null ? String(s) : "";
  });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [referenceUrl, setReferenceUrl] = useState<string>(
    shot.reference_image_url ?? "",
  );
  const [aspect, setAspect] = useState<string>("9:16");
  const duration = shot.duration_seconds ?? 8;
  const [busy, setBusy] = useState(false);

  // Pull-down or compile from slots for this target model.
  const ensureCompiled = async (forceRecompile = false) => {
    const tool = selectedFamily.compileTool;
    const isFresh =
      !!shot.compiled_prompt &&
      shot.compiled_for_tool === tool &&
      !!shot.compiled_at;
    if (!forceRecompile && isFresh) {
      // Hydrate from the stored compiled output.
      setCompiledPrompt(shot.compiled_prompt ?? "");
      setNegativePrompt(shot.compiled_negative ?? "");
      setAudioPrompt(selectedFamily.supportsAudio ? (shot.compiled_audio ?? "") : "");
      setWarnings([]);
      return;
    }
    setCompiling(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: { task: "compile_prompt", payload: buildCompilePayload(shot, tool) },
      });
      if (error) throw new Error(error.message);
      const result = (data as { result?: Record<string, unknown> } | null)?.result;
      if (!result || typeof result !== "object")
        throw new Error("Empty compile response");
      const cp = String(result.compiled_prompt ?? "").trim();
      const np = String(result.negative_prompt ?? "").trim();
      const ap = result.audio_prompt;
      const apStr =
        typeof ap === "string" && ap.trim() ? ap.trim() : "";
      const seedFromAi = typeof result.seed === "number" ? result.seed : null;
      const warns = Array.isArray(result.warnings)
        ? (result.warnings as unknown[]).filter((w) => typeof w === "string").map(String)
        : [];
      setCompiledPrompt(cp);
      setNegativePrompt(np);
      setAudioPrompt(selectedFamily.supportsAudio ? apStr : "");
      setWarnings(warns);
      if (!seed && seedFromAi != null) setSeed(String(seedFromAi));

      // Persist on the shot so subsequent opens are instant.
      await supabase
        .from("shots")
        .update({
          compiled_prompt: cp || null,
          compiled_negative: np || null,
          compiled_audio: apStr || null,
          compiled_for_tool: tool,
          compiled_at: new Date().toISOString(),
        })
        .eq("id", shot.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compile failed");
      // Fall back to slot-free human description so the user can still proceed.
      if (!compiledPrompt) setCompiledPrompt(shot.visual_description ?? "");
    } finally {
      setCompiling(false);
    }
  };

  // Initial compile (or hydrate) on open / when model changes.
  useEffect(() => {
    void ensureCompiled(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyKey]);

  const wordCount = compiledPrompt.trim().split(/\s+/).filter(Boolean).length;
  const wordTarget = shot.prompt_word_target ?? 60;
  const wcColor =
    wordCount === 0
      ? "text-muted-foreground"
      : wordCount <= wordTarget
        ? "text-emerald-700"
        : wordCount <= 90
          ? "text-amber-700"
          : "text-[var(--color-rec)]";

  const blockingReferenceMissing =
    method === "image-to-video" && !referenceUrl.trim();

  const submit = async () => {
    if (!compiledPrompt.trim()) {
      toast.error("Compiled prompt is empty. Compile from the shot's slots first.");
      return;
    }
    if (blockingReferenceMissing) {
      toast.error("Image-to-video requires an anchor / reference image. Add one above.");
      return;
    }
    const seedNum = seed.trim() === "" ? null : Number(seed);
    if (seedNum != null && (!Number.isFinite(seedNum) || seedNum < 0)) {
      toast.error("Seed must be a non-negative integer.");
      return;
    }
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Not signed in.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("generate-clip", {
        body: {
          shot_id: shot.id,
          brief_id: briefId,
          prompt: compiledPrompt.trim(),
          negative_prompt: negativePrompt.trim() || null,
          audio_prompt:
            selectedFamily.supportsAudio && audioPrompt.trim()
              ? audioPrompt.trim()
              : null,
          seed: seedNum != null ? Math.floor(seedNum) : null,
          generation_method: method,
          reference_image_url:
            method === "image-to-video" ? referenceUrl.trim() : null,
          duration_seconds: duration,
          aspect_ratio: aspect,
          model_id: selectedVariant.id,
          tool_used: `${selectedFamily.label} · ${selectedVariant.label}`,
          render_tier: tier,
          cost_estimate: estimateCost(selectedVariant, duration),
          version: existingVersionCount + 1,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) {
        const ctxRes = (error as unknown as { context?: { response?: Response } })
          .context?.response;
        if (ctxRes) {
          const parsed = await ctxRes.clone().json().catch(() => null);
          const detailText =
            parsed?.detail && typeof parsed.detail === "string"
              ? parsed.detail
              : typeof parsed?.detail === "object"
                ? JSON.stringify(parsed.detail)
                : null;
          throw new Error(
            [parsed?.error, detailText].filter(Boolean).join(" — ") ||
              error.message,
          );
        }
        throw error;
      }
      const errPayload = (data as { error?: string } | null)?.error;
      if (errPayload) throw new Error(errPayload);
      toast.success("Generation queued");
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/exhausted balance|user is locked/i.test(msg)) {
        toast.error("fal.ai balance exhausted. Top up at fal.ai/dashboard/billing.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Generate · Shot {shot.shot_number ?? "—"}
          </DialogTitle>
          <DialogDescription>
            Review the compiled prompt before spending. Edits below are saved
            on the resulting take so you can compare versions later.
          </DialogDescription>
        </DialogHeader>

        {/* Method */}
        <div className="flex gap-2 flex-wrap">
          {(["text-to-video", "image-to-video"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethod(m);
                const next = MODEL_FAMILIES.find((x) => x.method === m);
                if (next) setFamilyKey(next.key);
              }}
              className={cn(
                "label-mono px-2 py-1 border rounded-[2px]",
                method === m
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "text-to-video" ? "Text → Video" : "Image → Video"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="label-mono mb-1">Model family</p>
            <Select value={familyKey} onValueChange={setFamilyKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableFamilies.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="label-mono mb-1">Compiled for</p>
            <div className="h-9 px-2 flex items-center border border-border rounded-[3px] bg-background font-mono text-xs">
              {selectedFamily.compileTool}
            </div>
          </div>
        </div>

        {/* Tier toggle */}
        <div className="border border-border rounded-[3px] p-3 bg-background">
          <p className="label-mono mb-2">Render tier</p>
          <div className="grid grid-cols-2 gap-2">
            {(["draft", "final"] as const).map((t) => {
              const v = t === "draft" ? selectedFamily.draft : selectedFamily.final;
              const active = tier === t;
              const disabled = lockTier != null && lockTier !== t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTier(t)}
                  className={cn(
                    "text-left p-2 border rounded-[2px] transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/50",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <div className="label-mono">
                    {t === "draft" ? "Draft · cheap iteration" : "Final · flagship render"}
                  </div>
                  <div className="font-mono text-[10px] mt-1 opacity-80">
                    {v.label} · ~${estimateCost(v, duration).toFixed(2)} / {duration}s
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-mono">
            model_id: {selectedVariant.id}
          </p>
        </div>

        {/* Anchor image — required & blocking for I2V */}
        {method === "image-to-video" && (
          <div>
            <p className="label-mono mb-1">
              Anchor / reference image URL <span className="text-[var(--color-rec)]">*</span>
            </p>
            <Input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://…"
              className={cn(blockingReferenceMissing && "border-[var(--color-rec)]")}
            />
            {blockingReferenceMissing && (
              <p className="text-xs text-[var(--color-rec)] mt-1">
                Image-to-video can't run without an anchor frame. Add one in Storyboard
                or paste a URL here.
              </p>
            )}
          </div>
        )}

        {/* Compiled prompt block */}
        <div className="border border-border rounded-[3px] p-3 bg-background space-y-3">
          <div className="flex items-center justify-between">
            <p className="label-mono">Compiled prompt</p>
            <div className="flex items-center gap-2">
              <span className={cn("font-mono text-[10px]", wcColor)}>
                {wordCount}w / target {wordTarget}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void ensureCompiled(true)}
                disabled={compiling}
              >
                {compiling ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Recompile
              </Button>
            </div>
          </div>
          <Textarea
            rows={5}
            value={compiledPrompt}
            onChange={(e) => setCompiledPrompt(e.target.value)}
            placeholder={compiling ? "Compiling from slots…" : "Compiled prompt will appear here."}
          />

          <div>
            <p className="label-mono mb-1">Negative prompt</p>
            <Textarea
              rows={2}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="What to avoid…"
            />
          </div>

          {selectedFamily.supportsAudio && (
            <div>
              <p className="label-mono mb-1">Audio prompt (Veo)</p>
              <Textarea
                rows={2}
                value={audioPrompt}
                onChange={(e) => setAudioPrompt(e.target.value)}
                placeholder="e.g. soft ambient room tone, footsteps on tile"
              />
            </div>
          )}

          {warnings.length > 0 && (
            <ul className="text-xs text-[var(--color-rec)] space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="label-mono mb-1">Aspect ratio</p>
            <Select value={aspect} onValueChange={setAspect}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["9:16", "16:9", "1:1", "4:5"].map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="label-mono mb-1">Duration</p>
            <Input value={`${duration}s`} disabled />
          </div>
          <div>
            <p className="label-mono mb-1 flex items-center justify-between">
              <span>Seed</span>
              {brandLockedSeed != null && (
                <button
                  type="button"
                  onClick={() => setSeed(String(brandLockedSeed))}
                  className="font-mono text-[9px] text-muted-foreground hover:text-foreground"
                  title="Use brand Style Bible seed"
                >
                  brand: {brandLockedSeed}
                </button>
              )}
            </p>
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={brandLockedSeed != null ? `${brandLockedSeed}` : "auto"}
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="border border-border rounded-[2px] bg-background p-3 text-xs text-muted-foreground">
          About{" "}
          <span className="font-mono text-foreground">
            ~${estimateCost(selectedVariant, duration).toFixed(2)}
          </span>{" "}
          in API credits ({tier} tier · {selectedVariant.label}). You'll be charged by fal.ai when the job runs.
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={busy || compiling || blockingReferenceMissing || !compiledPrompt.trim()}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Generate voiceover dialog (ElevenLabs) ==============

const ELEVEN_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel · narrator" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George · warm male" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah · friendly" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni · upbeat" },
  { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli · young female" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh · deep male" },
] as const;

function GenerateVoiceoverDialog({
  briefId,
  defaultSourceText,
  onClose,
  onSaved,
}: {
  briefId: string;
  defaultSourceText: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [voice, setVoice] = useState<string>(ELEVEN_VOICES[0].id);
  const [text, setText] = useState(defaultSourceText);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) {
      toast.error("Add text to read.");
      return;
    }
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Not signed in.");
        return;
      }
      const voiceMeta = ELEVEN_VOICES.find((v) => v.id === voice);
      const { data, error } = await supabase.functions.invoke("generate-voiceover", {
        body: {
          brief_id: briefId,
          source_text: text,
          voice_id: voice,
          voice_label: voiceMeta
            ? `ElevenLabs · ${voiceMeta.label.split(" · ")[0]}`
            : "ElevenLabs",
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      const errPayload = (data as { error?: string } | null)?.error;
      if (errPayload) throw new Error(errPayload);
      toast.success("Voiceover generated");
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const approxCost = Math.round(text.length * 0.0003 * 100) / 100;

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Generate voiceover</DialogTitle>
          <DialogDescription>
            Generate spoken audio with ElevenLabs and attach it to this brief.
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="label-mono mb-1">Voice</p>
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ELEVEN_VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="label-mono mb-1">Script</p>
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or edit the line you want spoken…"
          />
          <p className="font-mono text-[10px] text-muted-foreground mt-1">
            {text.length} chars · ~${approxCost.toFixed(2)}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}