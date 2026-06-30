import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Search,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const searchSchema = z.object({ brief: z.string().optional() });

export const Route = createFileRoute("/_authenticated/qa")({
  validateSearch: searchSchema,
  component: QaPage,
});

type BriefRow = {
  id: string;
  project_name: string | null;
  status: string | null;
  objective: string | null;
  stats_claims: string | null;
  claims_substantiated: boolean | null;
  cannot_claim: string | null;
  regulated: boolean | null;
  disclosures: string | null;
  legal_copy: string | null;
  likeness_notes: string | null;
  ai_disclosure: boolean | null;
  captions_required: boolean | null;
  placements: unknown;
  brand: { id: string; name: string; voice: string | null; no_go_list: string | null } | null;
};

type QaRow = {
  id: string;
  brief_id: string;
  user_id: string;
  claims_ok: boolean | null;
  claims_substantiated_ok: boolean | null;
  disclosures_ok: boolean | null;
  legal_copy_ok: boolean | null;
  likeness_ok: boolean | null;
  ai_disclosure_ok: boolean | null;
  brand_ok: boolean | null;
  safe_zones_ok: boolean | null;
  captions_ok: boolean | null;
  specs_ok: boolean | null;
  policy_ok: boolean | null;
  reviewer: string | null;
  signed_off: boolean | null;
  reviewed_at: string | null;
  notes: Record<string, string> | null;
  updated_at: string;
};

type CheckKey =
  | "claims_substantiated_ok"
  | "claims_ok"
  | "disclosures_ok"
  | "legal_copy_ok"
  | "likeness_ok"
  | "ai_disclosure_ok"
  | "brand_ok"
  | "safe_zones_ok"
  | "captions_ok"
  | "specs_ok"
  | "policy_ok";

