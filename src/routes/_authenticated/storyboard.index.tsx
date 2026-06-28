import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getCampaignSignedUrls,
  uploadCampaignFile,
} from "@/lib/campaign-assets";

type ScriptStatus = "draft" | "approved" | "archived";
type GenMethod = "text-to-video" | "image-to-video";

const CAMERA_MOVES = [
  "Static",
  "Push in",
  "Pull out",
  "Pan",
  "Tilt",
  "Tracking",
  "Handheld",
  "Orbit",
] as const;

const TOOLS = [
  "Veo 3.1",
  "Kling 3.0",
  "Runway Gen-4.5",
  "Arcads",
  "HeyGen",
  "Synthesia",
  "Luma Ray3",
] as const;

const TOOL_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  "Veo 3.1":       { bg: "bg-[#E0301E]/10",   text: "text-[#E0301E]",   border: "border-[#E0301E]/40" },
  "Kling 3.0":     { bg: "bg-sky-700/10",     text: "text-sky-800",     border: "border-sky-700/40" },
  "Runway Gen-4.5":{ bg: "bg-purple-700/10",  text: "text-purple-800",  border: "border-purple-700/40" },
  "Arcads":        { bg: "bg-emerald-700/10", text: "text-emerald-800", border: "border-emerald-700/40" },
  "HeyGen":        { bg: "bg-amber-700/10",   text: "text-amber-800",   border: "border-amber-700/40" },
  "Synthesia":     { bg: "bg-rose-700/10",    text: "text-rose-800",    border: "border-rose-700/40" },
  "Luma Ray3":     { bg: "bg-indigo-700/10",  text: "text-indigo-800",  border: "border-indigo-700/40" },
};

const ROUTING_GUIDE: Array<{ tool: string; desc: string }> = [
  { tool: "Veo 3.1", desc: "Cinematic hero shots, native synced audio, 4K. Quality over volume." },
  { tool: "Kling 3.0", desc: "High volume / variants, cheap, multilingual lip-sync, high motion." },
  { tool: "Runway Gen-4.5", desc: "Tight creative control: camera moves, motion brush, reference consistency." },
  { tool: "Arcads", desc: "AI UGC / talking-head ads for paid social." },
  { tool: "HeyGen", desc: "Avatar / spokesperson lip-sync." },
  { tool: "Synthesia", desc: "Avatar / spokesperson lip-sync." },
  { tool: "Luma Ray3", desc: "Image-to-video from a reference frame." },
];

type ScriptLite = {
  id: string;
  archetype: string | null;
  hook: string | null;
  status: ScriptStatus;
  angle: {
    id: string;
    title: string;
    brief: {
      id: string;
      project_name: string;
      brand: { id: string; name: string } | null;
    } | null;
  } | null;
};

type ScriptFull = ScriptLite & {
  duration_seconds: number | null;
  target_duration: number | null;
  on_screen_text: string | null;
  vo_script: string | null;
  desire_beat: string | null;
  body: string | null;
  proof_beat: string | null;
  cta: string | null;
  angle: (ScriptLite["angle"] & {
    brief:
      | (NonNullable<NonNullable<ScriptLite["angle"]>["brief"]> & {
          product_asset_urls: unknown;
          product_name: string | null;
          product_description: string | null;
          brand:
            | (NonNullable<
                NonNullable<NonNullable<ScriptLite["angle"]>["brief"]>["brand"]
              > & {
                fonts: string | null;
                primary_color: string | null;
                secondary_color: string | null;
                no_go_list: string | null;
              })
            | null;
        })
      | null;
  }) | null;
};

type ShotRow = {
  id: string;
  script_id: string;
  shot_number: number | null;
  visual_description: string | null;
  camera_move: string | null;
  motion_intensity: string | null;
  duration_seconds: number | null;
  audio_note: string | null;
  assigned_tool: string | null;
  reference_notes: string | null;
  generation_method: GenMethod;
  reference_image_url: string | null;
  tool_reason: string | null;
  caption_text: string | null;
};

