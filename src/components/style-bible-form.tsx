import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type StyleBible = {
  id: string;
  brand_id: string;
  user_id: string;
  film_look: string | null;
  color_grade: string | null;
  lighting_signature: string | null;
  lens_feel: string | null;
  motion_feel: string | null;
  subject_tokens: string | null;
  default_negative: string | null;
  locked_seed: number | null;
  notes: string | null;
};

const FIELD_HINTS: Record<string, string> = {
  film_look: 'e.g. "filmic, soft halation, 35mm grain"',
  color_grade: 'e.g. "warm teal-orange, lifted blacks"',
  lighting_signature: 'e.g. "soft side-light, 3500K, gentle shadows"',
  lens_feel: 'e.g. "shallow depth of field, 50mm"',
  motion_feel: 'e.g. "smooth, deliberate camera moves"',
  subject_tokens:
    'Locked recurring descriptors reused verbatim across every shot — e.g. "a woman in her late 20s, freckles, auburn hair, beige linen shirt"',
  default_negative:
    'Things to suppress by default — e.g. "text artifacts, extra fingers, plastic skin, oversaturation"',
  locked_seed: "Optional fixed seed for campaign-level consistency",
  notes: "Any extra direction worth carrying across every shot",
};

function Field({
  label,
  hint,
  children,
  fromBible,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  fromBible?: boolean;
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
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1 italic">{hint}</p>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-5 mt-5 first:border-t-0 first:pt-0 first:mt-0">
      <p className="label-mono mb-4">{label}</p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function StyleBibleSection({ brandId }: { brandId: string }) {
  const [bible, setBible] = useState<StyleBible | null | "missing">(null);
  const [draft, setDraft] = useState<Partial<StyleBible>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("style_bibles")
        .select("*")
        .eq("brand_id", brandId)
        .maybeSingle();
      if (data) {
        setBible(data as StyleBible);
        setDraft(data as StyleBible);
      } else {
        setBible("missing");
      }
    })();
  }, [brandId]);

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
      brand_id: brandId,
      user_id: userId,
      film_look: draft.film_look?.toString().trim() || null,
      color_grade: draft.color_grade?.toString().trim() || null,
      lighting_signature: draft.lighting_signature?.toString().trim() || null,
      lens_feel: draft.lens_feel?.toString().trim() || null,
      motion_feel: draft.motion_feel?.toString().trim() || null,
      subject_tokens: draft.subject_tokens?.toString().trim() || null,
      default_negative: draft.default_negative?.toString().trim() || null,
      locked_seed:
        draft.locked_seed === null || draft.locked_seed === undefined || draft.locked_seed === ("" as unknown as number)
          ? null
          : Number(draft.locked_seed),
      notes: draft.notes?.toString().trim() || null,
    };
    const { data, error } =
      bible && bible !== "missing"
        ? await supabase
            .from("style_bibles")
            .update(payload)
            .eq("id", bible.id)
            .select("*")
            .maybeSingle()
        : await supabase
            .from("style_bibles")
            .insert(payload)
            .select("*")
            .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBible(data as StyleBible);
    setDraft(data as StyleBible);
    setEditing(false);
    toast.success("Style Bible saved");
  };

  if (bible === null) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Style Bible…
      </div>
    );
  }

  if (bible === "missing" && !editing) {
    return (
      <div className="border border-dashed border-border rounded-[3px] bg-background p-6 text-center">
        <p className="label-mono mb-2">Style Bible</p>
        <h3 className="font-display text-xl mb-2">No Style Bible yet</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Lock the look, lighting, lens, and motion language once per brand. Every shot in
          the Storyboard prefills from it — fewer drifty prompts, faster generation.
        </p>
        <Button onClick={() => setEditing(true)}>
          <Sparkles className="h-4 w-4" /> Create Style Bible
        </Button>
      </div>
    );
  }

  if (!editing && bible && bible !== "missing") {
    const rows: Array<[string, string | null]> = [
      ["Film look", bible.film_look],
      ["Color grade", bible.color_grade],
      ["Lighting signature", bible.lighting_signature],
      ["Lens feel", bible.lens_feel],
      ["Motion feel", bible.motion_feel],
      ["Subject tokens", bible.subject_tokens],
      ["Default negative", bible.default_negative],
      ["Locked seed", bible.locked_seed?.toString() ?? null],
      ["Notes", bible.notes],
    ];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Locked cinematographic language. Every shot prefills from here.
          </p>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit Style Bible
          </Button>
        </div>
        <dl className="divide-y divide-border border border-border rounded-[3px] bg-background">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[180px_1fr] gap-4 px-4 py-3 text-sm">
              <dt className="label-mono text-[10px] pt-0.5">{label}</dt>
              <dd className="whitespace-pre-wrap break-words">
                {value || <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  // EDITING
  const v = (k: keyof StyleBible) => (draft[k] as string | number | null | undefined) ?? "";
  const set = (k: keyof StyleBible, val: string | number | null) =>
    setDraft((d) => ({ ...d, [k]: val }));

  return (
    <div className="space-y-1">
      <Group label="Look & Grade">
        <Field label="Film look" hint={FIELD_HINTS.film_look}>
          <Input value={v("film_look") as string} onChange={(e) => set("film_look", e.target.value)} />
        </Field>
        <Field label="Color grade" hint={FIELD_HINTS.color_grade}>
          <Input value={v("color_grade") as string} onChange={(e) => set("color_grade", e.target.value)} />
        </Field>
      </Group>

      <Group label="Lighting & Lens">
        <Field label="Lighting signature" hint={FIELD_HINTS.lighting_signature}>
          <Input
            value={v("lighting_signature") as string}
            onChange={(e) => set("lighting_signature", e.target.value)}
          />
        </Field>
        <Field label="Lens feel" hint={FIELD_HINTS.lens_feel}>
          <Input value={v("lens_feel") as string} onChange={(e) => set("lens_feel", e.target.value)} />
        </Field>
      </Group>

      <Group label="Motion">
        <Field label="Motion feel" hint={FIELD_HINTS.motion_feel}>
          <Input value={v("motion_feel") as string} onChange={(e) => set("motion_feel", e.target.value)} />
        </Field>
      </Group>

      <Group label="Consistency">
        <Field label="Subject tokens" hint={FIELD_HINTS.subject_tokens}>
          <Textarea
            rows={2}
            value={v("subject_tokens") as string}
            onChange={(e) => set("subject_tokens", e.target.value)}
          />
        </Field>
        <Field label="Locked seed" hint={FIELD_HINTS.locked_seed}>
          <Input
            type="number"
            value={
              draft.locked_seed === null || draft.locked_seed === undefined
                ? ""
                : String(draft.locked_seed)
            }
            onChange={(e) =>
              set("locked_seed", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
      </Group>

      <Group label="Negatives">
        <Field label="Default negative" hint={FIELD_HINTS.default_negative}>
          <Textarea
            rows={2}
            value={v("default_negative") as string}
            onChange={(e) => set("default_negative", e.target.value)}
          />
        </Field>
        <Field label="Notes" hint={FIELD_HINTS.notes}>
          <Textarea rows={2} value={v("notes") as string} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </Group>

      <div className="flex justify-end gap-2 pt-4 border-t border-border mt-5">
        {bible !== "missing" && (
          <Button
            variant="outline"
            onClick={() => {
              setDraft(bible as StyleBible);
              setEditing(false);
            }}
            disabled={saving}
          >
            Cancel
          </Button>
        )}
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Style Bible
        </Button>
      </div>
    </div>
  );
}