import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  Copy,
  Edit,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CATEGORY_LABEL,
  type LibraryCategory,
} from "@/components/library-picker";

const searchSchema = z.object({
  new: z.string().optional(),
  title: z.string().optional(),
  category: z.string().optional(),
  archetype: z.string().optional(),
  tool: z.string().optional(),
  entry_point: z.string().optional(),
  prompt_text: z.string().optional(),
  performance_tag: z.string().optional(),
  source_metric: z.string().optional(),
  source_brand_id: z.string().optional(),
  notes: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/library")({
  validateSearch: searchSchema,
  component: LibraryPage,
});

// ---------- constants ----------
const CATEGORIES: LibraryCategory[] = [
  "generation_prompt",
  "script_template",
  "hook_formula",
  "shot_recipe",
  "vo_style",
];

const ARCHETYPES = [
  "Hook",
  "Talking head",
  "UGC",
  "Voiceover",
  "Product demo",
  "Lifestyle",
  "Testimonial",
  "Comparison",
  "Reveal",
];

const TOOLS = [
  "Veo 3.1",
  "Kling 3.0",
  "Runway Gen-4.5",
  "Arcads",
  "HeyGen",
  "Synthesia",
  "Luma Ray3",
  "Sora",
  "ElevenLabs",
  "Suno",
  "Other",
];

const ENTRY_POINTS = [
  "pain",
  "outcome",
  "objection",
  "social_proof",
  "identity",
  "curiosity",
];

const CONTENT_HELPER: Record<LibraryCategory, string> = {
  generation_prompt: "The exact prompt that produced the asset.",
  script_template:
    "The beat structure as a reusable skeleton (hook → body → proof → CTA).",
  hook_formula: "A repeatable hook pattern with [variables] to fill in.",
  shot_recipe: "Describe the camera + motion + tool routing.",
  vo_style: "Voice direction, pacing, tone, and example line.",
};

// ---------- types ----------
type Entry = {
  id: string;
  title: string;
  category: LibraryCategory;
  archetype: string | null;
  tool: string | null;
  entry_point: string | null;
  prompt_text: string | null;
  notes: string | null;
  performance_tag: string | null;
  source_metric: string | null;
  source_brand_id: string | null;
  times_used: number;
  is_favorite: boolean;
  updated_at: string;
};

type BrandRow = { id: string; name: string };