type CheckDef = {
  key: CheckKey;
  label: string;
  group: "compliance" | "brand_spec";
  context: (b: BriefRow) => React.ReactNode;
  applicable: (b: BriefRow) => boolean;
  preflag: (b: BriefRow) => string | null;
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function hasNineSixteen(b: BriefRow): boolean {
  const p = asStringArray(b.placements).map((s) => s.toLowerCase());
  return p.some((s) => s.includes("reel") || s.includes("stor"));
}

function ContextLine({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || !value.trim())
    return (
      <p className="label-mono text-muted-foreground">
        {label}: <span className="italic">none on brief</span>
      </p>
    );
  return (
    <div>
      <p className="label-mono mb-1">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

const CHECKS: CheckDef[] = [
  {
    key: "claims_substantiated_ok",
    label: "Claims substantiated",
    group: "compliance",
    context: (b) => (
      <div className="space-y-2">
        <ContextLine label="STATS / CLAIMS" value={b.stats_claims} />
        <p className="label-mono">
          SUBSTANTIATED ON BRIEF:{" "}
          <span className={b.claims_substantiated ? "text-foreground" : "text-[var(--color-rec)]"}>
            {b.claims_substantiated ? "yes" : "no"}
          </span>
        </p>
      </div>
    ),
    applicable: (b) => !!(b.stats_claims && b.stats_claims.trim()),
    preflag: (b) =>
      b.stats_claims && b.stats_claims.trim() && !b.claims_substantiated
        ? "Brief has claims but they are not marked substantiated."
        : null,
  },
  {
    key: "claims_ok",
    label: "Restricted claims avoided",
    group: "compliance",
    context: (b) => <ContextLine label="CANNOT CLAIM" value={b.cannot_claim} />,
    applicable: () => true,
    preflag: () => null,
  },
  {
    key: "disclosures_ok",
    label: "Required disclosures present",
    group: "compliance",
    context: (b) => (
      <div className="space-y-2">
        <p className="label-mono">REGULATED: <span className="text-foreground">{b.regulated ? "yes" : "no"}</span></p>
        <ContextLine label="DISCLOSURES" value={b.disclosures} />
      </div>
    ),
    applicable: (b) => !!b.regulated,
    preflag: (b) =>
      b.regulated && (!b.disclosures || !b.disclosures.trim())
        ? "Brief is regulated but no disclosures text provided."
        : null,
  },
  {
    key: "legal_copy_ok",
    label: "Mandatory legal copy present",
    group: "compliance",
    context: (b) => <ContextLine label="LEGAL COPY" value={b.legal_copy} />,
    applicable: (b) => !!(b.legal_copy && b.legal_copy.trim()),
    preflag: () => null,
  },
  {
    key: "likeness_ok",
    label: "Likeness / rights cleared",
    group: "compliance",
    context: (b) => <ContextLine label="LIKENESS NOTES" value={b.likeness_notes} />,
    applicable: () => true,
    preflag: () => null,
  },
  {
    key: "ai_disclosure_ok",
    label: "AI disclosure handled",
    group: "compliance",
    context: (b) => (
      <p className="label-mono">AI DISCLOSURE REQUIRED: <span className="text-foreground">{b.ai_disclosure ? "yes" : "no"}</span></p>
    ),
    applicable: (b) => !!b.ai_disclosure,
    preflag: () => null,
  },
  {
    key: "brand_ok",
    label: "On-brand (voice, no-go)",
    group: "brand_spec",
    context: (b) => (
      <div className="space-y-2">
        <ContextLine label="VOICE" value={b.brand?.voice ?? null} />
        <ContextLine label="NO-GO LIST" value={b.brand?.no_go_list ?? null} />
      </div>
    ),
    applicable: () => true,
    preflag: () => null,
  },
  {
    key: "safe_zones_ok",
    label: "Safe zones clear",
    group: "brand_spec",
    context: (b) => (
      <p className="label-mono text-muted-foreground">
        Applies to 9:16 deliverables (Reels / Stories). {hasNineSixteen(b) ? "Brief targets 9:16." : "No 9:16 placements on brief."}
      </p>
    ),
    applicable: (b) => hasNineSixteen(b),
    preflag: () => null,
  },
  {
    key: "captions_ok",
    label: "Captions present",
    group: "brand_spec",
    context: (b) => (
      <p className="label-mono">CAPTIONS REQUIRED: <span className="text-foreground">{b.captions_required ? "yes" : "no"}</span></p>
    ),
    applicable: (b) => !!b.captions_required,
    preflag: () => null,
  },
  {
    key: "specs_ok",
    label: "Specs valid (1080p, ratios, durations)",
    group: "brand_spec",
    context: () => (
      <p className="label-mono text-muted-foreground">Confirm 1080p min, correct aspect ratios per placement, durations within Meta limits.</p>
    ),
    applicable: () => true,
    preflag: () => null,
  },
  {
    key: "policy_ok",
    label: "Meta ad policy reviewed",
    group: "brand_spec",
    context: () => (
      <p className="label-mono text-muted-foreground">Restricted categories, before/after, personal attributes, sensational content.</p>
    ),
    applicable: () => true,
    preflag: () => null,
  },
];

function QaPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<BriefRow[] | null>(null);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(search.brief ?? null);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => { void loadBriefs(); }, []);

  async function loadBriefs() {
    const { data, error } = await supabase
      .from("briefs")
      .select(
        "id, project_name, status, objective, stats_claims, claims_substantiated, cannot_claim, regulated, disclosures, legal_copy, likeness_notes, ai_disclosure, captions_required, placements, brand:brands(id, name, voice, no_go_list)",
      )
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Failed to load briefs");
      setBriefs([]);
      return;
    }
    setBriefs((data as unknown as BriefRow[]) ?? []);
  }

  const selectedBrief = useMemo(
    () => briefs?.find((b) => b.id === selectedBriefId) ?? null,
    [briefs, selectedBriefId],
  );

  const filteredBriefs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = briefs ?? [];
    if (!q) return list;
    return list.filter((b) =>
      [b.project_name, b.brand?.name, b.objective]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [briefs, query]);

  if (!selectedBrief) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-8">
          <p className="label-mono mb-2">PHASE 7 · GATE</p>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">QA &amp; Compliance</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Pre-launch sign-off. Each check pulls the brief's own requirement so you review against the actual rule, not a generic prompt.
          </p>
        </div>

        <div className="border border-foreground p-6 rounded-[2px] max-w-2xl">
          <p className="label-mono mb-3">SELECT BRIEF</p>
          <Popover open={picker} onOpenChange={setPicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search briefs by brand, project, or objective…
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="p-2 border-b">
                <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to filter…" className="h-8" />
              </div>
              <div className="max-h-72 overflow-auto">
                {filteredBriefs.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No briefs.</p>
                ) : (
                  filteredBriefs.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setSelectedBriefId(b.id);
                        setPicker(false);
                        void navigate({ to: "/qa", search: { brief: b.id } });
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0"
                    >
                      <p className="font-medium text-sm">{b.brand?.name ?? "—"} · {b.project_name ?? "Untitled"}</p>
                      <p className="label-mono text-muted-foreground mt-0.5">{b.objective ?? "no objective"} · {b.status ?? "draft"}</p>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  }

  return (
    <QaReview
      brief={selectedBrief}
      onBack={() => {
        setSelectedBriefId(null);
        void navigate({ to: "/qa", search: {} });
      }}
    />
  );
}

function QaReview({ brief, onBack }: { brief: BriefRow; onBack: () => void }) {
  const [qa, setQa] = useState<QaRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewer, setReviewer] = useState("");
  const [uploadReady, setUploadReady] = useState(0);
  const [confirmUnlock, setConfirmUnlock] = useState<CheckKey | null>(null);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [brief.id]);

  async function load() {
    setLoading(true);
    const [{ data: existing }, { count }] = await Promise.all([
      supabase.from("qa_reviews").select("*").eq("brief_id", brief.id).maybeSingle(),
      supabase
        .from("deliverables")
        .select("id, cut:cuts!inner(brief_id)", { count: "exact", head: true })
        .eq("cut.brief_id", brief.id)
        .eq("upload_ready", true),
    ]);
    setUploadReady(count ?? 0);
    if (existing) {
      const row = existing as unknown as QaRow;
      setQa(row);
      setReviewer(row.reviewer ?? "");
    } else {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) { setLoading(false); return; }
      const { data: created, error } = await supabase
        .from("qa_reviews")
        .insert({ user_id: uid, brief_id: brief.id })
        .select()
        .single();
      if (error) toast.error(error.message);
      else setQa(created as unknown as QaRow);
    }
    setLoading(false);
  }

  async function patch(p: Partial<QaRow>) {
    if (!qa) return;
    const next = { ...qa, ...p } as QaRow;
    setQa(next);
    const { error } = await supabase.from("qa_reviews").update(p).eq("id", qa.id);
    if (error) toast.error(error.message);
  }

  async function toggleCheck(key: CheckKey, value: boolean) {
    if (!qa) return;
    if (qa.signed_off && !value) { setConfirmUnlock(key); return; }
    await patch({ [key]: value } as Partial<QaRow>);
  }

  async function confirmUnlockCheck() {
    if (!confirmUnlock || !qa) return;
    await patch({ [confirmUnlock]: false, signed_off: false, reviewed_at: null } as Partial<QaRow>);
    setConfirmUnlock(null);
    toast.message("Sign-off reverted");
  }

  async function setNote(key: CheckKey, value: string) {
    if (!qa) return;
    const notes = { ...(qa.notes ?? {}), [key]: value };
    await patch({ notes } as Partial<QaRow>);
  }

  async function signOff() {
    if (!qa) return;
    if (!reviewer.trim()) { toast.error("Reviewer name required"); return; }
    await patch({ signed_off: true, reviewer: reviewer.trim(), reviewed_at: new Date().toISOString() });
    toast.success("Review signed off");
  }

  async function revertSignoff() {
    if (!qa) return;
    await patch({ signed_off: false, reviewed_at: null });
    toast.message("Sign-off reverted");
  }

  const applicableChecks = useMemo(() => CHECKS.filter((c) => c.applicable(brief)), [brief]);
  const allPass = useMemo(() => {
    if (!qa) return false;
    return applicableChecks.every((c) => !!qa[c.key]);
  }, [qa, applicableChecks]);

  if (loading || !qa) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <p className="text-muted-foreground">Loading review…</p>
      </div>
    );
  }

  const compliance = applicableChecks.filter((c) => c.group === "compliance");
  const brandSpec = applicableChecks.filter((c) => c.group === "brand_spec");
  const skippedCompliance = CHECKS.filter((c) => c.group === "compliance" && !c.applicable(brief));
  const skippedBrand = CHECKS.filter((c) => c.group === "brand_spec" && !c.applicable(brief));

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 label-mono text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> Back to brief select
      </button>

      <div className="flex items-start gap-4 flex-wrap mb-6">
        <div className="flex-1 min-w-0">
          <p className="label-mono mb-1">{brief.brand?.name ?? "—"} · {brief.project_name ?? "—"}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">QA &amp; Compliance</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 border border-muted-foreground text-muted-foreground rounded-[2px]">
            {uploadReady} upload-ready
          </span>
          {qa.signed_off ? (
            <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 border border-emerald-700 text-emerald-700 rounded-[2px] inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Signed off
            </span>
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 border border-[var(--color-rec)] text-[var(--color-rec)] rounded-[2px]">
              Not signed off
            </span>
          )}
        </div>
      </div>

      {uploadReady === 0 && (
        <div className="border border-[var(--color-rec)] text-[var(--color-rec)] p-4 rounded-[2px] mb-6 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Nothing to QA yet</p>
            <p className="text-xs mt-1">No upload-ready deliverables on this brief. Finish Deliverables before signing off.</p>
          </div>
        </div>
      )}

      {qa.signed_off && qa.reviewed_at && (
        <div className="border border-emerald-700 bg-emerald-50 p-4 rounded-[2px] mb-6 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-700 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-sm">Signed off by {qa.reviewer} · {new Date(qa.reviewed_at).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Compliance gate cleared. Launch unlocked for this brief.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void revertSignoff()}>Revert</Button>
        </div>
      )}

      <Section title="Compliance">
        {compliance.map((c) => (
          <CheckRow
            key={c.key}
            def={c}
            brief={brief}
            checked={!!qa[c.key]}
            note={qa.notes?.[c.key] ?? ""}
            onToggle={(v) => void toggleCheck(c.key, v)}
            onNote={(v) => void setNote(c.key, v)}
          />
        ))}
        {skippedCompliance.map((c) => <SkippedRow key={c.key} def={c} />)}
      </Section>

      <Section title="Brand & Spec">
        {brandSpec.map((c) => (
          <CheckRow
            key={c.key}
            def={c}
            brief={brief}
            checked={!!qa[c.key]}
            note={qa.notes?.[c.key] ?? ""}
            onToggle={(v) => void toggleCheck(c.key, v)}
            onNote={(v) => void setNote(c.key, v)}
          />
        ))}
        {skippedBrand.map((c) => <SkippedRow key={c.key} def={c} />)}
      </Section>

      <div className="border border-foreground p-6 rounded-[2px] mt-8 sticky bottom-4 bg-background">
        <p className="label-mono mb-3">SIGN-OFF</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <label className="label-mono mb-1 block">REVIEWER NAME</label>
            <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" disabled={qa.signed_off ?? false} />
          </div>
          <Button
            onClick={() => void signOff()}
            disabled={!allPass || !reviewer.trim() || (qa.signed_off ?? false)}
            className="bg-[var(--color-rec)] hover:bg-[var(--color-rec)]/90 text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            {qa.signed_off ? "Signed off" : "Sign off review"}
          </Button>
        </div>
        {!allPass && (
          <p className="text-xs text-muted-foreground mt-3">
            {applicableChecks.filter((c) => !qa[c.key]).length} applicable check(s) still open.
          </p>
        )}
      </div>

      <ReportPanel brief={brief} qa={qa} applicable={applicableChecks} />

      <AlertDialog open={!!confirmUnlock} onOpenChange={(o) => !o && setConfirmUnlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Untick this check?</AlertDialogTitle>
            <AlertDialogDescription>
              This review is currently signed off. Unticking will revert the sign-off and re-block launch for this brief.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmUnlockCheck()}>Revert sign-off</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl font-bold mb-3">{title}</h2>
      <div className="border border-foreground rounded-[2px] divide-y">{children}</div>
    </section>
  );
}

