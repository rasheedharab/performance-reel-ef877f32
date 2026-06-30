import { useState, useRef, useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Upload, X, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  uploadBrandFile,
  fileNameFromPath,
  removeBrandFiles,
  getSignedUrl,
} from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

type Personality = {
  playful_serious: number;
  premium_accessible: number;
  bold_understated: number;
};

export type BrandFormValues = {
  id?: string;
  name: string;
  website: string;
  category: string;
  one_line_what_you_sell: string;
  years_in_business: string;
  brand_voice: string;
  tone_do: string;
  tone_dont: string;
  personality: Personality;
  primary_color: string;
  secondary_color: string;
  fonts: string;
  logo_url: string | null;
  brand_asset_urls: string[];
  avoid_competitors: string;
  no_go_list: string;
  notes: string;
};

export const emptyBrand: BrandFormValues = {
  name: "",
  website: "",
  category: "",
  one_line_what_you_sell: "",
  years_in_business: "",
  brand_voice: "",
  tone_do: "",
  tone_dont: "",
  personality: { playful_serious: 50, premium_accessible: 50, bold_understated: 50 },
  primary_color: "#17171B",
  secondary_color: "#E0301E",
  fonts: "",
  logo_url: null,
  brand_asset_urls: [],
  avoid_competitors: "",
  no_go_list: "",
  notes: "",
};

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0">
      <p className="label-mono mb-6">{label}</p>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium tracking-tight">
        {label}
        {required && <span className="text-[var(--color-rec)] ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-[var(--color-rec)] font-mono tracking-tight">{error}</p>
      )}
    </div>
  );
}

function PersonalitySlider({
  left,
  right,
  value,
  onChange,
}: {
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between label-mono text-[10px]">
        <span>{left}</span>
        <span className="text-foreground font-mono">{value}</span>
        <span>{right}</span>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 50)}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <label
          className="h-9 w-12 rounded-[3px] border border-border cursor-pointer relative overflow-hidden"
          style={{ background: safe }}
        >
          <input
            type="color"
            value={safe}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono uppercase max-w-[140px]"
        />
      </div>
    </Field>
  );
}