// ---------- page ----------
function LibraryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/library" });

  const [entries, setEntries] = useState<Entry[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState<
    LibraryCategory | "all"
  >("all");
  const [filterArchetype, setFilterArchetype] = useState<string>("all");
  const [filterTool, setFilterTool] = useState<string>("all");
  const [filterEntry, setFilterEntry] = useState<string>("all");
  const [favOnly, setFavOnly] = useState(false);
  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState<Entry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Entry | null>(null);
  const [prefill, setPrefill] = useState<Partial<Entry> | null>(null);

  useEffect(() => {
    void load();
    void supabase
      .from("brands")
      .select("id, name")
      .order("name")
      .then(({ data }) => setBrands((data ?? []) as BrandRow[]));
  }, []);

  // honor deep-link prefill
  useEffect(() => {
    if (search.new === "1") {
      setPrefill({
        title: search.title ?? "",
        category: (search.category as LibraryCategory) ?? "hook_formula",
        archetype: search.archetype ?? null,
        tool: search.tool ?? null,
        entry_point: search.entry_point ?? null,
        prompt_text: search.prompt_text ?? "",
        performance_tag: search.performance_tag ?? null,
        source_metric: search.source_metric ?? null,
        source_brand_id: search.source_brand_id ?? null,
        notes: search.notes ?? null,
      });
      setEditing(null);
      setShowForm(true);
      navigate({ search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.new]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("prompt_library")
      .select(
        "id, title, category, archetype, tool, entry_point, prompt_text, notes, performance_tag, source_metric, source_brand_id, times_used, is_favorite, updated_at",
      )
      .order("is_favorite", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setEntries((data ?? []) as unknown as Entry[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (activeCategory !== "all" && e.category !== activeCategory)
        return false;
      if (filterArchetype !== "all" && e.archetype !== filterArchetype)
        return false;
      if (filterTool !== "all" && e.tool !== filterTool) return false;
      if (filterEntry !== "all" && e.entry_point !== filterEntry) return false;
      if (favOnly && !e.is_favorite) return false;
      if (!s) return true;
      return (
        e.title.toLowerCase().includes(s) ||
        (e.prompt_text ?? "").toLowerCase().includes(s) ||
        (e.notes ?? "").toLowerCase().includes(s)
      );
    });
    // Proven winners (source_metric set) sort to top within their category,
    // then favorites, then most-recently-updated.
    return [...list].sort((a, b) => {
      if (a.category !== b.category)
        return a.category.localeCompare(b.category);
      const aw = a.source_metric ? 1 : 0;
      const bw = b.source_metric ? 1 : 0;
      if (aw !== bw) return bw - aw;
      const af = a.is_favorite ? 1 : 0;
      const bf = b.is_favorite ? 1 : 0;
      if (af !== bf) return bf - af;
      return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
    });
  }, [
    entries,
    activeCategory,
    filterArchetype,
    filterTool,
    filterEntry,
    favOnly,
    query,
  ]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: entries.length };
    for (const c of CATEGORIES) map[c] = 0;
    for (const e of entries) map[e.category] = (map[e.category] ?? 0) + 1;
    return map;
  }, [entries]);

  async function handleCopy(e: Entry) {
    if (!e.prompt_text) {
      toast.error("Nothing to copy");
      return;
    }
    await navigator.clipboard.writeText(e.prompt_text);
    const { error } = await supabase
      .from("prompt_library")
      .update({ times_used: e.times_used + 1 } as never)
      .eq("id", e.id);
    if (!error) {
      setEntries((prev) =>
        prev.map((x) =>
          x.id === e.id ? { ...x, times_used: x.times_used + 1 } : x,
        ),
      );
    }
    toast.success("Copied to clipboard");
  }

  async function toggleFav(e: Entry) {
    const next = !e.is_favorite;
    const { error } = await supabase
      .from("prompt_library")
      .update({ is_favorite: next } as never)
      .eq("id", e.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEntries((prev) =>
      prev.map((x) => (x.id === e.id ? { ...x, is_favorite: next } : x)),
    );
  }

  async function handleDelete(e: Entry) {
    if (!confirm(`Delete "${e.title}"?`)) return;
    const { error } = await supabase
      .from("prompt_library")
      .delete()
      .eq("id", e.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
    setDetail(null);
    toast.success("Deleted");
  }

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      {/* header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <p className="label-mono mb-2">PROMPT VAULT</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Library
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Reusable prompts, templates, and recipes tagged by archetype, tool,
            and performance. What worked, ready to use again.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setPrefill(null);
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New entry
        </Button>
      </div>

      {/* category segmented control */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-border">
        <CategoryTab
          active={activeCategory === "all"}
          label="All"
          count={counts.all}
          onClick={() => setActiveCategory("all")}
        />
        {CATEGORIES.map((c) => (
          <CategoryTab
            key={c}
            active={activeCategory === c}
            label={CATEGORY_LABEL[c]}
            count={counts[c] ?? 0}
            onClick={() => setActiveCategory(c)}
          />
        ))}
      </div>

      {/* secondary filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, prompt, notes…"
            className="pl-9"
          />
        </div>
        <Select value={filterArchetype} onValueChange={setFilterArchetype}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Archetype" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All archetypes</SelectItem>
            {ARCHETYPES.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTool} onValueChange={setFilterTool}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tool" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tools</SelectItem>
            {TOOLS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEntry} onValueChange={setFilterEntry}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Entry point" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entry points</SelectItem>
            {ENTRY_POINTS.map((e) => (
              <SelectItem key={e} value={e}>
                {e.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={favOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFavOnly((v) => !v)}
        >
          <Star className={cn("h-4 w-4", favOnly && "fill-current")} />
          Favorites
        </Button>
      </div>

      {/* grid */}
      {loading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
          <Sparkles className="h-6 w-6 mx-auto mb-3 text-muted-foreground" />
          <p className="label-mono mb-2">Empty reel</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {entries.length === 0
              ? "Save your first prompt, hook, or recipe so future campaigns move faster."
              : "No entries match the current filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              brandName={
                brands.find((b) => b.id === e.source_brand_id)?.name ?? null
              }
              onOpen={() => setDetail(e)}
              onCopy={() => handleCopy(e)}
              onFav={() => toggleFav(e)}
              onEdit={() => {
                setEditing(e);
                setPrefill(null);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(e)}
            />
          ))}
        </div>
      )}

      <EntryForm
        open={showForm}
        onOpenChange={(v) => {
          setShowForm(v);
          if (!v) {
            setEditing(null);
            setPrefill(null);
          }
        }}
        editing={editing}
        prefill={prefill}
        brands={brands}
        onSaved={(row) => {
          setEntries((prev) => {
            const idx = prev.findIndex((x) => x.id === row.id);
            if (idx === -1) return [row, ...prev];
            const next = [...prev];
            next[idx] = row;
            return next;
          });
        }}
      />

      <EntryDetail
        entry={detail}
        brandName={
          detail
            ? (brands.find((b) => b.id === detail.source_brand_id)?.name ??
              null)
            : null
        }
        onClose={() => setDetail(null)}
        onCopy={(e) => handleCopy(e)}
        onFav={(e) => toggleFav(e)}
        onDelete={(e) => handleDelete(e)}
        onEdit={(e) => {
          setDetail(null);
          setEditing(e);
          setShowForm(true);
        }}
      />
    </div>
  );
}