type DraftShot = {
  key: string;
  shot_number: number;
  visual_description: string;
  camera_move: string;
  motion_intensity: string;
  duration_seconds: number;
  generation_method: GenMethod;
  assigned_tool: string;
  tool_reason: string;
  caption_text: string;
  audio_note: string;
};

const MOTION_OPTIONS = ["Subtle", "Moderate", "Dynamic"] as const;

const searchSchema = z.object({
  script: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/storyboard/")({
  validateSearch: searchSchema,
  component: StoryboardWorkspace,
});

function ToolChip({ tool }: { tool: string | null }) {
  if (!tool) return <span className="label-mono text-muted-foreground/60">No tool</span>;
  const c = TOOL_COLOR[tool] ?? { bg: "bg-muted", text: "text-foreground", border: "border-border" };
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
        c.bg, c.text, c.border,
      )}
    >
      {tool}
    </span>
  );
}

function GenChip({ method }: { method: GenMethod }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
        method === "image-to-video"
          ? "bg-foreground text-background border-foreground"
          : "bg-background text-foreground/80 border-border",
      )}
    >
      {method}
    </span>
  );
}

function MotionChip({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px] bg-background text-foreground/80">
      motion · {value}
    </span>
  );
}

function CameraChip({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px] bg-background text-foreground/80">
      {value}
    </span>
  );
}

