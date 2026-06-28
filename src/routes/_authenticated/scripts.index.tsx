import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowRight,
  Film,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  VolumeX,
  Volume2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Database } from "@/integrations/supabase/types";

type EntryPoint = Database["public"]["Enums"]["angle_entry_point"];
type ScriptStatus = "draft" | "approved" | "archived";

const ARCHETYPES = [
  "UGC testimonial",
  "Cinematic hero",
  "Problem→solution",
  "Founder VO",
  "Listicle",
  "Demo",
] as const;
type Archetype = (typeof ARCHETYPES)[number];

const ENTRY_POINT_LABEL: Record<EntryPoint, string> = {
  pain: "Pain",
  outcome: "Outcome",
  objection: "Objection",
  social_proof: "Social proof",
  identity: "Identity",
  curiosity: "Curiosity",
};

const ENTRY_POINT_COLOR: Record<
  EntryPoint,
  { bg: string; text: string; border: string; dot: string }
> = {
  pain: { bg: "bg-[#E0301E]/10", text: "text-[#E0301E]", border: "border-[#E0301E]/40", dot: "bg-[#E0301E]" },
  outcome: { bg: "bg-emerald-700/10", text: "text-emerald-800", border: "border-emerald-700/40", dot: "bg-emerald-700" },
  objection: { bg: "bg-amber-700/10", text: "text-amber-800", border: "border-amber-700/40", dot: "bg-amber-700" },
  social_proof: { bg: "bg-sky-700/10", text: "text-sky-800", border: "border-sky-700/40", dot: "bg-sky-700" },
  identity: { bg: "bg-purple-700/10", text: "text-purple-800", border: "border-purple-700/40", dot: "bg-purple-700" },
  curiosity: { bg: "bg-rose-700/10", text: "text-rose-800", border: "border-rose-700/40", dot: "bg-rose-700" },
};

function EntryPointChip({ ep }: { ep: EntryPoint }) {
  const c = ENTRY_POINT_COLOR[ep];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono uppercase tracking-wider border rounded-[2px] text-[10px] px-2 py-0.5",
        c.bg,
        c.text,
        c.border,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {ENTRY_POINT_LABEL[ep]}
    </span>
  );
}

