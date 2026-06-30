// Image Studio — generate / refine anchor frames for an image-to-video shot.
// Opens as a dialog over the Storyboard or Generation surface; the parent
// provides a shot snapshot + brand context and receives the chosen anchor.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  getCampaignSignedUrls,
  uploadCampaignFile,
} from "@/lib/campaign-assets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CostMeter, useCannotAfford } from "@/components/cost-meter";
import { parseEdgeError } from "@/lib/wallet";
import {
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  Image as ImageIcon,
  Check,
  RefreshCw,
  BookmarkPlus,
  CircleDot,
  Trash2,
  Edit3,
} from "lucide-react";

export type ImageStudioShot = {
  id: string;
  brief_id: string | null;
  brand_id: string | null;
  subject: string | null;
  subject_tokens: string | null;
  action: string | null;
  setting: string | null;
  lighting: string | null;
  lens: string | null;
  style_grade: string | null;
  mood: string | null;
  negative_prompt: string | null;
  seed: number | null;
  assigned_tool: string | null;
  visual_description: string | null;
  reference_image_url: string | null;
};

export type ImageStudioStyleBible = {
  film_look?: string | null;
  color_grade?: string | null;
  lighting_signature?: string | null;
  lens_feel?: string | null;
  subject_tokens?: string | null;
  default_negative?: string | null;
  locked_seed?: number | null;
} | null;

type ModelTier = {
  id: string;
  job_type: string;
  label: string;
  draft_model_id: string;
  draft_cost: number;
  final_model_id: string;
  final_cost: number;
  supports_reference: boolean;
  supports_text_in_image: boolean;
};

type FrameRow = {
  id: string;
  shot_id: string | null;
  brief_id: string | null;
  brand_id: string | null;
  purpose: string;
  image_prompt: string | null;
  negative_prompt: string | null;
  model_id: string | null;
  aspect_ratio: string | null;
  seed: number | null;
  reference_image_urls: unknown;
  file_url: string | null;
  status: "queued" | "generating" | "review" | "approved" | "rejected";
  version: number | null;
  is_selected: boolean | null;
  cost_estimate: number | null;
  actual_cost: number | null;
  cost_source: string | null;
  error_message: string | null;
  created_at: string;
};

const ASPECT_OPTIONS = ["9:16", "1:1", "4:5", "16:9", "4:3", "3:4"] as const;

function suggestJobType(shot: ImageStudioShot): string {
  const text = `${shot.subject ?? ""} ${shot.visual_description ?? ""} ${
    shot.action ?? ""
  }`.toLowerCase();
  if (/pack|label|bottle|carton|box|text|logo|copy/.test(text)) {
    return "product_with_text";
  }
  if (/person|face|woman|man|model|hand|portrait/.test(text)) {
    return "photoreal_people";
  }
  if (/kitchen|street|cafe|room|scene|interior|landscape|outdoor|lifestyle/.test(text)) {
    return "lifestyle_scene";
  }
  return "product_hero";
}

function formatCost(c: number | null | undefined): string {
  if (c == null) return "—";
  return `$${Number(c).toFixed(3)}`;
}

function StatusChip({ status }: { status: FrameRow["status"] }) {
  const map: Record<FrameRow["status"], string> = {
    queued: "border-border text-muted-foreground",
    generating: "border-foreground/40 text-foreground/80",
    review: "border-foreground text-foreground",
    approved: "border-[var(--color-rec)] text-[var(--color-rec)]",
    rejected: "border-destructive text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px] bg-background",
        map[status],
      )}
    >
      {status === "generating" && (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      )}
      {status}
    </span>
  );
}

