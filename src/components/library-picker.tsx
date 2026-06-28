import { useEffect, useMemo, useState } from "react";
import { Search, Star, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type LibraryCategory =
  | "generation_prompt"
  | "script_template"
  | "hook_formula"
  | "shot_recipe"
  | "vo_style";

export type LibraryEntry = {
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
  times_used: number;
  is_favorite: boolean;
};

export const CATEGORY_LABEL: Record<LibraryCategory, string> = {
  generation_prompt: "Generation prompt",
  script_template: "Script template",
  hook_formula: "Hook formula",
  shot_recipe: "Shot recipe",
  vo_style: "VO style",
};

/**
 * Increment usage counter when a library entry is inserted/copied.
 */
export async function incrementLibraryUse(id: string, current: number) {
  await supabase
    .from("prompt_library")
    .update({ times_used: (current ?? 0) + 1 } as never)
    .eq("id", id);
}

/**
 * Reusable Library picker — opens a modal, lets the user search & filter
 * entries, and returns the selected entry's prompt_text via `onInsert`.
 * Also bumps times_used.
 */
export function LibraryPicker({
  open,
  onOpenChange,
  category,
  onInsert,
  title = "Insert from Library",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category?: LibraryCategory;
  onInsert: (entry: LibraryEntry) => void;
  title?: string;
}) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);

  useEffect(() => {
    if (!open) return;
    let q = supabase
      .from("prompt_library")
      .select(
        "id, title, category, archetype, tool, entry_point, prompt_text, notes, performance_tag, source_metric, times_used, is_favorite",
      )
      .order("is_favorite", { ascending: false })
      .order("times_used", { ascending: false })
      .limit(200);
    if (category) q = q.eq("category", category);
    q.then(({ data }) => setEntries((data ?? []) as unknown as LibraryEntry[]));
  }, [open, category]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (favOnly && !e.is_favorite) return false;
      if (!s) return true;
      return (
        e.title.toLowerCase().includes(s) ||
        (e.prompt_text ?? "").toLowerCase().includes(s) ||
        (e.notes ?? "").toLowerCase().includes(s)
      );
    });
  }, [entries, search, favOnly]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, prompt, notes…"
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant={favOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFavOnly((v) => !v)}
          >
            <Star className={cn("h-4 w-4", favOnly && "fill-current")} />
            Favorites
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto border border-border rounded-[3px] divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Sparkles className="h-5 w-5 mx-auto mb-2 opacity-50" />
              Nothing here yet.
            </div>
          ) : (
            filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={async () => {
                  await incrementLibraryUse(e.id, e.times_used);
                  onInsert({ ...e, times_used: e.times_used + 1 });
                  onOpenChange(false);
                }}
                className="w-full text-left p-3 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="label-mono text-[10px]">
                        {CATEGORY_LABEL[e.category]}
                      </span>
                      {e.archetype && (
                        <span className="label-mono text-[10px] px-1.5 py-0.5 border border-border rounded-[2px]">
                          {e.archetype}
                        </span>
                      )}
                      {e.tool && (
                        <span className="label-mono text-[10px] px-1.5 py-0.5 border border-border rounded-[2px]">
                          {e.tool}
                        </span>
                      )}
                      {e.is_favorite && (
                        <Star className="h-3 w-3 fill-current text-[#E0301E]" />
                      )}
                    </div>
                    <div className="font-display font-semibold text-sm truncate">
                      {e.title}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {e.prompt_text}
                    </div>
                  </div>
                  {e.source_metric && (
                    <span className="label-mono text-[10px] px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-700 border border-emerald-600/30 whitespace-nowrap">
                      {e.source_metric}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}