function StatusChip({ status }: { status: ScriptStatus }) {
  const styles: Record<ScriptStatus, string> = {
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

function ArchetypeChip({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px] bg-background text-foreground/80">
      {value}
    </span>
  );
}

type AngleLite = {
  id: string;
  title: string;
  entry_point: EntryPoint | null;
  status: "draft" | "approved" | "archived";
  brief: {
    id: string;
    project_name: string;
    brand: { id: string; name: string } | null;
  } | null;
};

type AngleFull = {
  id: string;
  title: string;
  entry_point: EntryPoint | null;
  hook_seed: string | null;
  description: string | null;
  brief: {
    id: string;
    project_name: string;
    core_driver: string | null;
    objection: string | null;
    customer_language: string | null;
    benefits: unknown;
    offer_type: string | null;
    offer_detail: string | null;
    archetypes: unknown;
    brand: { id: string; name: string } | null;
  } | null;
};

type ScriptRow = {
  id: string;
  angle_id: string;
  archetype: string | null;
  hook: string | null;
  desire_beat: string | null;
  body: string | null;
  proof_beat: string | null;
  cta: string | null;
  vo_script: string | null;
  on_screen_text: string | null;
  target_duration: number | null;
  duration_seconds: number | null;
  works_sound_off: boolean;
  status: ScriptStatus;
};

type AiDraft = {
  hook: string;
  desire_beat: string;
  body: string;
  proof_beat: string;
  cta: string;
  vo_script: string;
  on_screen_text: string;
  estimated_duration: number;
  sound_off_ok: boolean;
  duration_note: string;
  archetype: string;
};

const searchSchema = z.object({
  angle: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/scripts/")({
  validateSearch: searchSchema,
  component: ScriptsWorkspace,
});

function ScriptsWorkspace() {
  const { angle: angleParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [angles, setAngles] = useState<AngleLite[] | null>(null);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [selectedAngle, setSelectedAngle] = useState<AngleFull | null>(null);
  const [scripts, setScripts] = useState<ScriptRow[] | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScriptRow | null>(null);
  const [detail, setDetail] = useState<ScriptRow | null>(null);

  const [aiPickerOpen, setAiPickerOpen] = useState(false);
  const [aiQueue, setAiQueue] = useState<AiDraft[]>([]);
  const [aiCurrent, setAiCurrent] = useState<AiDraft | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("angles")
        .select(
          "id, title, entry_point, status, brief:briefs(id, project_name, brand:brands(id, name))",
        )
        .order("status", { ascending: true })
        .order("priority", { ascending: true });
      setAngles((data as unknown as AngleLite[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!angleParam) {
      setSelectedAngle(null);
      setScripts(null);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("angles")
        .select(
          "id, title, entry_point, hook_seed, description, brief:briefs(id, project_name, core_driver, objection, customer_language, benefits, offer_type, offer_detail, archetypes, brand:brands(id, name))",
        )
        .eq("id", angleParam)
        .maybeSingle();
      if (alive) setSelectedAngle((data as unknown as AngleFull) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [angleParam]);

  const loadScripts = async (angleId: string) => {
    const { data } = await supabase
      .from("scripts")
      .select(
        "id, angle_id, archetype, hook, desire_beat, body, proof_beat, cta, vo_script, on_screen_text, target_duration, duration_seconds, works_sound_off, status",
      )
      .eq("angle_id", angleId)
      .order("created_at", { ascending: true });
    setScripts((data as unknown as ScriptRow[]) ?? []);
  };

  useEffect(() => {
    if (angleParam) loadScripts(angleParam);
  }, [angleParam]);

  const filteredAngles = useMemo(() => {
    if (!angles) return [];
    const s = search.trim().toLowerCase();
    // Sort: approved first
    const sorted = [...angles].sort((a, b) => {
      const rank = (st: string) => (st === "approved" ? 0 : st === "draft" ? 1 : 2);
      return rank(a.status) - rank(b.status);
    });
    if (!s) return sorted;
    return sorted.filter(
      (a) =>
        a.title.toLowerCase().includes(s) ||
        (a.brief?.project_name ?? "").toLowerCase().includes(s) ||
        (a.brief?.brand?.name ?? "").toLowerCase().includes(s),
    );
  }, [angles, search]);

  // Group by brief for the dropdown
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: AngleLite[] }>();
    for (const a of filteredAngles) {
      const key = a.brief?.id ?? "_orphan";
      const label =
        (a.brief?.brand?.name ?? "—") + " · " + (a.brief?.project_name ?? "—");
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(a);
    }
    return Array.from(map.values());
  }, [filteredAngles]);

  const selectAngle = (id: string) => {
    navigate({ search: { angle: id } });
    setPickerOpen(false);
  };

  const benefitStrings = useMemo(() => {
    const b = selectedAngle?.brief?.benefits as unknown;
    if (!b) return [];
    if (Array.isArray(b)) return b.filter((x) => typeof x === "string" && x.trim()) as string[];
    if (typeof b === "object") {
      return Object.values(b as Record<string, unknown>).filter(
        (x) => typeof x === "string" && (x as string).trim(),
      ) as string[];
    }
    return [];
  }, [selectedAngle]);

  const briefArchetypes = useMemo(() => {
    const a = selectedAngle?.brief?.archetypes as unknown;
    if (!a) return [] as string[];
    if (Array.isArray(a)) return a.filter((x) => typeof x === "string") as string[];
    return [];
  }, [selectedAngle]);

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="label-mono mb-2">Phase 02 · Scripting</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Scripts</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-xl">
          Hook, problem, solution, proof, CTA — written for sound-off feeds.
        </p>
      </div>

      {/* Angle selector */}
      <div className="border border-border rounded-[3px] bg-card p-4 mb-6 flex flex-wrap items-center gap-4">
        <span className="label-mono">Angle</span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex-1 min-w-[320px] flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 rounded-[3px] text-sm hover:border-foreground/40 transition-colors"
            >
              {selectedAngle ? (
                <span className="flex items-center gap-2 truncate">
                  <span className="text-muted-foreground truncate">
                    {selectedAngle.brief?.brand?.name ?? "—"} · {selectedAngle.brief?.project_name ?? "—"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium truncate">{selectedAngle.title}</span>
                  {selectedAngle.entry_point && <EntryPointChip ep={selectedAngle.entry_point} />}
                </span>
              ) : (
                <span className="text-muted-foreground">Select an angle…</span>
              )}
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[460px] p-0" align="start">
            <div className="p-2 border-b border-border">
              <Input
                placeholder="Search angles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {grouped.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No angles match.
                </div>
              ) : (
                grouped.map((g) => (
                  <div key={g.label}>
                    <div className="label-mono px-3 py-1.5 bg-background/60 border-b border-border/60 text-[10px]">
                      {g.label}
                    </div>
                    {g.items.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => selectAngle(a.id)}
                        className="w-full text-left px-3 py-2 hover:bg-background/60 border-b border-border/60 last:border-b-0 flex items-center gap-2"
                      >
                        <span className="text-sm font-medium flex-1 truncate">{a.title}</span>
                        {a.entry_point && <EntryPointChip ep={a.entry_point} />}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {!selectedAngle ? (
        <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
          <p className="label-mono mb-3">No angle selected</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Pick an approved angle above to start scripting.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* LEFT context */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="border border-border rounded-[3px] bg-card p-5 space-y-5">
              <div>
                <p className="label-mono mb-4 text-[var(--color-rec)]">Working from</p>
                <div className="flex items-center gap-2 mb-2">
                  {selectedAngle.entry_point && <EntryPointChip ep={selectedAngle.entry_point} />}
                </div>
                <h3 className="font-display text-lg font-bold leading-tight">
                  {selectedAngle.title}
                </h3>
                {selectedAngle.hook_seed && (
                  <p className="text-sm italic text-foreground/80 mt-2">
                    "{selectedAngle.hook_seed}"
                  </p>
                )}
                {selectedAngle.description && (
                  <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                    {selectedAngle.description}
                  </p>
                )}
              </div>
              <div className="border-t border-border pt-4 space-y-3 text-sm">
                <Field label="Core driver" value={selectedAngle.brief?.core_driver} />
                <Field label="#1 objection" value={selectedAngle.brief?.objection} />
                <div>
                  <p className="label-mono mb-1 text-[var(--color-rec)]">Steal these words</p>
                  {selectedAngle.brief?.customer_language ? (
                    <p className="text-foreground whitespace-pre-wrap text-sm italic">
                      {selectedAngle.brief.customer_language}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </div>
                <div>
                  <p className="label-mono mb-1">Benefits</p>
                  {benefitStrings.length === 0 ? (
                    <p className="text-muted-foreground">—</p>
                  ) : (
                    <ul className="space-y-1">
                      {benefitStrings.map((b, i) => (
                        <li key={i}>· {b}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="label-mono mb-1">Offer</p>
                  {selectedAngle.brief?.offer_type ? (
                    <p>
                      <span className="font-medium">{selectedAngle.brief.offer_type}</span>
                      {selectedAngle.brief.offer_detail && (
                        <span className="text-muted-foreground"> — {selectedAngle.brief.offer_detail}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT working area */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="label-mono">Scripts</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAiPickerOpen(true)}
                  disabled={!selectedAngle.brief?.core_driver}
                  title={
                    !selectedAngle.brief?.core_driver
                      ? "Add a core driver to the brief first — AI needs audience context."
                      : "Let AI draft a script from this angle."
                  }
                >
                  <Sparkles className="h-4 w-4" />
                  Draft script
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setAiCurrent(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New script
                </Button>
              </div>
            </div>

            {scripts === null ? (
              <div className="border border-border rounded-[3px] bg-card animate-pulse h-48" />
            ) : scripts.length === 0 ? (
              <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-12 text-center">
                <p className="label-mono mb-3">No scripts yet</p>
                <p className="text-sm text-muted-foreground mb-5">
                  Write the first cut for this angle.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New script
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {scripts.map((s) => (
                  <ScriptCard
                    key={s.id}
                    script={s}
                    onOpen={() => setDetail(s)}
                    onEdit={() => {
                      setEditing(s);
                      setFormOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {selectedAngle && (
        <ScriptFormDialog
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) {
              setEditing(null);
              setAiCurrent(null);
              // Pop next AI draft from the queue, if any
              setAiQueue((q) => {
                if (q.length === 0) return q;
                const [next, ...rest] = q;
                setAiCurrent(next);
                setTimeout(() => setFormOpen(true), 50);
                return rest;
              });
            }
          }}
          angleId={selectedAngle.id}
          briefArchetypes={briefArchetypes}
          existing={editing}
          aiDraft={aiCurrent}
          onSaved={async () => {
            await loadScripts(selectedAngle.id);
          }}
        />
      )}

      {selectedAngle && (
        <AiDraftPickerDialog
          open={aiPickerOpen}
          onOpenChange={setAiPickerOpen}
          briefArchetypes={briefArchetypes}
          angle={selectedAngle}
          onDrafts={(drafts) => {
            if (drafts.length === 0) return;
            const [first, ...rest] = drafts;
            setEditing(null);
            setAiCurrent(first);
            setAiQueue(rest);
            setFormOpen(true);
          }}
        />
      )}

      <ScriptDetailDialog
        script={detail}
        angle={selectedAngle}
        onOpenChange={(o) => !o && setDetail(null)}
        onEdit={(s) => {
          setDetail(null);
          setEditing(s);
          setFormOpen(true);
        }}
        onStatusChange={async (s, status) => {
          await supabase.from("scripts").update({ status }).eq("id", s.id);
          if (selectedAngle) await loadScripts(selectedAngle.id);
          setDetail({ ...s, status });
        }}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="label-mono mb-1">{label}</p>
      <p className="text-foreground">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

/* ============================================================
   DURATION METER
   ============================================================ */

type Zone = "tooShort" | "sweet" | "consider" | "tooLong";

function durationZone(d: number | null): Zone {
  if (d === null || d <= 0) return "tooShort";
  if (d < 15) return "tooShort";
  if (d <= 30) return "sweet";
  if (d <= 60) return "consider";
  return "tooLong";
}

const ZONE_META: Record<Zone, { label: string; caption: string; color: string; track: string }> = {
  tooShort: {
    label: "Too short",
    caption: "Under 15s — barely room for the promise to land.",
    color: "bg-[var(--color-rec)] text-white",
    track: "bg-[var(--color-rec)]",
  },
  sweet: {
    label: "Awareness sweet spot",
    caption: "15–30s — Meta's prime feed window.",
    color: "bg-emerald-700 text-white",
    track: "bg-emerald-700",
  },
  consider: {
    label: "Consideration",
    caption: "30–60s — works for warmer audiences.",
    color: "bg-amber-600 text-white",
    track: "bg-amber-600",
  },
  tooLong: {
    label: "Too long",
    caption: "Over 60s — feed scrolls past it.",
    color: "bg-[var(--color-rec)] text-white",
    track: "bg-[var(--color-rec)]",
  },
};

function DurationMeter({ value }: { value: number | null }) {
  const max = 90;
  const d = value ?? 0;
  const pct = Math.min(100, (d / max) * 100);
  const zone = durationZone(value);
  const meta = ZONE_META[zone];
  // Stops: 15, 30, 60 over 90
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="label-mono">Duration meter</p>
        <span
          className={cn(
            "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[2px]",
            meta.color,
          )}
        >
          {d}s · {meta.label}
        </span>
      </div>
      <div className="relative h-2 bg-background border border-border rounded-[2px] overflow-hidden">
        {/* zone backgrounds */}
        <div className="absolute inset-y-0 left-0 bg-[var(--color-rec)]/15" style={{ width: `${(15 / max) * 100}%` }} />
        <div className="absolute inset-y-0 bg-emerald-700/15" style={{ left: `${(15 / max) * 100}%`, width: `${((30 - 15) / max) * 100}%` }} />
        <div className="absolute inset-y-0 bg-amber-600/15" style={{ left: `${(30 / max) * 100}%`, width: `${((60 - 30) / max) * 100}%` }} />
        <div className="absolute inset-y-0 bg-[var(--color-rec)]/15" style={{ left: `${(60 / max) * 100}%`, right: 0 }} />
        {/* fill */}
        <div className={cn("absolute inset-y-0 left-0", meta.track)} style={{ width: `${pct}%`, opacity: 0.85 }} />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
        <span>0s</span>
        <span>15s</span>
        <span>30s</span>
        <span>60s</span>
        <span>90s+</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2 italic">{meta.caption}</p>
    </div>
  );
}

/* ============================================================
   SCRIPT CARD
   ============================================================ */

function ScriptCard({
  script,
  onOpen,
  onEdit,
}: {
  script: ScriptRow;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const d = script.duration_seconds ?? 0;
  const zone = durationZone(script.duration_seconds);
  const meta = ZONE_META[zone];
  return (
    <article className="border border-border bg-card rounded-[3px] p-5 hover:border-foreground/40 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ArchetypeChip value={script.archetype} />
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
              script.works_sound_off
                ? "border-emerald-700/40 text-emerald-800 bg-emerald-700/10"
                : "border-border text-muted-foreground bg-background",
            )}
          >
            {script.works_sound_off ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            {script.works_sound_off ? "Sound-off ready" : "Needs sound-off pass"}
          </span>
        </div>
        <StatusChip status={script.status} />
      </div>
      <button className="text-left w-full" onClick={onOpen}>
        <h3 className="font-display text-lg font-bold leading-snug mb-3 line-clamp-2">
          {script.hook?.split("\n")[0] || (
            <span className="text-muted-foreground italic">No hook yet</span>
          )}
        </h3>
      </button>
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/60">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">{d}s</span>
            <div className="flex-1 h-1.5 bg-background border border-border rounded-[2px] overflow-hidden relative max-w-[180px]">
              <div className={cn("absolute inset-y-0 left-0", meta.track)} style={{ width: `${Math.min(100, (d / 90) * 100)}%`, opacity: 0.85 }} />
            </div>
            <span className="label-mono text-[9px] text-muted-foreground">{meta.label}</span>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="label-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>
    </article>
  );
}

/* ============================================================
   SCRIPT FORM DIALOG
   ============================================================ */

function ScriptFormDialog({
  open,
  onOpenChange,
  angleId,
  briefArchetypes,
  existing,
  aiDraft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  angleId: string;
  briefArchetypes: string[];
  existing: ScriptRow | null;
  aiDraft?: AiDraft | null;
  onSaved: () => Promise<void>;
}) {
  const [archetype, setArchetype] = useState<string>("");
  const [hook, setHook] = useState("");
  const [desire, setDesire] = useState("");
  const [body, setBody] = useState("");
  const [proof, setProof] = useState("");
  const [cta, setCta] = useState("");
  const [voScript, setVoScript] = useState("");
  const [onScreenText, setOnScreenText] = useState("");
  const [targetDuration, setTargetDuration] = useState<number>(20);
  const [duration, setDuration] = useState<number>(20);
  const [worksSoundOff, setWorksSoundOff] = useState(false);
  const [status, setStatus] = useState<ScriptStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [durationNote, setDurationNote] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setArchetype(existing.archetype ?? "");
      setHook(existing.hook ?? "");
      setDesire(existing.desire_beat ?? "");
      setBody(existing.body ?? "");
      setProof(existing.proof_beat ?? "");
      setCta(existing.cta ?? "");
      setVoScript(existing.vo_script ?? "");
      setOnScreenText(existing.on_screen_text ?? "");
      setTargetDuration(existing.target_duration ?? 20);
      setDuration(existing.duration_seconds ?? 20);
      setWorksSoundOff(existing.works_sound_off);
      setStatus(existing.status);
      setDurationNote("");
    } else if (aiDraft) {
      setArchetype(aiDraft.archetype ?? "");
      setHook(aiDraft.hook ?? "");
      setDesire(aiDraft.desire_beat ?? "");
      setBody(aiDraft.body ?? "");
      setProof(aiDraft.proof_beat ?? "");
      setCta(aiDraft.cta ?? "");
      setVoScript(aiDraft.vo_script ?? "");
      setOnScreenText(aiDraft.on_screen_text ?? "");
      const est = Number(aiDraft.estimated_duration) || 20;
      setTargetDuration(est);
      setDuration(est);
      setWorksSoundOff(!!aiDraft.sound_off_ok);
      setStatus("draft");
      setDurationNote(aiDraft.duration_note ?? "");
    } else {
      // Default archetype to one of the brief's selected archetypes if any match the canonical list
      const defaultArchetype =
        briefArchetypes.find((a) => (ARCHETYPES as readonly string[]).includes(a)) ?? "";
      setArchetype(defaultArchetype);
      setHook("");
      setDesire("");
      setBody("");
      setProof("");
      setCta("");
      setVoScript("");
      setOnScreenText("");
      setTargetDuration(20);
      setDuration(20);
      setWorksSoundOff(false);
      setStatus("draft");
      setDurationNote("");
    }
  }, [open, existing, briefArchetypes, aiDraft]);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Not signed in");
      setSaving(false);
      return;
    }
    const payload = {
      angle_id: angleId,
      user_id: userId,
      archetype: archetype || null,
      hook: hook.trim() || null,
      desire_beat: desire.trim() || null,
      body: body.trim() || null,
      proof_beat: proof.trim() || null,
      cta: cta.trim() || null,
      vo_script: voScript.trim() || null,
      on_screen_text: onScreenText.trim() || null,
      target_duration: targetDuration || null,
      duration_seconds: duration || null,
      works_sound_off: worksSoundOff,
      status,
    };
    const { error } = existing
      ? await supabase.from("scripts").update(payload).eq("id", existing.id)
      : await supabase.from("scripts").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(existing ? "Script updated" : "Script saved");
    await onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <p className="label-mono">{existing ? "Edit script" : "New script"}</p>
          <DialogTitle className="font-display text-2xl">
            {existing ? hook.split("\n")[0] || "Untitled script" : "Write the next cut"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {!existing && aiDraft && (
            <div className="border border-[var(--color-rec)]/40 bg-[var(--color-rec)]/5 rounded-[3px] p-3">
              <p className="label-mono text-[var(--color-rec)] mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> AI draft
              </p>
              <p className="text-sm text-foreground">
                Your edit makes it shootable. Tighten the hook first.
              </p>
              {durationNote && (
                <p className="text-xs text-muted-foreground mt-1.5 italic">{durationNote}</p>
              )}
            </div>
          )}

          <FormField label="Archetype">
            <Select value={archetype || undefined} onValueChange={(v) => setArchetype(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick an archetype" />
              </SelectTrigger>
              <SelectContent>
                {ARCHETYPES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <Beat
            label="Hook (0–3s)"
            helper="Visual disruption + the line that names the pain or promises the payoff. This is the whole game."
            value={hook}
            onChange={setHook}
          />
          <Beat
            label="Problem / desire"
            helper="Name the ache or the want with the audience's own words."
            value={desire}
            onChange={setDesire}
          />
          <Beat
            label="Solution"
            helper="The product as the resolution — not as a feature list."
            value={body}
            onChange={setBody}
          />
          <Beat
            label="Proof"
            helper="A number, a testimonial beat, a before/after."
            value={proof}
            onChange={setProof}
          />
          <Beat
            label="CTA"
            helper="One clear action."
            value={cta}
            onChange={setCta}
          />

          <div className="border-t border-border pt-5">
            <p className="label-mono mb-3 text-[var(--color-rec)]">Built for sound-off</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="VO / spoken script">
                <Textarea
                  value={voScript}
                  onChange={(e) => setVoScript(e.target.value)}
                  rows={8}
                  placeholder="Read aloud, end to end."
                />
              </FormField>
              <FormField
                label="On-screen text"
                helper="What carries the message with the sound off."
              >
                <Textarea
                  value={onScreenText}
                  onChange={(e) => setOnScreenText(e.target.value)}
                  rows={8}
                  placeholder="Caption beats, lower thirds, on-screen titles."
                />
              </FormField>
            </div>
          </div>

          <div className="border-t border-border pt-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Target duration (s)">
                <Input
                  type="number"
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(Number(e.target.value))}
                />
              </FormField>
              <FormField label="Estimated duration (s)">
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </FormField>
            </div>
            <DurationMeter value={duration} />

            <div className="border border-border rounded-[3px] p-4 bg-background">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={worksSoundOff}
                  onCheckedChange={(v) => setWorksSoundOff(v === true)}
                  className="mt-0.5"
                />
                <div>
                  <p className="label-mono">Sound-off check</p>
                  <p className="text-sm">This script lands with the sound off.</p>
                  {!worksSoundOff && (
                    <p className="text-xs text-[var(--color-rec)] mt-1.5 font-mono uppercase tracking-wider">
                      Most Meta viewers watch muted — make the on-screen text carry it.
                    </p>
                  )}
                </div>
              </label>
            </div>

            <FormField label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as ScriptStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {existing ? "Save changes" : "Save script"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label-mono mb-1.5 block">{label}</label>
      {children}
      {helper && <p className="text-xs text-muted-foreground mt-1.5 italic">{helper}</p>}
    </div>
  );
}

function Beat({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border-l-2 border-border pl-4">
      <p className="label-mono mb-1.5">{label}</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder=""
      />
      {helper && <p className="text-xs text-muted-foreground mt-1.5 italic">{helper}</p>}
    </div>
  );
}

/* ============================================================
   SCRIPT DETAIL DIALOG
   ============================================================ */

function ScriptDetailDialog({
  script,
  angle,
  onOpenChange,
  onEdit,
  onStatusChange,
}: {
  script: ScriptRow | null;
  angle: AngleFull | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (s: ScriptRow) => void;
  onStatusChange: (s: ScriptRow, status: ScriptStatus) => Promise<void>;
}) {
  return (
    <Dialog open={!!script} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {script && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <ArchetypeChip value={script.archetype} />
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px]">
                  {script.duration_seconds ?? 0}s
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
                    script.works_sound_off
                      ? "border-emerald-700/40 text-emerald-800 bg-emerald-700/10"
                      : "border-border text-muted-foreground bg-background",
                  )}
                >
                  {script.works_sound_off ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  {script.works_sound_off ? "Sound-off ready" : "Sound-off pending"}
                </span>
                <StatusChip status={script.status} />
              </div>
              <DialogTitle className="font-display text-2xl leading-tight">
                {script.hook?.split("\n")[0] || "Untitled script"}
              </DialogTitle>
              {angle && (
                <p className="text-xs text-muted-foreground mt-1">
                  {angle.brief?.brand?.name ?? "—"} · {angle.brief?.project_name ?? "—"} · {angle.title}
                </p>
              )}
            </DialogHeader>

            <div className="py-4 space-y-5 border-t border-border">
              <BeatBlock label="Hook" value={script.hook} />
              <BeatBlock label="Problem / desire" value={script.desire_beat} />
              <BeatBlock label="Solution" value={script.body} />
              <BeatBlock label="Proof" value={script.proof_beat} />
              <BeatBlock label="CTA" value={script.cta} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border pt-5">
                <div>
                  <p className="label-mono mb-2 text-[var(--color-rec)]">VO / spoken</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {script.vo_script || <span className="text-muted-foreground italic">—</span>}
                  </p>
                </div>
                <div>
                  <p className="label-mono mb-2 text-[var(--color-rec)]">On-screen text</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {script.on_screen_text || <span className="text-muted-foreground italic">—</span>}
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <DurationMeter value={script.duration_seconds} />
              </div>

              <div className="border-t border-border pt-5">
                <p className="label-mono mb-1.5">Change status</p>
                <Select
                  value={script.status}
                  onValueChange={(v) => onStatusChange(script, v as ScriptStatus)}
                >
                  <SelectTrigger className="h-8 max-w-[200px]">
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

            <DialogFooter>
              <Button variant="outline" onClick={() => onEdit(script)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button asChild>
                <Link to="/storyboard" search={{ script: script.id }}>
                  <Film className="h-4 w-4" />
                  Build storyboard
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

function BeatBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-l-2 border-border pl-4">
      <p className="label-mono mb-1.5">{label}</p>
      <p className="text-sm whitespace-pre-wrap">
        {value || <span className="text-muted-foreground italic">—</span>}
      </p>
    </div>
  );
}