export function ImageStudioDialog({
  open,
  onOpenChange,
  shot,
  styleBible,
  briefProductPaths,
  initialImageUrls = {},
  defaultAspect,
  onAnchorSet,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shot: ImageStudioShot;
  styleBible: ImageStudioStyleBible;
  briefProductPaths: string[];
  initialImageUrls?: Record<string, string>;
  defaultAspect?: string;
  onAnchorSet?: (filePath: string, frameId: string) => void;
}) {
  // ---- core state ----
  const [tiers, setTiers] = useState<ModelTier[]>([]);
  const [jobType, setJobType] = useState<string>(suggestJobType(shot));
  const [tier, setTier] = useState<"draft" | "final">("draft");
  const [aspect, setAspect] = useState<string>(defaultAspect ?? "9:16");
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState(
    shot.negative_prompt ?? styleBible?.default_negative ?? "",
  );
  const [seed, setSeed] = useState<string>(
    shot.seed != null
      ? String(shot.seed)
      : styleBible?.locked_seed != null
      ? String(styleBible.locked_seed)
      : "",
  );
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [imageUrls, setImageUrls] =
    useState<Record<string, string>>(initialImageUrls);
  const [compileLoading, setCompileLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [framesLoading, setFramesLoading] = useState(false);
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const activeTier = useMemo(
    () => tiers.find((t) => t.job_type === jobType) ?? null,
    [tiers, jobType],
  );
  const modelId = useMemo(() => {
    if (!activeTier) return "";
    return tier === "final" ? activeTier.final_model_id : activeTier.draft_model_id;
  }, [activeTier, tier]);
  const unitCost = useMemo(() => {
    if (!activeTier) return 0;
    return tier === "final" ? activeTier.final_cost : activeTier.draft_cost;
  }, [activeTier, tier]);

  // Load model tier catalog
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("image_model_tiers")
        .select(
          "id, job_type, label, draft_model_id, draft_cost, final_model_id, final_cost, supports_reference, supports_text_in_image",
        )
        .order("sort_order");
      setTiers((data ?? []) as ModelTier[]);
    })();
  }, [open]);

  // Resolve signed URLs for brief product paths
  const resolvePaths = useCallback(async (paths: string[]) => {
    const missing = paths.filter((p) => p && !imageUrls[p]);
    if (missing.length === 0) return;
    const map = await getCampaignSignedUrls(missing);
    if (Object.keys(map).length > 0) {
      setImageUrls((prev) => ({ ...prev, ...map }));
    }
  }, [imageUrls]);

  useEffect(() => {
    if (!open) return;
    void resolvePaths([
      ...briefProductPaths,
      ...(shot.reference_image_url ? [shot.reference_image_url] : []),
    ]);
  }, [open, briefProductPaths, shot.reference_image_url, resolvePaths]);

  // Load existing frames for this shot
  const loadFrames = useCallback(async () => {
    setFramesLoading(true);
    const { data, error } = await supabase
      .from("frames")
      .select(
        "id, shot_id, brief_id, brand_id, purpose, image_prompt, negative_prompt, model_id, aspect_ratio, seed, reference_image_urls, file_url, status, version, is_selected, cost_estimate, actual_cost, cost_source, error_message, created_at",
      )
      .eq("shot_id", shot.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const rows = (data ?? []) as FrameRow[];
    setFrames(rows);
    setFramesLoading(false);
    const filePaths = rows
      .map((f) => f.file_url)
      .filter((p): p is string => !!p);
    if (filePaths.length > 0) void resolvePaths(filePaths);
  }, [shot.id, resolvePaths]);

  useEffect(() => {
    if (!open) return;
    void loadFrames();
  }, [open, loadFrames]);

  // Poll while any frame is generating
  useEffect(() => {
    if (!open) return;
    const hasInflight = frames.some((f) => f.status === "generating");
    if (!hasInflight) return;
    const id = setInterval(() => {
      void loadFrames();
    }, 4000);
    return () => clearInterval(id);
  }, [open, frames, loadFrames]);

  // Auto-compile prompt on first open if empty
  const autoCompiled = useRef(false);
  useEffect(() => {
    if (!open) {
      autoCompiled.current = false;
      return;
    }
    if (autoCompiled.current) return;
    if (prompt.trim()) {
      autoCompiled.current = true;
      return;
    }
    autoCompiled.current = true;
    void handleCompile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCompile = async () => {
    setCompileLoading(true);
    try {
      const payload = {
        subject: shot.subject,
        subject_tokens: shot.subject_tokens ?? styleBible?.subject_tokens ?? null,
        action: shot.action,
        setting: shot.setting,
        lighting: shot.lighting ?? styleBible?.lighting_signature ?? null,
        lens: shot.lens ?? styleBible?.lens_feel ?? null,
        style_grade:
          shot.style_grade ??
          [styleBible?.film_look, styleBible?.color_grade]
            .filter(Boolean)
            .join(", ") ??
          null,
        mood: shot.mood,
        visual_description: shot.visual_description,
        negative_prompt: negative || styleBible?.default_negative || null,
        aspect_ratio: aspect,
        purpose: "anchor_frame",
        reference_image_urls: selectedRefs,
        style_bible: styleBible
          ? {
              subject_tokens: styleBible.subject_tokens ?? null,
              film_look: styleBible.film_look ?? null,
              color_grade: styleBible.color_grade ?? null,
              lighting_signature: styleBible.lighting_signature ?? null,
              lens_feel: styleBible.lens_feel ?? null,
              default_negative: styleBible.default_negative ?? null,
            }
          : null,
      };
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: { task: "compile_image_prompt", payload },
      });
      if (error) throw new Error(error.message);
      const r = (data as { result?: Record<string, unknown> } | null)?.result;
      if (!r) throw new Error("Empty AI response");
      const cp = String(r.compiled_prompt ?? r.image_prompt ?? "").trim();
      const np = String(r.negative_prompt ?? "").trim();
      if (cp) setPrompt(cp);
      if (np) setNegative(np);
      toast.success("Image prompt compiled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compile failed");
    } finally {
      setCompileLoading(false);
    }
  };

  const fireGenerate = async (
    count: number,
    overrides?: { modelOverride?: string; promptOverride?: string; seedOverride?: number | null },
  ): Promise<number> => {
    if (!prompt.trim() && !overrides?.promptOverride) {
      toast.error("Compile or write a prompt first.");
      return 0;
    }
    if (!modelId && !overrides?.modelOverride) {
      toast.error("Pick a job type first.");
      return 0;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast.error("Not signed in");
      return 0;
    }
    const baseSeed =
      overrides?.seedOverride !== undefined
        ? overrides.seedOverride
        : seed.trim() === ""
        ? null
        : Number(seed);
    let ok = 0;
    for (let i = 0; i < count; i++) {
      const seedVariant =
        baseSeed != null && count > 1 ? baseSeed + i : baseSeed;
      const { data, error } = await supabase.functions.invoke(
        "generate-image",
        {
          body: {
            shot_id: shot.id,
            brief_id: shot.brief_id,
            brand_id: shot.brand_id,
            purpose: "anchor_frame",
            prompt: overrides?.promptOverride ?? prompt.trim(),
            negative_prompt: negative.trim() || null,
            model_id: overrides?.modelOverride ?? modelId,
            aspect_ratio: aspect,
            seed: seedVariant,
            reference_image_urls: selectedRefs,
            cost_estimate: unitCost,
            version: frames.length + i + 1,
          },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (error) {
        const parsed = await parseEdgeError(error, data);
        if (parsed?.isInsufficient) {
          toast.error(
            parsed.shortfall != null
              ? `Insufficient credits — need ~${parsed.shortfall.toFixed(2)} more. Open Wallet.`
              : "Insufficient credits. Open Wallet.",
          );
          break;
        }
        toast.error(error.message);
        continue;
      }
      if ((data as { error?: string } | null)?.error) {
        const parsed = await parseEdgeError(null, data);
        if (parsed?.isInsufficient) {
          toast.error(
            parsed.shortfall != null
              ? `Insufficient credits — need ~${parsed.shortfall.toFixed(2)} more. Open Wallet.`
              : "Insufficient credits. Open Wallet.",
          );
          break;
        }
        toast.error((data as { error: string }).error);
        continue;
      }
      ok += 1;
    }
    if (ok > 0) {
      toast.success(`Generation queued · ${ok} frame${ok === 1 ? "" : "s"}`);
      await loadFrames();
    }
    return ok;
  };

  const handleUseAsAnchor = async (frame: FrameRow) => {
    if (!frame.file_url) return;
    const { error: framesErr } = await supabase
      .from("frames")
      .update({ is_selected: false })
      .eq("shot_id", shot.id);
    if (framesErr) {
      toast.error(framesErr.message);
      return;
    }
    const { error: pickErr } = await supabase
      .from("frames")
      .update({ is_selected: true, status: "approved" })
      .eq("id", frame.id);
    if (pickErr) {
      toast.error(pickErr.message);
      return;
    }
    const { error: shotErr } = await supabase
      .from("shots")
      .update({
        reference_image_url: frame.file_url,
        generation_method: "image-to-video",
        needs_generated_anchor: false,
      })
      .eq("id", shot.id);
    if (shotErr) {
      toast.error(shotErr.message);
      return;
    }
    toast.success("Anchor frame locked to shot");
    onAnchorSet?.(frame.file_url, frame.id);
    await loadFrames();
  };

  const handleRenderFinal = async (frame: FrameRow) => {
    if (!activeTier) return;
    setGenerating(true);
    try {
      await fireGenerate(1, {
        modelOverride: activeTier.final_model_id,
        promptOverride: frame.image_prompt ?? prompt,
        seedOverride: frame.seed ?? null,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleEditFrame = async (frame: FrameRow) => {
    if (!frame.file_url || !editInstruction.trim()) return;
    const editTier = tiers.find((t) => t.job_type === "image_edit");
    if (!editTier) {
      toast.error("No edit-model configured");
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          shot_id: shot.id,
          brief_id: shot.brief_id,
          brand_id: shot.brand_id,
          purpose: "anchor_frame",
          mode: "edit",
          instruction: editInstruction.trim(),
          prompt: editInstruction.trim(),
          model_id: editTier.final_model_id,
          aspect_ratio: aspect,
          seed: frame.seed ?? null,
          reference_image_urls: [frame.file_url],
          cost_estimate: editTier.final_cost,
          version: frames.length + 1,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw new Error(error.message);
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }
      toast.success("Edit queued");
      setEditingFrameId(null);
      setEditInstruction("");
      await loadFrames();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Edit failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToLibrary = async (frame: FrameRow) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("prompt_library").insert({
      user_id: userId,
      title:
        shot.subject?.slice(0, 60) ??
        shot.visual_description?.slice(0, 60) ??
        "Anchor frame",
      tool: frame.model_id,
      prompt_text: frame.image_prompt ?? prompt,
      notes: `Aspect ${frame.aspect_ratio ?? aspect} · seed ${
        frame.seed ?? "—"
      } · ${frame.cost_source ?? ""}`.trim(),
      category: "style_ref",
      source_brand_id: shot.brand_id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved to Library");
  };

  const handleUpload = async (file: File) => {
    if (!shot.brief_id) {
      toast.error("No brief context");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const path = await uploadCampaignFile(userId, shot.brief_id, file);
      await resolvePaths([path]);
      setSelectedRefs((prev) =>
        prev.includes(path) ? prev : [...prev, path],
      );
      toast.success("Reference uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleRef = (path: string) => {
    setSelectedRefs((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <p className="label-mono text-muted-foreground">Image Studio</p>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Anchor frame · Shot {shot.id.slice(0, 6)}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Compose a single hero frame for image-to-video. The generated still
            becomes the first frame of the clip.
          </p>
        </DialogHeader>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-0">
          {/* LEFT: controls */}
          <div className="p-6 border-r border-border space-y-4">
            <div>
              <p className="label-mono mb-1.5">Job type</p>
              <Select value={jobType} onValueChange={setJobType}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a model family" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((t) => (
                    <SelectItem key={t.id} value={t.job_type}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeTier && (
                <p className="text-[10px] font-mono text-muted-foreground mt-1.5 truncate">
                  {modelId}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="label-mono mb-1.5">Tier</p>
                <div className="flex gap-1">
                  {(["draft", "final"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(t)}
                      className={cn(
                        "flex-1 px-3 py-2 border rounded-[3px] font-mono text-[10px] uppercase tracking-wider",
                        tier === t
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background text-foreground/70 border-border hover:border-foreground/40",
                      )}
                    >
                      {t} · {formatCost(t === "draft" ? activeTier?.draft_cost : activeTier?.final_cost)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="label-mono mb-1.5">Aspect</p>
                <Select value={aspect} onValueChange={setAspect}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASPECT_OPTIONS.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="label-mono">Image prompt</p>
                <button
                  type="button"
                  onClick={handleCompile}
                  disabled={compileLoading}
                  className="label-mono text-foreground/70 hover:text-foreground inline-flex items-center gap-1"
                >
                  {compileLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  Recompile
                </button>
              </div>
              <Textarea
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Photographic prompt — subject, lighting, lens, composition. No motion."
                className="font-mono text-xs"
              />
            </div>

            <div>
              <p className="label-mono mb-1.5">Negative prompt</p>
              <Textarea
                rows={2}
                value={negative}
                onChange={(e) => setNegative(e.target.value)}
                className="font-mono text-xs"
                placeholder="What to avoid"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="label-mono mb-1.5">Seed</p>
                <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder={
                    styleBible?.locked_seed != null
                      ? `brand-locked · ${styleBible.locked_seed}`
                      : "Optional"
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <p className="label-mono mb-1.5">Provider unit</p>
                <div className="h-10 border border-border rounded-[3px] flex items-center px-3 font-mono text-sm bg-background">
                  {formatCost(unitCost)}{" "}
                  <span className="text-muted-foreground ml-1">/ frame</span>
                </div>
              </div>
            </div>

            <CostMeter estimatedUsd={unitCost} label="Per frame" />

            {/* Reference picker */}
            <div className="border-t border-border pt-4">
              <p className="label-mono mb-2">Reference images (optional)</p>
              {briefProductPaths.length > 0 && (
                <>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">From the brief</p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-3">
                    {briefProductPaths.map((path) => {
                      const url = imageUrls[path];
                      const sel = selectedRefs.includes(path);
                      return (
                        <button
                          key={path}
                          type="button"
                          onClick={() => toggleRef(path)}
                          className={cn(
                            "aspect-square border-2 rounded-[2px] overflow-hidden bg-background flex items-center justify-center",
                            sel
                              ? "border-[var(--color-rec)]"
                              : "border-border hover:border-foreground/40",
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
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
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
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Upload ref
                </Button>
                {selectedRefs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedRefs([])}
                    className="label-mono text-muted-foreground hover:text-[var(--color-rec)]"
                  >
                    Clear ({selectedRefs.length})
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-4 flex flex-col gap-2">
              <ImageGenerateButton
                estimatedUsd={unitCost}
                disabled={generating || compileLoading}
                busy={generating}
                label={`Generate · ${formatCost(unitCost)}`}
                onClick={async () => {
                  setGenerating(true);
                  try { await fireGenerate(1); } finally { setGenerating(false); }
                }}
              />
              <ImageGenerateButton
                variant="outline"
                estimatedUsd={unitCost * 3}
                disabled={generating || compileLoading}
                busy={false}
                label={`Generate 3 variations · ${formatCost(unitCost * 3)}`}
                onClick={async () => {
                  setGenerating(true);
                  try { await fireGenerate(3); } finally { setGenerating(false); }
                }}
              />
            </div>
          </div>

          {/* RIGHT: frames grid */}
          <div className="p-6 bg-muted/20">
            <div className="flex items-center justify-between mb-3">
              <p className="label-mono">Frames · {frames.length}</p>
              <button
                type="button"
                onClick={() => void loadFrames()}
                className="label-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {framesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Refresh
              </button>
            </div>

            {frames.length === 0 ? (
              <div className="border border-dashed border-border rounded-[3px] p-8 text-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No frames yet. Generate the first take to see it here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {frames.map((frame) => {
                  const url = frame.file_url ? imageUrls[frame.file_url] : null;
                  const isSelected = frame.is_selected === true;
                  const isFinalTier =
                    activeTier && frame.model_id === activeTier.final_model_id;
                  return (
                    <div
                      key={frame.id}
                      className={cn(
                        "border rounded-[3px] bg-card overflow-hidden flex flex-col",
                        isSelected
                          ? "border-[var(--color-rec)] ring-1 ring-[var(--color-rec)]"
                          : "border-border",
                      )}
                    >
                      <div className="aspect-square bg-background flex items-center justify-center relative">
                        {frame.status === "generating" ? (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="label-mono">Rendering…</span>
                          </div>
                        ) : url ? (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        ) : frame.status === "rejected" ? (
                          <div className="p-3 text-center">
                            <p className="label-mono text-destructive mb-1">Failed</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-3">
                              {frame.error_message ?? "Unknown error"}
                            </p>
                          </div>
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                        )}
                        {isSelected && (
                          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--color-rec)] text-white font-mono text-[9px] uppercase tracking-wider rounded-[2px]">
                            <CircleDot className="h-2.5 w-2.5" /> Anchor
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-1.5">
                          <StatusChip status={frame.status} />
                          <span className="font-mono text-[10px] text-muted-foreground">
                            v{frame.version ?? 1} · {isFinalTier ? "FINAL" : "DRAFT"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                          <span>{frame.aspect_ratio ?? "—"} · seed {frame.seed ?? "—"}</span>
                          <span title={frame.cost_source ?? undefined}>
                            {formatCost(frame.actual_cost ?? frame.cost_estimate)}
                          </span>
                        </div>
                        {frame.status === "review" || frame.status === "approved" ? (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                            {!isSelected && (
                              <button
                                type="button"
                                onClick={() => void handleUseAsAnchor(frame)}
                                className="label-mono inline-flex items-center gap-1 px-1.5 py-1 border border-foreground rounded-[2px] hover:bg-foreground hover:text-background"
                              >
                                <Check className="h-3 w-3" /> Use as anchor
                              </button>
                            )}
                            {!isFinalTier && activeTier && (
                              <button
                                type="button"
                                onClick={() => void handleRenderFinal(frame)}
                                disabled={generating}
                                className="label-mono inline-flex items-center gap-1 px-1.5 py-1 border border-border rounded-[2px] hover:border-foreground"
                              >
                                <Sparkles className="h-3 w-3" /> Render final
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setEditingFrameId((id) => (id === frame.id ? null : frame.id))
                              }
                              className="label-mono inline-flex items-center gap-1 px-1.5 py-1 border border-border rounded-[2px] hover:border-foreground"
                            >
                              <Edit3 className="h-3 w-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveToLibrary(frame)}
                              className="label-mono inline-flex items-center gap-1 px-1.5 py-1 border border-border rounded-[2px] hover:border-foreground"
                            >
                              <BookmarkPlus className="h-3 w-3" /> Library
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await supabase
                                  .from("frames")
                                  .update({ status: "rejected" })
                                  .eq("id", frame.id);
                                await loadFrames();
                              }}
                              className="label-mono inline-flex items-center gap-1 px-1.5 py-1 border border-border rounded-[2px] hover:border-destructive hover:text-destructive ml-auto"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : null}
                        {editingFrameId === frame.id && (
                          <div className="space-y-1.5 pt-1.5 border-t border-border">
                            <Input
                              value={editInstruction}
                              onChange={(e) => setEditInstruction(e.target.value)}
                              placeholder='e.g. "place on seamless white", "warm the grade"'
                              className="h-8 text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() => void handleEditFrame(frame)}
                              disabled={!editInstruction.trim() || generating}
                              className="w-full h-8"
                            >
                              <Wand2 className="h-3 w-3" /> Refine
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageGenerateButton({
  estimatedUsd,
  disabled,
  busy,
  label,
  onClick,
  variant,
}: {
  estimatedUsd: number;
  disabled: boolean;
  busy: boolean;
  label: string;
  onClick: () => void;
  variant?: "outline";
}) {
  const cannot = useCannotAfford(estimatedUsd);
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      disabled={disabled || cannot}
      className="w-full"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {cannot ? "Insufficient credits" : label}
    </Button>
  );
}