function StoryboardWorkspace() {
  const { script: scriptParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [scripts, setScripts] = useState<ScriptLite[] | null>(null);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [selectedScript, setSelectedScript] = useState<ScriptFull | null>(null);
  const [shots, setShots] = useState<ShotRow[] | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShotRow | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);

  // AI shot-list draft state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDrafts, setAiDrafts] = useState<DraftShot[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // signed URLs cache for both brief product assets and shot reference images
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("scripts")
        .select(
          "id, archetype, hook, status, angle:angles(id, title, brief:briefs(id, project_name, brand:brands(id, name)))",
        )
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      setScripts((data as unknown as ScriptLite[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!scriptParam) {
      setSelectedScript(null);
      setShots(null);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("scripts")
        .select(
          "id, archetype, hook, status, duration_seconds, target_duration, on_screen_text, vo_script, desire_beat, body, proof_beat, cta, angle:angles(id, title, brief:briefs(id, project_name, product_asset_urls, product_name, product_description, brand:brands(id, name, fonts, primary_color, secondary_color, no_go_list)))",
        )
        .eq("id", scriptParam)
        .maybeSingle();
      if (alive) setSelectedScript((data as unknown as ScriptFull) ?? null);
    })();
    return () => { alive = false; };
  }, [scriptParam]);

  const loadShots = async (scriptId: string) => {
    const { data } = await supabase
      .from("shots")
      .select(
        "id, script_id, shot_number, visual_description, camera_move, motion_intensity, duration_seconds, audio_note, assigned_tool, reference_notes, generation_method, reference_image_url, tool_reason, caption_text",
      )
      .eq("script_id", scriptId)
      .order("shot_number", { ascending: true })
      .order("created_at", { ascending: true });
    setShots((data as unknown as ShotRow[]) ?? []);
  };

  useEffect(() => {
    if (scriptParam) loadShots(scriptParam);
  }, [scriptParam]);

  const productAssetPaths = useMemo(() => {
    const a = selectedScript?.angle?.brief?.product_asset_urls as unknown;
    if (!a) return [] as string[];
    if (Array.isArray(a)) return a.filter((x) => typeof x === "string") as string[];
    return [];
  }, [selectedScript]);

  // Resolve signed URLs for product assets + shot reference images
  useEffect(() => {
    const all = new Set<string>();
    productAssetPaths.forEach((p) => all.add(p));
    shots?.forEach((s) => {
      if (s.reference_image_url) all.add(s.reference_image_url);
    });
    const needed = Array.from(all).filter((p) => !imageUrls[p]);
    if (needed.length === 0) return;
    (async () => {
      const next = await getCampaignSignedUrls(needed);
      setImageUrls((prev) => ({ ...prev, ...next }));
    })();
  }, [productAssetPaths, shots, imageUrls]);

  const filteredScripts = useMemo(() => {
    if (!scripts) return [];
    const s = search.trim().toLowerCase();
    const sorted = [...scripts].sort((a, b) => {
      const rank = (st: string) => (st === "approved" ? 0 : st === "draft" ? 1 : 2);
      return rank(a.status) - rank(b.status);
    });
    if (!s) return sorted;
    return sorted.filter(
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

  const selectScript = (id: string) => {
    navigate({ search: { script: id } });
    setPickerOpen(false);
  };

  const totalDuration = useMemo(
    () => (shots ?? []).reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0),
    [shots],
  );
  const targetDuration =
    selectedScript?.target_duration ?? selectedScript?.duration_seconds ?? null;

  const timingState: "good" | "warn" | "bad" = useMemo(() => {
    if (!targetDuration || targetDuration <= 0) return "warn";
    const diff = Math.abs(totalDuration - targetDuration);
    const pct = diff / targetDuration;
    if (pct <= 0.15) return "good";
    if (pct <= 0.4) return "warn";
    return "bad";
  }, [totalDuration, targetDuration]);

  const longShots = (shots ?? []).filter((s) => (s.duration_seconds ?? 0) > 10);

  const reorder = async (shot: ShotRow, dir: -1 | 1) => {
    if (!shots) return;
    const idx = shots.findIndex((s) => s.id === shot.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= shots.length) return;
    const next = [...shots];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const renum = next.map((s, i) => ({ ...s, shot_number: i + 1 }));
    setShots(renum);
    await Promise.all(
      renum.map((s) =>
        supabase.from("shots").update({ shot_number: s.shot_number }).eq("id", s.id),
      ),
    );
  };

  const duplicate = async (shot: ShotRow) => {
    if (!selectedScript) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const nextNumber = (shots?.length ?? 0) + 1;
    const payload = {
      script_id: selectedScript.id,
      user_id: userId,
      shot_number: nextNumber,
      visual_description: shot.visual_description,
      camera_move: shot.camera_move,
      motion_intensity: shot.motion_intensity,
      duration_seconds: shot.duration_seconds,
      audio_note: shot.audio_note,
      assigned_tool: shot.assigned_tool,
      reference_notes: shot.reference_notes,
      generation_method: shot.generation_method,
      reference_image_url: shot.reference_image_url,
      tool_reason: shot.tool_reason,
      caption_text: shot.caption_text,
    };
    const { error } = await supabase.from("shots").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Shot duplicated");
    await loadShots(selectedScript.id);
  };

  const removeShot = async (shot: ShotRow) => {
    const { error } = await supabase.from("shots").delete().eq("id", shot.id);
    if (error) { toast.error(error.message); return; }
    if (selectedScript) {
      // Renumber remaining
      const remaining = (shots ?? []).filter((s) => s.id !== shot.id);
      const renum = remaining.map((s, i) => ({ ...s, shot_number: i + 1 }));
      setShots(renum);
      await Promise.all(
        renum.map((s) =>
          supabase.from("shots").update({ shot_number: s.shot_number }).eq("id", s.id),
        ),
      );
    }
    toast.success("Shot removed");
  };

  // ---- AI: Build shot list ----
  const canBuildShotlist = Boolean(
    selectedScript && (selectedScript.hook?.trim() || selectedScript.body?.trim()),
  );

  const buildShotlist = async () => {
    if (!selectedScript) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const brand = selectedScript.angle?.brief?.brand;
      const visualBits = [
        brand?.fonts ? `Fonts: ${brand.fonts}` : null,
        brand?.primary_color ? `Primary: ${brand.primary_color}` : null,
        brand?.secondary_color ? `Secondary: ${brand.secondary_color}` : null,
      ].filter(Boolean);
      const payload = {
        archetype: selectedScript.archetype,
        hook: selectedScript.hook,
        desire_beat: selectedScript.desire_beat,
        body: selectedScript.body,
        proof_beat: selectedScript.proof_beat,
        cta: selectedScript.cta,
        vo_script: selectedScript.vo_script,
        on_screen_text: selectedScript.on_screen_text,
        target_duration: selectedScript.target_duration,
        estimated_duration: selectedScript.duration_seconds,
        product_name: selectedScript.angle?.brief?.product_name ?? null,
        product_description: selectedScript.angle?.brief?.product_description ?? null,
        has_product_images: productAssetPaths.length > 0,
        brand_visual_notes: visualBits.join(" · ") || null,
        no_go_list: brand?.no_go_list ?? null,
      };
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: { task: "build_shotlist", payload },
      });
      if (error) throw new Error(error.message);
      const err = (data as { error?: string } | null)?.error;
      if (err) throw new Error(err);
      const result = (data as { result?: { shots?: unknown[] } } | null)?.result;
      const raw = Array.isArray(result?.shots) ? result!.shots! : [];
      if (raw.length === 0) throw new Error("AI returned no shots. Try again.");
      const drafts: DraftShot[] = raw.map((s, i) => {
        const o = (s ?? {}) as Record<string, unknown>;
        const motion = String(o.motion_intensity ?? "Moderate");
        const camera = String(o.camera_move ?? "Static");
        const tool = String(o.assigned_tool ?? "");
        const gm = (o.generation_method === "image-to-video"
          ? "image-to-video"
          : "text-to-video") as GenMethod;
        const dur = Number(o.duration_seconds);
        return {
          key: `ai-${Date.now()}-${i}`,
          shot_number: Number(o.shot_number) || i + 1,
          visual_description: String(o.visual_description ?? ""),
          camera_move: (CAMERA_MOVES as readonly string[]).includes(camera) ? camera : "Static",
          motion_intensity: (MOTION_OPTIONS as readonly string[]).includes(motion) ? motion : "Moderate",
          duration_seconds: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 6,
          generation_method: gm,
          assigned_tool: (TOOLS as readonly string[]).includes(tool) ? tool : tool,
          tool_reason: String(o.tool_reason ?? ""),
          caption_text: String(o.caption_text ?? ""),
          audio_note: String(o.audio_note ?? ""),
        };
      });
      setAiDrafts(drafts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI request failed";
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const updateDraft = (key: string, patch: Partial<DraftShot>) => {
    setAiDrafts((prev) => prev?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? null);
  };

  const dismissDraft = (key: string) => {
    setAiDrafts((prev) => {
      const next = (prev ?? []).filter((d) => d.key !== key);
      return next.length === 0 ? null : next;
    });
  };

  const commitDrafts = async (drafts: DraftShot[]) => {
    if (!selectedScript || drafts.length === 0) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { toast.error("Not signed in"); return; }
    const startAt = (shots?.length ?? 0) + 1;
    const rows = drafts.map((d, i) => ({
      script_id: selectedScript.id,
      user_id: userId,
      shot_number: startAt + i,
      visual_description: d.visual_description.trim() || null,
      camera_move: d.camera_move || null,
      motion_intensity: d.motion_intensity || null,
      duration_seconds: d.duration_seconds || null,
      generation_method: d.generation_method,
      reference_image_url: null,
      assigned_tool: d.assigned_tool || null,
      tool_reason: d.tool_reason.trim() || null,
      caption_text: d.caption_text.trim() || null,
      audio_note: d.audio_note.trim() || null,
    }));
    const { error } = await supabase.from("shots").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(drafts.length === 1 ? "Shot added" : `${drafts.length} shots added`);
    const remainingKeys = new Set(drafts.map((d) => d.key));
    setAiDrafts((prev) => {
      const next = (prev ?? []).filter((d) => !remainingKeys.has(d.key));
      return next.length === 0 ? null : next;
    });
    await loadShots(selectedScript.id);
  };

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="label-mono mb-2">Phase 03 · Pre-production</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Storyboard</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-xl">
          Translate the script into a shot sequence, with each shot routed to the right tool.
        </p>
      </div>

      {/* Script selector */}
      <div className="border border-border rounded-[3px] bg-card p-4 mb-6 flex flex-wrap items-center gap-4">
        <span className="label-mono">Script</span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex-1 min-w-[320px] flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 rounded-[3px] text-sm hover:border-foreground/40 transition-colors"
            >
              {selectedScript ? (
                <span className="flex items-center gap-2 truncate">
                  <span className="text-muted-foreground truncate">
                    {selectedScript.angle?.brief?.brand?.name ?? "—"} · {selectedScript.angle?.brief?.project_name ?? "—"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium truncate">
                    {selectedScript.hook?.split("\n")[0] || "Untitled script"}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">Select a script…</span>
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
                  No scripts match.
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
                        onClick={() => selectScript(s.id)}
                        className="w-full text-left px-3 py-2 hover:bg-background/60 border-b border-border/60 last:border-b-0 flex items-center gap-2"
                      >
                        {s.archetype && (
                          <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px] shrink-0">
                            {s.archetype}
                          </span>
                        )}
                        <span className="text-sm flex-1 truncate">
                          {s.hook?.split("\n")[0] || (
                            <span className="text-muted-foreground italic">Untitled</span>
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

      {!selectedScript ? (
        <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
          <p className="label-mono mb-3">No script selected</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Pick an approved script above to start storyboarding.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <section>
            {/* Script strip */}
            <div className="border border-border bg-foreground text-background rounded-[3px] px-5 py-4 mb-5 flex items-center gap-4 flex-wrap">
              <span className="label-mono text-background/70">Script</span>
              {selectedScript.archetype && (
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-background/40 rounded-[2px]">
                  {selectedScript.archetype}
                </span>
              )}
              <p className="font-display text-base font-bold leading-snug flex-1 min-w-[200px] truncate">
                {selectedScript.hook?.split("\n")[0] || "Untitled script"}
              </p>
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-background/40 rounded-[2px]">
                target {selectedScript.target_duration ?? "—"}s
              </span>
            </div>

            {/* Timing check */}
            <TimingStrip
              total={totalDuration}
              target={targetDuration}
              state={timingState}
              longShots={longShots.length}
            />

            {/* Shot list */}
            <div className="flex items-center justify-between mt-6 mb-3">
              <p className="label-mono">Shots</p>
              <Button
                size="sm"
                onClick={() => { setEditing(null); setFormOpen(true); }}
              >
                <Plus className="h-4 w-4" />
                New shot
              </Button>
            </div>

            {shots === null ? (
              <div className="border border-border rounded-[3px] bg-card animate-pulse h-48" />
            ) : shots.length === 0 ? (
              <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-12 text-center">
                <p className="label-mono mb-3">No shots yet</p>
                <p className="text-sm text-muted-foreground mb-5">
                  Break the script into a numbered shot sequence.
                </p>
                <Button
                  size="sm"
                  onClick={() => { setEditing(null); setFormOpen(true); }}
                >
                  <Plus className="h-4 w-4" />
                  New shot
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {shots.map((shot, i) => (
                  <ShotRowCard
                    key={shot.id}
                    shot={shot}
                    index={i}
                    total={shots.length}
                    imageUrls={imageUrls}
                    onMoveUp={() => reorder(shot, -1)}
                    onMoveDown={() => reorder(shot, 1)}
                    onEdit={() => { setEditing(shot); setFormOpen(true); }}
                    onDuplicate={() => duplicate(shot)}
                    onRemove={() => removeShot(shot)}
                  />
                ))}
              </div>
            )}

            {/* Send to generation */}
            {shots && shots.length > 0 && (
              <div className="mt-8 flex justify-end">
                <Button asChild>
                  <Link
                    to="/generation"
                    search={{ script: selectedScript.id }}
                  >
                    <Send className="h-4 w-4" />
                    Send to generation
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </section>

          {/* RIGHT: routing guide */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="border border-border rounded-[3px] bg-card">
              <button
                onClick={() => setGuideOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-border"
              >
                <span className="label-mono">Who makes what</span>
                {guideOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {guideOpen && (
                <div className="p-4 space-y-3 text-sm">
                  {ROUTING_GUIDE.map((r) => (
                    <div key={r.tool}>
                      <ToolChip tool={r.tool} />
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {r.desc}
                      </p>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground italic border-t border-border pt-3 mt-3 leading-relaxed">
                    Iterate cheap, render expensive — concept on lite tiers, final-render the winners on flagship. Keep single shots ~5–8s; stitch short shots, don't generate one long clip.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {selectedScript && (
        <ShotFormDialog
          open={formOpen}
          onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
          script={selectedScript}
          existing={editing}
          nextNumber={(shots?.length ?? 0) + 1}
          productAssets={productAssetPaths}
          imageUrls={imageUrls}
          onResolveUrls={async (paths) => {
            const fresh = await getCampaignSignedUrls(paths);
            setImageUrls((p) => ({ ...p, ...fresh }));
          }}
          onSaved={async () => { await loadShots(selectedScript.id); }}
        />
      )}
    </div>
  );
}

/* ============================================================
   TIMING STRIP
   ============================================================ */

function TimingStrip({
  total,
  target,
  state,
  longShots,
}: {
  total: number;
  target: number | null;
  state: "good" | "warn" | "bad";
  longShots: number;
}) {
  const stateMeta = {
    good: { color: "bg-emerald-700 text-white border-emerald-700", caption: "On target." },
    warn: { color: "bg-amber-600 text-white border-amber-600", caption: target ? "Within range — tighten if you can." : "No script duration set yet." },
    bad: { color: "bg-[var(--color-rec)] text-white border-[var(--color-rec)]", caption: "Off target — re-time the shots." },
  }[state];

  return (
    <div className="border border-border rounded-[3px] bg-card p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="label-mono mb-1">Timing check</p>
          <p className="text-sm">
            <span className="font-mono font-semibold">Storyboard: {total}s</span>
            <span className="text-muted-foreground"> vs Script target: {target ?? "—"}{target ? "s" : ""}</span>
          </p>
        </div>
        <span className={cn(
          "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-1 border rounded-[2px]",
          stateMeta.color,
        )}>
          {stateMeta.caption}
        </span>
      </div>
      {longShots > 0 && (
        <p className="text-xs text-[var(--color-rec)] font-mono uppercase tracking-wider mt-3">
          {longShots} shot{longShots > 1 ? "s" : ""} over 10s — consider splitting.
        </p>
      )}
    </div>
  );
}

/* ============================================================
   SHOT ROW
   ============================================================ */

function ShotRowCard({
  shot,
  index,
  total,
  imageUrls,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  shot: ShotRow;
  index: number;
  total: number;
  imageUrls: Record<string, string>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const longShot = (shot.duration_seconds ?? 0) > 10;
  const refUrl = shot.reference_image_url ? imageUrls[shot.reference_image_url] : null;
  return (
    <article className="border border-border bg-card rounded-[3px] p-4 flex gap-4 items-start hover:border-foreground/40 transition-colors">
      {/* Slate badge */}
      <div className="shrink-0 w-14 h-14 border border-foreground rounded-[2px] flex flex-col items-center justify-center bg-foreground text-background">
        <span className="font-mono text-[9px] uppercase opacity-70">Shot</span>
        <span className="font-mono text-lg font-bold leading-none">
          {String(shot.shot_number ?? index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Reference thumb */}
      {shot.reference_image_url && (
        <div className="shrink-0 w-20 h-20 border border-border rounded-[2px] overflow-hidden bg-background flex items-center justify-center">
          {refUrl ? (
            <img src={refUrl} alt="Reference" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug mb-2 line-clamp-3">
          {shot.visual_description || (
            <span className="text-muted-foreground italic">No visual description yet</span>
          )}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <CameraChip value={shot.camera_move} />
          <MotionChip value={shot.motion_intensity} />
          <span className={cn(
            "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
            longShot ? "border-[var(--color-rec)] text-[var(--color-rec)] bg-[var(--color-rec)]/10" : "border-border text-foreground/80 bg-background",
          )}>
            {shot.duration_seconds ?? 0}s
          </span>
          <GenChip method={shot.generation_method} />
          <ToolChip tool={shot.assigned_tool} />
        </div>
        {shot.caption_text && (
          <p className="label-mono mt-2 text-foreground/70">
            on-screen · {shot.caption_text}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          onClick={onEdit}
          className="label-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <button
          onClick={onDuplicate}
          className="label-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Copy className="h-3 w-3" /> Duplicate
        </button>
        <button
          onClick={onRemove}
          className="label-mono text-muted-foreground hover:text-[var(--color-rec)] inline-flex items-center gap-1"
        >
          <X className="h-3 w-3" /> Remove
        </button>
      </div>
    </article>
  );
}

/* ============================================================
   SHOT FORM DIALOG
   ============================================================ */

function ShotFormDialog({
  open,
  onOpenChange,
  script,
  existing,
  nextNumber,
  productAssets,
  imageUrls,
  onResolveUrls,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  script: ScriptFull;
  existing: ShotRow | null;
  nextNumber: number;
  productAssets: string[];
  imageUrls: Record<string, string>;
  onResolveUrls: (paths: string[]) => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const [visual, setVisual] = useState("");
  const [camera, setCamera] = useState<string>("");
  const [motion, setMotion] = useState<number>(40);
  const [duration, setDuration] = useState<number>(6);
  const [genMethod, setGenMethod] = useState<GenMethod>("text-to-video");
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [assignedTool, setAssignedTool] = useState<string>("");
  const [toolReason, setToolReason] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [audioNote, setAudioNote] = useState("");
  const [referenceNotes, setReferenceNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert motion slider (0-100) to a label
  const motionLabel = motion < 25 ? "Subtle" : motion < 60 ? "Moderate" : motion < 85 ? "High" : "Dynamic";

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setVisual(existing.visual_description ?? "");
      setCamera(existing.camera_move ?? "");
      const mi = existing.motion_intensity;
      setMotion(
        mi === "Subtle" ? 15 :
        mi === "Moderate" ? 45 :
        mi === "High" ? 70 :
        mi === "Dynamic" ? 90 : 40,
      );
      setDuration(existing.duration_seconds ?? 6);
      setGenMethod(existing.generation_method);
      setReferenceImageUrl(existing.reference_image_url);
      setAssignedTool(existing.assigned_tool ?? "");
      setToolReason(existing.tool_reason ?? "");
      setCaptionText(existing.caption_text ?? "");
      setAudioNote(existing.audio_note ?? "");
      setReferenceNotes(existing.reference_notes ?? "");
    } else {
      setVisual("");
      setCamera("");
      setMotion(40);
      setDuration(6);
      setGenMethod("text-to-video");
      setReferenceImageUrl(null);
      setAssignedTool("");
      setToolReason("");
      setCaptionText("");
      setAudioNote("");
      setReferenceNotes("");
    }
    setError(null);
  }, [open, existing]);

  // When method is image-to-video, ensure asset URLs are resolved
  useEffect(() => {
    if (genMethod !== "image-to-video") return;
    if (productAssets.length === 0) return;
    const missing = productAssets.filter((p) => !imageUrls[p]);
    if (missing.length > 0) onResolveUrls(missing);
  }, [genMethod, productAssets, imageUrls, onResolveUrls]);

  const handleUpload = async (file: File) => {
    if (!script.angle?.brief?.id) {
      toast.error("No brief context — cannot upload.");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const path = await uploadCampaignFile(userId, script.angle.brief.id, file);
      await onResolveUrls([path]);
      setReferenceImageUrl(path);
      toast.success("Reference uploaded");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!visual.trim()) {
      setError("Visual description is required.");
      return;
    }
    setError(null);
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Not signed in");
      setSaving(false);
      return;
    }
    const payload = {
      script_id: script.id,
      user_id: userId,
      shot_number: existing?.shot_number ?? nextNumber,
      visual_description: visual.trim(),
      camera_move: camera || null,
      motion_intensity: motionLabel,
      duration_seconds: duration || null,
      generation_method: genMethod,
      reference_image_url: genMethod === "image-to-video" ? referenceImageUrl : null,
      assigned_tool: assignedTool || null,
      tool_reason: toolReason.trim() || null,
      caption_text: captionText.trim() || null,
      audio_note: audioNote.trim() || null,
      reference_notes: referenceNotes.trim() || null,
    };
    const { error: err } = existing
      ? await supabase.from("shots").update(payload).eq("id", existing.id)
      : await supabase.from("shots").insert(payload);
    setSaving(false);
    if (err) { toast.error(err.message); return; }
    toast.success(existing ? "Shot updated" : "Shot saved");
    await onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <p className="label-mono">
            {existing ? `Edit shot ${String(existing.shot_number ?? "").padStart(2, "0")}` : `New shot · ${String(nextNumber).padStart(2, "0")}`}
          </p>
          <DialogTitle className="font-display text-2xl">
            {existing ? "Edit shot" : "Add a shot"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <FormField label="Visual description" required error={error}>
            <Textarea
              value={visual}
              onChange={(e) => setVisual(e.target.value)}
              rows={3}
              placeholder="What we see in this shot."
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Camera move">
              <Select value={camera || undefined} onValueChange={setCamera}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a camera move" />
                </SelectTrigger>
                <SelectContent>
                  {CAMERA_MOVES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Duration (s)">
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
              {duration > 10 && (
                <p className="text-xs text-[var(--color-rec)] font-mono uppercase tracking-wider mt-1.5">
                  Long for a single AI clip — consider splitting.
                </p>
              )}
            </FormField>
          </div>

          <FormField label={`Motion intensity · ${motionLabel}`}>
            <Slider
              value={[motion]}
              onValueChange={(v) => setMotion(v[0] ?? 40)}
              min={0}
              max={100}
              step={1}
            />
            <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1.5">
              <span>Subtle</span>
              <span>Dynamic</span>
            </div>
          </FormField>

          <div className="border-t border-border pt-5">
            <p className="label-mono mb-2">Generation method</p>
            <div className="flex gap-2">
              {(["text-to-video", "image-to-video"] as GenMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setGenMethod(m)}
                  className={cn(
                    "flex-1 px-3 py-2 border rounded-[3px] text-sm font-mono uppercase tracking-wider transition-colors",
                    genMethod === m
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground/70 border-border hover:border-foreground/40",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            {genMethod === "image-to-video" && (
              <div className="mt-4 border border-border rounded-[3px] bg-background p-4">
                <p className="label-mono mb-3">Reference image</p>
                {productAssets.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">From the brief:</p>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {productAssets.map((path) => {
                        const url = imageUrls[path];
                        const isSelected = referenceImageUrl === path;
                        return (
                          <button
                            key={path}
                            type="button"
                            onClick={() => setReferenceImageUrl(path)}
                            className={cn(
                              "aspect-square border-2 rounded-[2px] overflow-hidden bg-background flex items-center justify-center transition-colors",
                              isSelected ? "border-[var(--color-rec)]" : "border-border hover:border-foreground/40",
                            )}
                          >
                            {url ? (
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload new
                  </Button>
                  {referenceImageUrl && (
                    <button
                      type="button"
                      onClick={() => setReferenceImageUrl(null)}
                      className="label-mono text-muted-foreground hover:text-[var(--color-rec)]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {referenceImageUrl && (
                  <p className="text-xs text-muted-foreground mt-3 font-mono truncate">
                    selected · {referenceImageUrl.split("/").pop()}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border pt-5">
            <FormField label="Assigned tool">
              <Select value={assignedTool || undefined} onValueChange={setAssignedTool}>
                <SelectTrigger>
                  <SelectValue placeholder="Route this shot" />
                </SelectTrigger>
                <SelectContent>
                  {TOOLS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tool reason">
              <Input
                value={toolReason}
                onChange={(e) => setToolReason(e.target.value)}
                placeholder="Why this tool"
              />
            </FormField>
          </div>

          <FormField label="Caption / on-screen text">
            <Textarea
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              rows={2}
              placeholder="What appears burned-in for this shot."
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Audio note">
              <Textarea
                value={audioNote}
                onChange={(e) => setAudioNote(e.target.value)}
                rows={2}
                placeholder="Music cue, SFX, VO direction"
              />
            </FormField>
            <FormField label="Reference notes">
              <Textarea
                value={referenceNotes}
                onChange={(e) => setReferenceNotes(e.target.value)}
                rows={2}
                placeholder="Look-and-feel references, lighting, palette"
              />
            </FormField>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {existing ? "Save changes" : "Save shot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
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