function CheckRow({
  def, brief, checked, note, onToggle, onNote,
}: {
  def: CheckDef; brief: BriefRow; checked: boolean; note: string;
  onToggle: (v: boolean) => void; onNote: (v: string) => void;
}) {
  const preflag = def.preflag(brief);
  const isFlagged = !!preflag && !checked;
  return (
    <div className={cn("p-4 grid md:grid-cols-[auto_1fr_1fr] gap-4 items-start", isFlagged && "bg-[var(--color-rec)]/5")}>
      <div className="pt-0.5">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onToggle(!!v)}
          className={cn(isFlagged && "border-[var(--color-rec)] data-[state=checked]:bg-[var(--color-rec)]")}
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn("font-medium", isFlagged && "text-[var(--color-rec)]")}>{def.label}</p>
          {isFlagged && (
            <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-[var(--color-rec)] text-[var(--color-rec)] rounded-[2px] inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Pre-flag
            </span>
          )}
        </div>
        {preflag && (
          <p className={cn("text-xs mt-1", isFlagged ? "text-[var(--color-rec)]" : "text-muted-foreground")}>{preflag}</p>
        )}
        <Textarea value={note} onChange={(e) => onNote(e.target.value)} placeholder="Optional note…" rows={2} className="mt-2 text-sm" />
      </div>
      <div className="border-l pl-4 space-y-2 text-sm min-w-0">{def.context(brief)}</div>
    </div>
  );
}