// ---------- subcomponents ----------
function CategoryTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "label-mono px-3 py-2 border-b-2 transition-colors -mb-px",
        active
          ? "border-[#E0301E] text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className="ml-1.5 opacity-60">({count})</span>
    </button>
  );
}

function EntryCard({
  entry,
  brandName,
  onOpen,
  onCopy,
  onFav,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  brandName: string | null;
  onOpen: () => void;
  onCopy: () => void;
  onFav: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group border border-border rounded-[3px] bg-card hover:border-foreground/40 transition-colors flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        className="text-left p-4 flex-1"
      >
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="label-mono text-[10px] px-1.5 py-0.5 bg-foreground text-background rounded-[2px]">
            {CATEGORY_LABEL[entry.category]}
          </span>
          {entry.archetype && (
            <span className="label-mono text-[10px] px-1.5 py-0.5 border border-border rounded-[2px]">
              {entry.archetype}
            </span>
          )}
          {entry.tool && (
            <span className="label-mono text-[10px] px-1.5 py-0.5 border border-border rounded-[2px]">
              {entry.tool}
            </span>
          )}
          {entry.entry_point && (
            <span className="label-mono text-[10px] px-1.5 py-0.5 border border-border rounded-[2px]">
              {entry.entry_point.replace("_", " ")}
            </span>
          )}
        </div>
        <h3 className="font-display font-semibold text-base leading-tight mb-2 line-clamp-2">
          {entry.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-3 font-mono leading-relaxed">
          {entry.prompt_text}
        </p>
        {(entry.source_metric || entry.performance_tag || brandName) && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {entry.source_metric && (
              <span className="label-mono text-[10px] px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-700 border border-emerald-600/30">
                {entry.source_metric}
              </span>
            )}
            {entry.performance_tag && (
              <span className="label-mono text-[10px] px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-700 border border-emerald-600/30">
                {entry.performance_tag}
              </span>
            )}
            {brandName && (
              <span className="label-mono text-[10px] text-muted-foreground">
                ← {brandName}
              </span>
            )}
          </div>
        )}
      </button>
      <div className="border-t border-border px-2 py-1.5 flex items-center justify-between">
        <span className="label-mono text-[10px] text-muted-foreground pl-2">
          Used {entry.times_used}×
        </span>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onFav}
            title="Favorite"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                entry.is_favorite && "fill-[#E0301E] text-[#E0301E]",
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onCopy}
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onEdit}
            title="Edit"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-[#E0301E]"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntryDetail({
  entry,
  brandName,
  onClose,
  onCopy,
  onFav,
  onEdit,
  onDelete,
}: {
  entry: Entry | null;
  brandName: string | null;
  onClose: () => void;
  onCopy: (e: Entry) => void;
  onFav: (e: Entry) => void;
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}) {
  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        {entry && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className="label-mono text-[10px] px-1.5 py-0.5 bg-foreground text-background rounded-[2px]">
                  {CATEGORY_LABEL[entry.category]}
                </span>
                {entry.archetype && (
                  <span className="label-mono text-[10px] px-1.5 py-0.5 border border-border rounded-[2px]">
                    {entry.archetype}
                  </span>
                )}
                {entry.tool && (
                  <span className="label-mono text-[10px] px-1.5 py-0.5 border border-border rounded-[2px]">
                    {entry.tool}
                  </span>
                )}
                {entry.entry_point && (
                  <span className="label-mono text-[10px] px-1.5 py-0.5 border border-border rounded-[2px]">
                    {entry.entry_point.replace("_", " ")}
                  </span>
                )}
              </div>
              <DialogTitle className="font-display text-2xl">
                {entry.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <p className="label-mono mb-1.5">Content</p>
                <pre className="text-sm font-mono whitespace-pre-wrap border border-border rounded-[3px] bg-muted/30 p-3 max-h-72 overflow-y-auto">
                  {entry.prompt_text}
                </pre>
              </div>

              {entry.notes && (
                <div>
                  <p className="label-mono mb-1.5">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{entry.notes}</p>
                </div>
              )}

              {(entry.source_metric ||
                entry.performance_tag ||
                brandName) && (
                <div className="border border-border rounded-[3px] p-3 bg-muted/20">
                  <p className="label-mono mb-2">Where it came from</p>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    {brandName && (
                      <span>
                        <span className="text-muted-foreground">Brand: </span>
                        {brandName}
                      </span>
                    )}
                    {entry.source_metric && (
                      <span className="label-mono text-[10px] px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-700 border border-emerald-600/30">
                        {entry.source_metric}
                      </span>
                    )}
                    {entry.performance_tag && (
                      <span className="label-mono text-[10px] px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-700 border border-emerald-600/30">
                        {entry.performance_tag}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="label-mono">Used {entry.times_used}×</span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => onDelete(entry)}
                className="text-muted-foreground hover:text-[#E0301E] mr-auto"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button variant="outline" onClick={() => onFav(entry)}>
                <Star
                  className={cn(
                    "h-4 w-4",
                    entry.is_favorite && "fill-[#E0301E] text-[#E0301E]",
                  )}
                />
                {entry.is_favorite ? "Favorited" : "Favorite"}
              </Button>
              <Button variant="outline" onClick={() => onEdit(entry)}>
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              <Button onClick={() => onCopy(entry)}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- form ----------
function EntryForm({
  open,
  onOpenChange,
  editing,
  prefill,
  brands,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Entry | null;
  prefill: Partial<Entry> | null;
  brands: BrandRow[];
  onSaved: (row: Entry) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<LibraryCategory>("generation_prompt");
  const [promptText, setPromptText] = useState("");
  const [archetype, setArchetype] = useState<string>("");
  const [tool, setTool] = useState<string>("");
  const [entryPoint, setEntryPoint] = useState<string>("");
  const [performanceTag, setPerformanceTag] = useState("");
  const [sourceMetric, setSourceMetric] = useState("");
  const [sourceBrandId, setSourceBrandId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setCategory(editing.category);
      setPromptText(editing.prompt_text ?? "");
      setArchetype(editing.archetype ?? "");
      setTool(editing.tool ?? "");
      setEntryPoint(editing.entry_point ?? "");
      setPerformanceTag(editing.performance_tag ?? "");
      setSourceMetric(editing.source_metric ?? "");
      setSourceBrandId(editing.source_brand_id ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setTitle(prefill?.title ?? "");
      setCategory(
        (prefill?.category as LibraryCategory) ?? "generation_prompt",
      );
      setPromptText(prefill?.prompt_text ?? "");
      setArchetype(prefill?.archetype ?? "");
      setTool(prefill?.tool ?? "");
      setEntryPoint(prefill?.entry_point ?? "");
      setPerformanceTag(prefill?.performance_tag ?? "");
      setSourceMetric(prefill?.source_metric ?? "");
      setSourceBrandId(prefill?.source_brand_id ?? "");
      setNotes(prefill?.notes ?? "");
    }
  }, [open, editing, prefill]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    if (!promptText.trim()) {
      toast.error("Content required");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      category,
      prompt_text: promptText.trim(),
      archetype: archetype || null,
      tool: tool || null,
      entry_point: entryPoint || null,
      performance_tag: performanceTag.trim() || null,
      source_metric: sourceMetric.trim() || null,
      source_brand_id: sourceBrandId || null,
      notes: notes.trim() || null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("prompt_library")
        .update(payload as never)
        .eq("id", editing.id)
        .select()
        .single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      onSaved(data as unknown as Entry);
      toast.success("Saved");
      onOpenChange(false);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) {
        setSaving(false);
        toast.error("Not signed in");
        return;
      }
      const { data, error } = await supabase
        .from("prompt_library")
        .insert({ ...payload, user_id: uid } as never)
        .select()
        .single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      onSaved(data as unknown as Entry);
      toast.success("Saved to library");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Edit entry" : "New library entry"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="label-mono mb-1.5 block">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as LibraryCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="label-mono mb-1.5 block">
              Title <span className="text-[#E0301E]">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. POV scroll-stopper — first-person reveal"
              required
            />
          </div>

          <div>
            <Label className="label-mono mb-1.5 block">
              Content <span className="text-[#E0301E]">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              {CONTENT_HELPER[category]}
            </p>
            <Textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="label-mono mb-1.5 block">Archetype</Label>
              <Select
                value={archetype || "_none"}
                onValueChange={(v) => setArchetype(v === "_none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {ARCHETYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-mono mb-1.5 block">Tool</Label>
              <Select
                value={tool || "_none"}
                onValueChange={(v) => setTool(v === "_none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {TOOLS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-mono mb-1.5 block">Entry point</Label>
              <Select
                value={entryPoint || "_none"}
                onValueChange={(v) => setEntryPoint(v === "_none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {ENTRY_POINTS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-mono mb-1.5 block">Performance tag</Label>
              <Input
                value={performanceTag}
                onChange={(e) => setPerformanceTag(e.target.value)}
                placeholder="winner, top-quartile…"
              />
            </div>
            <div>
              <Label className="label-mono mb-1.5 block">Source metric</Label>
              <Input
                value={sourceMetric}
                onChange={(e) => setSourceMetric(e.target.value)}
                placeholder="e.g. 3.4× ROAS"
              />
            </div>
          </div>

          <div>
            <Label className="label-mono mb-1.5 block">Source brand</Label>
            <Select
              value={sourceBrandId || "_none"}
              onValueChange={(v) => setSourceBrandId(v === "_none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">—</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="label-mono mb-1.5 block">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="When to use this, what to watch for…"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
