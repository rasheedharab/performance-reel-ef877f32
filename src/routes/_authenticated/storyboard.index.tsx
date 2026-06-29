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
  Wand2,
  AlertTriangle,
  Beaker,
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
                style_bibles:
                  | {
                      id: string;
                      film_look: string | null;
                      color_grade: string | null;
                      lighting_signature: string | null;
                      lens_feel: string | null;
                      motion_feel: string | null;
                      subject_tokens: string | null;
                      default_negative: string | null;
                      locked_seed: number | null;
                    }
                  | null
                  | Array<{
                      id: string;
                      film_look: string | null;
                      color_grade: string | null;
                      lighting_signature: string | null;
                      lens_feel: string | null;
                      motion_feel: string | null;
                      subject_tokens: string | null;
                      default_negative: string | null;
                      locked_seed: number | null;
                    }>;
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
  prompt_word_target: number | null;
  compiled_prompt: string | null;
  compiled_negative: string | null;
  compiled_audio: string | null;
  compiled_for_tool: string | null;
  compiled_at: string | null;
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
  const [abShot, setAbShot] = useState<ShotRow | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);

  // AI shot-list draft state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDrafts, setAiDrafts] = useState<DraftShot[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Prompt-compiler state
  const [compilingIds, setCompilingIds] = useState<Set<string>>(new Set());
  const [recompileTool, setRecompileTool] = useState<string>("");
  const [recompileAllRunning, setRecompileAllRunning] = useState(false);

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
          "id, archetype, hook, status, duration_seconds, target_duration, on_screen_text, vo_script, desire_beat, body, proof_beat, cta, angle:angles(id, title, brief:briefs(id, project_name, product_asset_urls, product_name, product_description, brand:brands(id, name, fonts, primary_color, secondary_color, no_go_list, style_bibles(id, film_look, color_grade, lighting_signature, lens_feel, motion_feel, subject_tokens, default_negative, locked_seed))))",
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
        "id, script_id, shot_number, visual_description, camera_move, motion_intensity, duration_seconds, audio_note, assigned_tool, reference_notes, generation_method, reference_image_url, tool_reason, caption_text, subject, subject_tokens, action, setting, lighting, lens, style_grade, mood, dialogue, sfx, ambient, negative_prompt, seed, prompt_word_target, compiled_prompt, compiled_negative, compiled_audio, compiled_for_tool, compiled_at",
      )
      .eq("script_id", scriptId)
      .order("shot_number", { ascending: true })
      .order("created_at", { ascending: true });
    setShots((data as unknown as ShotRow[]) ?? []);
  };

  useEffect(() => {
    if (scriptParam) loadShots(scriptParam);
  }, [scriptParam]);

  const compileOne = async (
    shot: ShotRow,
    overrideTool?: string,
  ): Promise<{ ok: boolean; warnings?: string[] }> => {
    const tool = (overrideTool || shot.assigned_tool || "").trim();
    if (!tool) {
      toast.error("Set a target model on this shot first.");
      return { ok: false };
    }
    setCompilingIds((prev) => {
      const n = new Set(prev);
      n.add(shot.id);
      return n;
    });
    try {
      const payload = {
        assigned_tool: tool,
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
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: { task: "compile_prompt", payload },
      });
      if (error) throw new Error(error.message);
      const result = (data as { result?: Record<string, unknown> } | null)?.result;
      if (!result || typeof result !== "object") throw new Error("Empty AI response");
      const compiled_prompt = String(result.compiled_prompt ?? "").trim();
      const compiled_negative = String(result.negative_prompt ?? "").trim();
      const audioRaw = result.audio_prompt;
      const compiled_audio =
        typeof audioRaw === "string" && audioRaw.trim() ? audioRaw.trim() : null;
      const warnings = Array.isArray(result.warnings)
        ? (result.warnings as unknown[]).filter((w) => typeof w === "string").map(String)
        : [];
      const { error: dbErr } = await supabase
        .from("shots")
        .update({
          compiled_prompt: compiled_prompt || null,
          compiled_negative: compiled_negative || null,
          compiled_audio,
          compiled_for_tool: tool,
          compiled_at: new Date().toISOString(),
          // Persist tool override if the user requested a recompile-for-X
          ...(overrideTool && overrideTool !== shot.assigned_tool
            ? { assigned_tool: overrideTool }
            : {}),
        })
        .eq("id", shot.id);
      if (dbErr) throw new Error(dbErr.message);
      return { ok: true, warnings };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Compile failed";
      toast.error(msg);
      return { ok: false };
    } finally {
      setCompilingIds((prev) => {
        const n = new Set(prev);
        n.delete(shot.id);
        return n;
      });
    }
  };

  const compileShot = async (shot: ShotRow) => {
    const r = await compileOne(shot);
    if (r.ok) {
      await loadShots(shot.script_id);
      if (r.warnings && r.warnings.length > 0) {
        toast.warning(`Compiled with ${r.warnings.length} warning(s).`);
      } else {
        toast.success("Prompt compiled.");
      }
    }
  };

  const recompileAll = async () => {
    if (!shots || shots.length === 0) return;
    const tool = recompileTool.trim();
    if (!tool) {
      toast.error("Pick a target model first.");
      return;
    }
    setRecompileAllRunning(true);
    let okCount = 0;
    let warnCount = 0;
    for (const s of shots) {
      const r = await compileOne(s, tool);
      if (r.ok) {
        okCount += 1;
        warnCount += r.warnings?.length ?? 0;
      }
    }
    setRecompileAllRunning(false);
    if (selectedScript) await loadShots(selectedScript.id);
    toast.success(`Recompiled ${okCount}/${shots.length} shots for ${tool}${warnCount ? ` · ${warnCount} warnings` : ""}.`);
  };

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
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={buildShotlist}
                  disabled={!canBuildShotlist || aiLoading}
                  title={!canBuildShotlist ? "Script needs a hook or body first" : "Have AI break this into a shot list"}
                >
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {aiLoading ? "Breaking it into shots…" : "Build shot list"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setEditing(null); setFormOpen(true); }}
                >
                  <Plus className="h-4 w-4" />
                  New shot
                </Button>
              </div>
            </div>

            {aiError && !aiLoading && (
              <div className="border border-[var(--color-rec)]/40 bg-[var(--color-rec)]/5 rounded-[3px] px-4 py-3 mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--color-rec)]">{aiError}</p>
                <button
                  onClick={() => setAiError(null)}
                  className="label-mono text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            )}

            {aiDrafts && aiDrafts.length > 0 && (
              <AiShotlistReview
                drafts={aiDrafts}
                onUpdate={updateDraft}
                onDismiss={dismissDraft}
                onAddOne={(d) => commitDrafts([d])}
                onAddAll={() => commitDrafts(aiDrafts)}
                onDismissAll={() => setAiDrafts(null)}
              />
            )}

            {shots && shots.length > 0 && (
              <div className="border border-border bg-card rounded-[3px] px-4 py-3 mb-3 flex flex-wrap items-center gap-3">
                <span className="label-mono">Recompile all shots for</span>
                <Select value={recompileTool || undefined} onValueChange={setRecompileTool}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="Target model…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOOLS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={recompileAll}
                  disabled={!recompileTool || recompileAllRunning}
                >
                  {recompileAllRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {recompileAllRunning ? "Recompiling…" : "Recompile sequence"}
                </Button>
                <span className="text-[11px] text-muted-foreground italic">
                  Re-runs the prompt compiler on every shot with the picked target model.
                </span>
              </div>
            )}

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
                    compiling={compilingIds.has(shot.id)}
                    onCompile={() => compileShot(shot)}
                    onMoveUp={() => reorder(shot, -1)}
                    onMoveDown={() => reorder(shot, 1)}
                    onEdit={() => { setEditing(shot); setFormOpen(true); }}
                    onDuplicate={() => duplicate(shot)}
                    onRemove={() => removeShot(shot)}
                    onAbTest={() => setAbShot(shot)}
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
  compiling,
  onCompile,
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
  compiling: boolean;
  onCompile: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const longShot = (shot.duration_seconds ?? 0) > 10;
  const refUrl = shot.reference_image_url ? imageUrls[shot.reference_image_url] : null;
  const hasCompiled = !!shot.compiled_prompt;
  const compiledStale =
    hasCompiled &&
    shot.assigned_tool &&
    shot.compiled_for_tool &&
    shot.assigned_tool !== shot.compiled_for_tool;
  return (
    <article className="border border-border bg-card rounded-[3px] p-4 hover:border-foreground/40 transition-colors">
    <div className="flex gap-4 items-start">
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
        <button
          onClick={onCompile}
          disabled={compiling || !shot.assigned_tool}
          title={!shot.assigned_tool ? "Pick a target model first" : "Compile prompt for this model"}
          className="label-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-40"
        >
          {compiling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="h-3 w-3" />
          )}
          {compiling ? "Compiling…" : hasCompiled ? "Recompile" : "Compile"}
        </button>
      </div>
    </div>

    <CompiledPromptPanel shot={shot} stale={!!compiledStale} />
    </article>
  );
}

function CompiledPromptPanel({
  shot,
  stale,
}: {
  shot: ShotRow;
  stale: boolean;
}) {
  if (!shot.compiled_prompt) return null;
  const target = shot.prompt_word_target ?? 60;
  const wc = shot.compiled_prompt.trim().split(/\s+/).filter(Boolean).length;
  const wcState =
    wc <= target ? "good" : wc <= 90 ? "warn" : "bad";
  const wcColor =
    wcState === "good"
      ? "text-emerald-700 border-emerald-700/40 bg-emerald-700/10"
      : wcState === "warn"
      ? "text-amber-700 border-amber-700/40 bg-amber-700/10"
      : "text-[var(--color-rec)] border-[var(--color-rec)]/40 bg-[var(--color-rec)]/10";
  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label-mono">Compiled prompt</span>
          {shot.compiled_for_tool && (
            <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px] text-muted-foreground">
              for {shot.compiled_for_tool}
            </span>
          )}
          <span className={cn(
            "font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px]",
            wcColor,
          )}>
            {wc}/{target} words
          </span>
          {stale && (
            <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-amber-700/40 bg-amber-700/10 text-amber-700 rounded-[2px]">
              stale · model changed
            </span>
          )}
        </div>
        {shot.compiled_at && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {new Date(shot.compiled_at).toLocaleString()}
          </span>
        )}
      </div>
      <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap bg-background border border-border rounded-[2px] p-3">
        {shot.compiled_prompt}
      </pre>
      {shot.compiled_audio && (
        <div>
          <p className="label-mono mb-1">Audio</p>
          <pre className="font-mono text-xs whitespace-pre-wrap bg-background border border-border rounded-[2px] p-2">
            {shot.compiled_audio}
          </pre>
        </div>
      )}
      {shot.compiled_negative && (
        <div>
          <p className="label-mono mb-1">Negative</p>
          <pre className="font-mono text-xs whitespace-pre-wrap bg-background border border-border rounded-[2px] p-2 text-muted-foreground">
            {shot.compiled_negative}
          </pre>
        </div>
      )}
      {shot.seed != null && (
        <p className="font-mono text-[11px] text-muted-foreground">seed · {shot.seed}</p>
      )}
    </div>
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

  // Prompt slots
  const [slotsOpen, setSlotsOpen] = useState(true);
  const [subject, setSubject] = useState("");
  const [subjectTokens, setSubjectTokens] = useState("");
  const [action, setAction] = useState("");
  const [setting, setSetting] = useState("");
  const [lighting, setLighting] = useState("");
  const [lens, setLens] = useState("");
  const [styleGrade, setStyleGrade] = useState("");
  const [mood, setMood] = useState("");
  const [dialogue, setDialogue] = useState("");
  const [sfx, setSfx] = useState("");
  const [ambient, setAmbient] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState<string>("");
  const [promptWordTarget, setPromptWordTarget] = useState<number>(60);
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());

  // Compile-prompt state inside the form
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileResult, setCompileResult] = useState<{
    compiled_prompt: string;
    negative_prompt: string;
    audio_prompt: string | null;
    seed: number | null;
    warnings: string[];
    for_tool: string;
  } | null>(null);

  // Style bible from current script's brand
  const styleBible = useMemo(() => {
    const sb = script.angle?.brief?.brand?.style_bibles;
    if (!sb) return null;
    if (Array.isArray(sb)) return sb[0] ?? null;
    return sb;
  }, [script]);

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
      setSubject(existing.subject ?? "");
      setSubjectTokens(existing.subject_tokens ?? "");
      setAction(existing.action ?? "");
      setSetting(existing.setting ?? "");
      setLighting(existing.lighting ?? "");
      setLens(existing.lens ?? "");
      setStyleGrade(existing.style_grade ?? "");
      setMood(existing.mood ?? "");
      setDialogue(existing.dialogue ?? "");
      setSfx(existing.sfx ?? "");
      setAmbient(existing.ambient ?? "");
      setNegativePrompt(existing.negative_prompt ?? "");
      setSeed(existing.seed != null ? String(existing.seed) : "");
      setPromptWordTarget(existing.prompt_word_target ?? 60);
      setPrefilled(new Set());
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
      // Prefill prompt slots from the brand's Style Bible
      const sb = styleBible;
      const pre = new Set<string>();
      setSubject("");
      setAction("");
      setSetting("");
      setMood("");
      setDialogue("");
      setSfx("");
      setAmbient("");
      if (sb?.subject_tokens) { setSubjectTokens(sb.subject_tokens); pre.add("subject_tokens"); }
      else setSubjectTokens("");
      const grade = [sb?.film_look, sb?.color_grade].filter(Boolean).join(", ");
      if (grade) { setStyleGrade(grade); pre.add("style_grade"); }
      else setStyleGrade("");
      if (sb?.lighting_signature) { setLighting(sb.lighting_signature); pre.add("lighting"); }
      else setLighting("");
      if (sb?.lens_feel) { setLens(sb.lens_feel); pre.add("lens"); }
      else setLens("");
      if (sb?.default_negative) { setNegativePrompt(sb.default_negative); pre.add("negative_prompt"); }
      else setNegativePrompt("");
      if (sb?.locked_seed != null) { setSeed(String(sb.locked_seed)); pre.add("seed"); }
      else setSeed("");
      setPromptWordTarget(60);
      setPrefilled(pre);
    }
    setError(null);
    // Hydrate compile preview from existing shot if present
    if (existing && existing.compiled_prompt) {
      setCompileResult({
        compiled_prompt: existing.compiled_prompt,
        negative_prompt: existing.compiled_negative ?? "",
        audio_prompt: existing.compiled_audio,
        seed: existing.seed,
        warnings: [],
        for_tool: existing.compiled_for_tool ?? "",
      });
    } else {
      setCompileResult(null);
    }
  }, [open, existing, styleBible]);

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

  const handleCompile = async () => {
    const tool = assignedTool.trim();
    if (!tool) {
      toast.error("Pick a target model first.");
      return;
    }
    setCompileLoading(true);
    try {
      const payload = {
        assigned_tool: tool,
        subject: subject.trim() || null,
        subject_tokens: subjectTokens.trim() || null,
        action: action.trim() || null,
        setting: setting.trim() || null,
        lighting: lighting.trim() || null,
        lens: lens.trim() || null,
        style_grade: styleGrade.trim() || null,
        mood: mood.trim() || null,
        dialogue: dialogue.trim() || null,
        sfx: sfx.trim() || null,
        ambient: ambient.trim() || null,
        negative_prompt: negativePrompt.trim() || null,
        seed: seed.trim() === "" ? null : Number(seed),
        camera_move: camera || null,
        motion_intensity: motionLabel,
        duration_seconds: duration || null,
        generation_method: genMethod,
        has_anchor_image: !!referenceImageUrl,
        prompt_word_target: promptWordTarget || 60,
      };
      const { data, error: err } = await supabase.functions.invoke("ai-assist", {
        body: { task: "compile_prompt", payload },
      });
      if (err) throw new Error(err.message);
      const r = (data as { result?: Record<string, unknown> } | null)?.result;
      if (!r || typeof r !== "object") throw new Error("Empty AI response");
      const compiled_prompt = String(r.compiled_prompt ?? "").trim();
      const negative_prompt = String(r.negative_prompt ?? "").trim();
      const audioRaw = r.audio_prompt;
      const audio_prompt =
        typeof audioRaw === "string" && audioRaw.trim() ? audioRaw.trim() : null;
      const warnings = Array.isArray(r.warnings)
        ? (r.warnings as unknown[]).filter((w) => typeof w === "string").map(String)
        : [];
      const result = {
        compiled_prompt,
        negative_prompt,
        audio_prompt,
        seed: seed.trim() === "" ? null : Number(seed),
        warnings,
        for_tool: tool,
      };
      setCompileResult(result);
      // Persist to DB only if we're editing an existing shot
      if (existing) {
        const { error: dbErr } = await supabase
          .from("shots")
          .update({
            compiled_prompt: compiled_prompt || null,
            compiled_negative: negative_prompt || null,
            compiled_audio: audio_prompt,
            compiled_for_tool: tool,
            compiled_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (dbErr) throw new Error(dbErr.message);
        await onSaved();
      }
      if (warnings.length > 0) {
        toast.warning(`Compiled with ${warnings.length} warning(s).`);
      } else {
        toast.success(existing ? "Prompt compiled & saved." : "Prompt compiled. Save the shot to persist.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Compile failed";
      toast.error(msg);
    } finally {
      setCompileLoading(false);
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
      subject: subject.trim() || null,
      subject_tokens: subjectTokens.trim() || null,
      action: action.trim() || null,
      setting: setting.trim() || null,
      lighting: lighting.trim() || null,
      lens: lens.trim() || null,
      style_grade: styleGrade.trim() || null,
      mood: mood.trim() || null,
      dialogue: dialogue.trim() || null,
      sfx: sfx.trim() || null,
      ambient: ambient.trim() || null,
      negative_prompt: negativePrompt.trim() || null,
      seed: seed.trim() === "" ? null : Number(seed),
      prompt_word_target: promptWordTarget || 60,
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
          <FormField label="Director's note (visual description)" required error={error}>
            <Textarea
              value={visual}
              onChange={(e) => setVisual(e.target.value)}
              rows={3}
              placeholder="Human-readable note for the team. The prompt slots below drive the AI."
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

          <PromptSlotsSection
            open={slotsOpen}
            onToggle={() => setSlotsOpen((v) => !v)}
            prefilled={prefilled}
            hasBible={!!styleBible}
            values={{
              subject, subjectTokens, action, setting, lighting, lens,
              styleGrade, mood, dialogue, sfx, ambient, negativePrompt,
              seed, promptWordTarget,
            }}
            setters={{
              setSubject, setSubjectTokens, setAction, setSetting, setLighting,
              setLens, setStyleGrade, setMood, setDialogue, setSfx, setAmbient,
              setNegativePrompt, setSeed, setPromptWordTarget,
            }}
          />

          {/* Compile prompt panel */}
          <div className="border border-border bg-background rounded-[3px] p-4">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <p className="label-mono mb-1 inline-flex items-center gap-1.5">
                  <Wand2 className="h-3 w-3" /> Compiled prompt
                </p>
                <p className="text-xs text-muted-foreground">
                  Compiles the slots into a model-specific prompt for{" "}
                  <span className="font-mono">{assignedTool || "—"}</span>.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCompile}
                disabled={compileLoading || !assignedTool}
              >
                {compileLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {compileLoading ? "Compiling…" : compileResult ? "Recompile" : "Compile prompt"}
              </Button>
            </div>

            {compileResult ? (
              <CompileResultView result={compileResult} target={promptWordTarget || 60} />
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {assignedTool
                  ? "No compiled prompt yet — click Compile prompt."
                  : "Pick a target model in the Tool section above to enable compilation."}
              </p>
            )}
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

function CompileResultView({
  result,
  target,
}: {
  result: {
    compiled_prompt: string;
    negative_prompt: string;
    audio_prompt: string | null;
    seed: number | null;
    warnings: string[];
    for_tool: string;
  };
  target: number;
}) {
  const wc = result.compiled_prompt.trim().split(/\s+/).filter(Boolean).length;
  const wcState = wc <= target ? "good" : wc <= 90 ? "warn" : "bad";
  const wcColor =
    wcState === "good"
      ? "text-emerald-700 border-emerald-700/40 bg-emerald-700/10"
      : wcState === "warn"
      ? "text-amber-700 border-amber-700/40 bg-amber-700/10"
      : "text-[var(--color-rec)] border-[var(--color-rec)]/40 bg-[var(--color-rec)]/10";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {result.for_tool && (
          <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px] text-muted-foreground">
            for {result.for_tool}
          </span>
        )}
        <span className={cn(
          "font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px]",
          wcColor,
        )}>
          {wc}/{target} words
        </span>
        {result.seed != null && (
          <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px] text-muted-foreground">
            seed · {result.seed}
          </span>
        )}
      </div>
      <div>
        <p className="label-mono mb-1">Prompt</p>
        <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap bg-card border border-border rounded-[2px] p-3">
          {result.compiled_prompt}
        </pre>
      </div>
      {result.audio_prompt && (
        <div>
          <p className="label-mono mb-1">Audio</p>
          <pre className="font-mono text-xs whitespace-pre-wrap bg-card border border-border rounded-[2px] p-2">
            {result.audio_prompt}
          </pre>
        </div>
      )}
      {result.negative_prompt && (
        <div>
          <p className="label-mono mb-1">Negative</p>
          <pre className="font-mono text-xs whitespace-pre-wrap bg-card border border-border rounded-[2px] p-2 text-muted-foreground">
            {result.negative_prompt}
          </pre>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="border border-[var(--color-rec)]/40 bg-[var(--color-rec)]/5 rounded-[2px] p-3">
          <p className="label-mono mb-1 inline-flex items-center gap-1.5 text-[var(--color-rec)]">
            <AlertTriangle className="h-3 w-3" /> Warnings
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-xs text-[var(--color-rec)]">{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PROMPT SLOTS
   ============================================================ */

type SlotValues = {
  subject: string; subjectTokens: string; action: string; setting: string;
  lighting: string; lens: string; styleGrade: string; mood: string;
  dialogue: string; sfx: string; ambient: string; negativePrompt: string;
  seed: string; promptWordTarget: number;
};

type SlotSetters = {
  setSubject: (v: string) => void;
  setSubjectTokens: (v: string) => void;
  setAction: (v: string) => void;
  setSetting: (v: string) => void;
  setLighting: (v: string) => void;
  setLens: (v: string) => void;
  setStyleGrade: (v: string) => void;
  setMood: (v: string) => void;
  setDialogue: (v: string) => void;
  setSfx: (v: string) => void;
  setAmbient: (v: string) => void;
  setNegativePrompt: (v: string) => void;
  setSeed: (v: string) => void;
  setPromptWordTarget: (v: number) => void;
};

function SlotField({
  label,
  hint,
  fromBible,
  children,
}: {
  label: string;
  hint?: string;
  fromBible?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="label-mono">{label}</label>
        {fromBible && (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px] text-muted-foreground">
            <Sparkles className="h-2.5 w-2.5" />
            from Style Bible
          </span>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1 italic">{hint}</p>}
    </div>
  );
}

function PromptSlotsSection({
  open,
  onToggle,
  prefilled,
  hasBible,
  values,
  setters,
}: {
  open: boolean;
  onToggle: () => void;
  prefilled: Set<string>;
  hasBible: boolean;
  values: SlotValues;
  setters: SlotSetters;
}) {
  return (
    <div className="border border-border rounded-[3px] bg-background">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border"
      >
        <span className="flex items-center gap-2">
          <span className="label-mono">Prompt slots</span>
          {hasBible && (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px] text-muted-foreground">
              <Sparkles className="h-2.5 w-2.5" /> Style Bible linked
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="p-4 space-y-5">
          <p className="text-xs text-muted-foreground italic">
            Structured slots the compiler will use. One action per shot. Specific focal lengths and motion verbs beat adjectives. Don't stack contradictory style cues — keep it tight.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <SlotField label="Subject" hint='Who/what is in frame, e.g. "barista, late 20s, navy apron"'>
              <Input value={values.subject} onChange={(e) => setters.setSubject(e.target.value)} />
            </SlotField>
            <SlotField
              label="Subject tokens"
              hint="Locked recurring descriptors reused verbatim across shots."
              fromBible={prefilled.has("subject_tokens")}
            >
              <Input
                value={values.subjectTokens}
                onChange={(e) => setters.setSubjectTokens(e.target.value)}
              />
            </SlotField>
          </div>

          <SlotField label="Action" hint='ONE verb-driven motion, e.g. "pours espresso into a glass"'>
            <Input value={values.action} onChange={(e) => setters.setAction(e.target.value)} />
          </SlotField>

          <div className="grid grid-cols-2 gap-4">
            <SlotField label="Setting" hint='Where, e.g. "morning kitchen, marble counter"'>
              <Input value={values.setting} onChange={(e) => setters.setSetting(e.target.value)} />
            </SlotField>
            <SlotField label="Mood" hint='One mood word/phrase, e.g. "intimate, slow morning"'>
              <Input value={values.mood} onChange={(e) => setters.setMood(e.target.value)} />
            </SlotField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SlotField
              label="Lighting"
              hint='Specific direction + temperature, e.g. "soft side-light, 3500K"'
              fromBible={prefilled.has("lighting")}
            >
              <Input value={values.lighting} onChange={(e) => setters.setLighting(e.target.value)} />
            </SlotField>
            <SlotField
              label="Lens"
              hint='Shot size + focal length, e.g. "medium close-up, 85mm"'
              fromBible={prefilled.has("lens")}
            >
              <Input value={values.lens} onChange={(e) => setters.setLens(e.target.value)} />
            </SlotField>
          </div>

          <SlotField
            label="Style / grade"
            hint='Film look + color grade, e.g. "filmic 35mm grain, warm teal-orange"'
            fromBible={prefilled.has("style_grade")}
          >
            <Input value={values.styleGrade} onChange={(e) => setters.setStyleGrade(e.target.value)} />
          </SlotField>

          <div className="border-t border-border pt-4">
            <p className="label-mono mb-3">Audio</p>
            <div className="space-y-4">
              <SlotField label="Dialogue" hint="Spoken line for this shot, if any.">
                <Input value={values.dialogue} onChange={(e) => setters.setDialogue(e.target.value)} />
              </SlotField>
              <div className="grid grid-cols-2 gap-4">
                <SlotField label="SFX" hint='e.g. "espresso steam hiss, ceramic clink"'>
                  <Input value={values.sfx} onChange={(e) => setters.setSfx(e.target.value)} />
                </SlotField>
                <SlotField label="Ambient" hint='e.g. "quiet café morning, soft rain outside"'>
                  <Input value={values.ambient} onChange={(e) => setters.setAmbient(e.target.value)} />
                </SlotField>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="label-mono mb-3">Negatives & seed</p>
            <div className="space-y-4">
              <SlotField
                label="Negative prompt"
                hint="Things to suppress — artifacts, contradictions, brand no-gos."
                fromBible={prefilled.has("negative_prompt")}
              >
                <Textarea
                  rows={2}
                  value={values.negativePrompt}
                  onChange={(e) => setters.setNegativePrompt(e.target.value)}
                />
              </SlotField>
              <div className="grid grid-cols-2 gap-4">
                <SlotField
                  label="Seed"
                  hint="Optional fixed seed for consistency across takes."
                  fromBible={prefilled.has("seed")}
                >
                  <Input
                    type="number"
                    value={values.seed}
                    onChange={(e) => setters.setSeed(e.target.value)}
                  />
                </SlotField>
                <SlotField label="Prompt word target" hint="Target length for the compiled prompt.">
                  <Input
                    type="number"
                    value={values.promptWordTarget}
                    onChange={(e) => setters.setPromptWordTarget(Number(e.target.value) || 60)}
                  />
                </SlotField>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   AI SHOTLIST REVIEW
   ============================================================ */

function AiShotlistReview({
  drafts,
  onUpdate,
  onDismiss,
  onAddOne,
  onAddAll,
  onDismissAll,
}: {
  drafts: DraftShot[];
  onUpdate: (key: string, patch: Partial<DraftShot>) => void;
  onDismiss: (key: string) => void;
  onAddOne: (d: DraftShot) => void;
  onAddAll: () => void;
  onDismissAll: () => void;
}) {
  const total = drafts.reduce((sum, d) => sum + (d.duration_seconds || 0), 0);
  const longCount = drafts.filter((d) => d.duration_seconds > 10).length;
  return (
    <div className="border-2 border-foreground rounded-[3px] bg-card mb-5">
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <p className="label-mono mb-1 inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> AI draft · review
          </p>
          <p className="text-sm text-muted-foreground leading-snug">
            AI shot breakdown + tool routing — adjust durations and tools, then commit. Keep shots short and stitch them.
          </p>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mt-2">
            {drafts.length} shot{drafts.length === 1 ? "" : "s"} · total {total}s
            {longCount > 0 && (
              <span className="text-[var(--color-rec)] ml-2">
                · {longCount} over 10s
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onDismissAll}>
            Dismiss all
          </Button>
          <Button size="sm" onClick={onAddAll}>
            <Plus className="h-4 w-4" />
            Add all to storyboard
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {drafts.map((d, i) => (
          <DraftShotRow
            key={d.key}
            draft={d}
            index={i}
            onUpdate={(patch) => onUpdate(d.key, patch)}
            onAdd={() => onAddOne(d)}
            onDismiss={() => onDismiss(d.key)}
          />
        ))}
      </div>
    </div>
  );
}

function DraftShotRow({
  draft,
  index,
  onUpdate,
  onAdd,
  onDismiss,
}: {
  draft: DraftShot;
  index: number;
  onUpdate: (patch: Partial<DraftShot>) => void;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const isLong = draft.duration_seconds > 10;
  const needsRef = draft.generation_method === "image-to-video";
  return (
    <div className="p-4 flex gap-4 items-start">
      <div className="shrink-0 w-12 h-12 border border-foreground rounded-[2px] flex flex-col items-center justify-center bg-foreground text-background">
        <span className="font-mono text-[8px] uppercase opacity-70">Draft</span>
        <span className="font-mono text-base font-bold leading-none">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <Textarea
          value={draft.visual_description}
          onChange={(e) => onUpdate({ visual_description: e.target.value })}
          rows={2}
          placeholder="Visual description"
          className="text-sm"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <p className="label-mono mb-1">Camera</p>
            <Select
              value={draft.camera_move || undefined}
              onValueChange={(v) => onUpdate({ camera_move: v })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Camera" /></SelectTrigger>
              <SelectContent>
                {CAMERA_MOVES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="label-mono mb-1">Motion</p>
            <Select
              value={draft.motion_intensity || undefined}
              onValueChange={(v) => onUpdate({ motion_intensity: v })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Motion" /></SelectTrigger>
              <SelectContent>
                {MOTION_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="label-mono mb-1">Duration (s)</p>
            <Input
              type="number"
              value={draft.duration_seconds}
              onChange={(e) => onUpdate({ duration_seconds: Number(e.target.value) })}
              className={cn("h-9", isLong && "border-[var(--color-rec)] text-[var(--color-rec)]")}
            />
          </div>
          <div>
            <p className="label-mono mb-1">Method</p>
            <div className="flex gap-1">
              {(["text-to-video", "image-to-video"] as GenMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onUpdate({ generation_method: m })}
                  className={cn(
                    "flex-1 px-1.5 h-9 border rounded-[3px] font-mono text-[9px] uppercase tracking-wider transition-colors",
                    draft.generation_method === m
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground/70 border-border hover:border-foreground/40",
                  )}
                >
                  {m === "text-to-video" ? "T→V" : "I→V"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <p className="label-mono mb-1">Tool</p>
            <Select
              value={draft.assigned_tool || undefined}
              onValueChange={(v) => onUpdate({ assigned_tool: v })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Tool" /></SelectTrigger>
              <SelectContent>
                {TOOLS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="label-mono mb-1">Tool reason</p>
            <Input
              value={draft.tool_reason}
              onChange={(e) => onUpdate({ tool_reason: e.target.value })}
              className="h-9"
              placeholder="Why this tool"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <p className="label-mono mb-1">Caption (on-screen)</p>
            <Input
              value={draft.caption_text}
              onChange={(e) => onUpdate({ caption_text: e.target.value })}
              className="h-9"
              placeholder="Burned-in text for this shot"
            />
          </div>
          <div>
            <p className="label-mono mb-1">Audio note</p>
            <Input
              value={draft.audio_note}
              onChange={(e) => onUpdate({ audio_note: e.target.value })}
              className="h-9"
              placeholder="VO line / SFX"
            />
          </div>
        </div>

        {(isLong || needsRef) && (
          <div className="space-y-1">
            {isLong && (
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-rec)]">
                Over 10s — split into two shots before committing.
              </p>
            )}
            {needsRef && (
              <p className="text-[10px] font-mono uppercase tracking-wider text-foreground/70">
                Image-to-video — attach a product reference frame after committing.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
        <button
          onClick={onDismiss}
          className="label-mono text-muted-foreground hover:text-[var(--color-rec)] inline-flex items-center gap-1"
        >
          <X className="h-3 w-3" /> Dismiss
        </button>
      </div>
    </div>
  );
}