function SkippedRow({ def }: { def: CheckDef }) {
  return (
    <div className="p-3 px-4 flex items-center gap-3 bg-muted/40">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">N/A</span>
      <p className="text-sm text-muted-foreground">{def.label} — not required by this brief.</p>
    </div>
  );
}

function ReportPanel({ brief, qa, applicable }: { brief: BriefRow; qa: QaRow; applicable: CheckDef[] }) {
  const report = useMemo(() => buildReport(brief, qa, applicable), [brief, qa, applicable]);
  function copyReport() { void navigator.clipboard.writeText(report); toast.success("Report copied"); }
  function downloadReport() {
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-${brief.brand?.name ?? "brand"}-${brief.project_name ?? "brief"}.txt`.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between flex-wrap gap-2 mb-3">
        <div>
          <p className="label-mono mb-1">AUDIT RECORD</p>
          <h2 className="font-display text-2xl font-bold">Compliance report</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyReport}><Copy className="h-3.5 w-3.5" /> Copy</Button>
          <Button variant="outline" size="sm" onClick={downloadReport}><Download className="h-3.5 w-3.5" /> Download</Button>
        </div>
      </div>
      <pre className="border border-foreground rounded-[2px] p-4 bg-muted/30 text-xs whitespace-pre-wrap font-mono overflow-auto">{report}</pre>
    </section>
  );
}

function buildReport(brief: BriefRow, qa: QaRow, applicable: CheckDef[]): string {
  const lines: string[] = [];
  lines.push("QA & COMPLIANCE REPORT");
  lines.push(`Brand: ${brief.brand?.name ?? "—"}`);
  lines.push(`Project: ${brief.project_name ?? "—"}`);
  lines.push(
    `Status: ${qa.signed_off ? `SIGNED OFF by ${qa.reviewer ?? "?"} at ${qa.reviewed_at ? new Date(qa.reviewed_at).toLocaleString() : "—"}` : "NOT SIGNED OFF"}`,
  );
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("CHECKS");
  lines.push("------");
  for (const c of CHECKS) {
    const appl = applicable.includes(c);
    if (!appl) { lines.push(`[N/A] ${c.label}`); continue; }
    const ok = !!qa[c.key];
    lines.push(`[${ok ? "X" : " "}] ${c.label}`);
    const note = qa.notes?.[c.key];
    if (note && note.trim()) lines.push(`     note: ${note.trim()}`);
  }
  return lines.join("\n");
}