export function BrandForm({
  initial,
  mode,
}: {
  initial: BrandFormValues;
  mode: "create" | "edit";
}) {
  const navigate = useNavigate();
  const [values, setValues] = useState<BrandFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const assetsRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof BrandFormValues>(key: K, v: BrandFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Brand name is required";
    if (!values.one_line_what_you_sell.trim())
      e.one_line_what_you_sell = "Describe what you sell in one line";
    if (values.primary_color && !/^#[0-9a-fA-F]{6}$/.test(values.primary_color))
      e.primary_color = "Use a 6-digit hex like #E0301E";
    if (values.secondary_color && !/^#[0-9a-fA-F]{6}$/.test(values.secondary_color))
      e.secondary_color = "Use a 6-digit hex like #E0301E";
    if (values.website && !/^https?:\/\//i.test(values.website))
      e.website = "Include http:// or https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function ensureUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Not signed in");
    return data.user;
  }

  async function ensureBrandId(): Promise<{ userId: string; brandId: string }> {
    const user = await ensureUser();
    if (values.id) return { userId: user.id, brandId: values.id };
    // Create a draft row so we have an id for the storage folder.
    const { data, error } = await supabase
      .from("brands")
      .insert({ user_id: user.id, name: values.name.trim() || "Untitled brand" })
      .select("id")
      .single();
    if (error) throw error;
    setValues((p) => ({ ...p, id: data.id }));
    return { userId: user.id, brandId: data.id };
  }

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    try {
      setUploadingLogo(true);
      const { userId, brandId } = await ensureBrandId();
      const path = await uploadBrandFile(userId, brandId, file);
      if (values.logo_url) await removeBrandFiles([values.logo_url]).catch(() => {});
      set("logo_url", path);
    } catch (err) {
      toast.error("Logo upload failed", { description: (err as Error).message });
    } finally {
      setUploadingLogo(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  }

  async function handleAssets(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      setUploadingAssets(true);
      const { userId, brandId } = await ensureBrandId();
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const path = await uploadBrandFile(userId, brandId, file);
        uploaded.push(path);
      }
      set("brand_asset_urls", [...values.brand_asset_urls, ...uploaded]);
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploadingAssets(false);
      if (assetsRef.current) assetsRef.current.value = "";
    }
  }

  async function removeAsset(path: string) {
    await removeBrandFiles([path]).catch(() => {});
    set(
      "brand_asset_urls",
      values.brand_asset_urls.filter((p) => p !== path),
    );
  }

  async function removeLogo() {
    if (values.logo_url) await removeBrandFiles([values.logo_url]).catch(() => {});
    set("logo_url", null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast.error("Fix the highlighted fields");
      return;
    }
    setSaving(true);
    try {
      const user = await ensureUser();
      const payload = {
        user_id: user.id,
        name: values.name.trim(),
        website: values.website.trim() || null,
        category: values.category.trim() || null,
        one_line_what_you_sell: values.one_line_what_you_sell.trim() || null,
        years_in_business: values.years_in_business
          ? Number(values.years_in_business)
          : null,
        brand_voice: values.brand_voice.trim() || null,
        tone_do: values.tone_do.trim() || null,
        tone_dont: values.tone_dont.trim() || null,
        personality: values.personality,
        primary_color: values.primary_color.trim() || null,
        secondary_color: values.secondary_color.trim() || null,
        fonts: values.fonts.trim() || null,
        logo_url: values.logo_url,
        brand_asset_urls: values.brand_asset_urls,
        avoid_competitors: values.avoid_competitors.trim() || null,
        no_go_list: values.no_go_list.trim() || null,
        notes: values.notes.trim() || null,
      };

      let brandId = values.id;
      if (brandId) {
        const { error } = await supabase
          .from("brands")
          .update(payload)
          .eq("id", brandId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("brands")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        brandId = data.id;
      }
      toast.success(mode === "create" ? "Brand created" : "Brand updated");
      navigate({ to: "/brands/$brandId", params: { brandId: brandId! } });
    } catch (err) {
      toast.error("Save failed", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl mx-auto px-8 py-10">
      <div className="mb-10">
        <p className="label-mono mb-2">
          {mode === "create" ? "New brand" : "Editing"}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
          {mode === "create" ? "Set up a brand" : values.name || "Edit brand"}
        </h1>
      </div>

      <Section label="Identity">
        <Field label="Brand name" required error={errors.name}>
          <Input
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Acme Co."
            className={cn(errors.name && "border-[var(--color-rec)]")}
          />
        </Field>
        <Field label="Website" error={errors.website}>
          <Input
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://example.com"
            className={cn(errors.website && "border-[var(--color-rec)]")}
          />
        </Field>
        <Field label="Category / industry">
          <Input
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="DTC skincare, B2B SaaS, fintech…"
          />
        </Field>
        <Field
          label="One-line — what you sell"
          required
          error={errors.one_line_what_you_sell}
        >
          <Input
            value={values.one_line_what_you_sell}
            onChange={(e) => set("one_line_what_you_sell", e.target.value)}
            placeholder="A retinol serum that works overnight."
            className={cn(
              errors.one_line_what_you_sell && "border-[var(--color-rec)]",
            )}
          />
        </Field>
        <Field label="Years in business">
          <Input
            type="number"
            min={0}
            value={values.years_in_business}
            onChange={(e) => set("years_in_business", e.target.value)}
            placeholder="3"
            className="max-w-[160px]"
          />
        </Field>
      </Section>

      <Section label="Voice & Tone">
        <Field label="Brand voice — 3 adjectives" hint="Comma-separated">
          <Input
            value={values.brand_voice}
            onChange={(e) => set("brand_voice", e.target.value)}
            placeholder="Confident, witty, no-nonsense"
          />
        </Field>
        <Field label="Tone do's">
          <Textarea
            rows={3}
            value={values.tone_do}
            onChange={(e) => set("tone_do", e.target.value)}
            placeholder="Use short sentences. Show real results. Talk like a friend."
          />
        </Field>
        <Field label="Tone don'ts">
          <Textarea
            rows={3}
            value={values.tone_dont}
            onChange={(e) => set("tone_dont", e.target.value)}
            placeholder="No clickbait. No corporate jargon. No fear-based hooks."
          />
        </Field>
      </Section>

      <Section label="Personality">
        <PersonalitySlider
          left="Playful"
          right="Serious"
          value={values.personality.playful_serious}
          onChange={(v) =>
            set("personality", { ...values.personality, playful_serious: v })
          }
        />
        <PersonalitySlider
          left="Premium"
          right="Accessible"
          value={values.personality.premium_accessible}
          onChange={(v) =>
            set("personality", { ...values.personality, premium_accessible: v })
          }
        />
        <PersonalitySlider
          left="Bold"
          right="Understated"
          value={values.personality.bold_understated}
          onChange={(v) =>
            set("personality", { ...values.personality, bold_understated: v })
          }
        />
      </Section>

      <Section label="Visual identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <ColorField
            label="Primary color"
            value={values.primary_color}
            onChange={(v) => set("primary_color", v)}
          />
          <ColorField
            label="Secondary color"
            value={values.secondary_color}
            onChange={(v) => set("secondary_color", v)}
          />
        </div>
        <Field label="Brand fonts">
          <Input
            value={values.fonts}
            onChange={(e) => set("fonts", e.target.value)}
            placeholder="Söhne (display), Inter (body)"
          />
        </Field>

        <Field label="Logo">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-[3px] border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
              {values.logo_url ? (
                <LogoPreview path={values.logo_url} />
              ) : (
                <span className="label-mono text-[9px]">No logo</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogo(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => logoRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {values.logo_url ? "Replace" : "Upload logo"}
              </Button>
              {values.logo_url && (
                <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </Field>

        <Field
          label="Brand guidelines / existing creative"
          hint="PDFs, decks, reference images. Multiple files."
        >
          <div className="space-y-2">
            <input
              ref={assetsRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleAssets(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => assetsRef.current?.click()}
              disabled={uploadingAssets}
            >
              {uploadingAssets ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Add files
            </Button>
            {values.brand_asset_urls.length > 0 && (
              <ul className="divide-y divide-border border border-border rounded-[3px] bg-card">
                {values.brand_asset_urls.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{fileNameFromPath(p)}</span>
                    <button
                      type="button"
                      onClick={() => removeAsset(p)}
                      className="text-muted-foreground hover:text-[var(--color-rec)]"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
      </Section>

      <Section label="Guardrails">
        <Field label="Competitors we should NOT resemble">
          <Textarea
            rows={3}
            value={values.avoid_competitors}
            onChange={(e) => set("avoid_competitors", e.target.value)}
            placeholder="List brands by name or by style."
          />
        </Field>
        <Field label="Brand safety no-go list">
          <Textarea
            rows={3}
            value={values.no_go_list}
            onChange={(e) => set("no_go_list", e.target.value)}
            placeholder="Topics, claims, or imagery that are off-limits."
          />
        </Field>
        <Field label="Notes">
          <Textarea
            rows={3}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything else the team should know."
          />
        </Field>
      </Section>

      <div className="mt-10 pt-6 border-t border-border flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            values.id
              ? navigate({ to: "/brands/$brandId", params: { brandId: values.id } })
              : navigate({ to: "/brands" })
          }
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "create" ? "Create brand" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function LogoPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSignedUrl(path).then((u) => {
      if (!cancelled) setUrl(u ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) return <span className="label-mono text-[9px]">…</span>;
  return <img src={url} alt="Logo" className="h-full w-full object-contain" />;
}