import { useState, useRef, useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Upload, X, Loader2, FileText, Lock, Unlock, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  uploadCampaignFile,
  campaignFileName,
  removeCampaignFiles,
} from "@/lib/campaign-assets";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BriefStatus = Database["public"]["Enums"]["brief_status"];

export type BriefFormValues = {
  id?: string;
  status: BriefStatus;
  brand_id: string;
  project_name: string;
  deadline: string;
  signoff_owner: string;
  product_name: string;
  price: string;
  product_description: string;
  benefits: [string, string, string];
  wedge: string;
  offer_type: string;
  offer_detail: string;
  product_asset_urls: string[];
  objective: string;
  awareness_stage: string;
  kpi_type: string;
  kpi_target: string;
  benchmark: string;
  destination_url: string;
  budget_tier: string;
  audience_age: string;
  audience_gender: string;
  audience_location: string;
  audience_income: string;
  psychographic: string;
  core_driver: string;
  objection: string;
  headspace: string;
  customer_language: string;
  testimonials: string;
  stats_claims: string;
  claims_substantiated: boolean;
  awards: string;
  must_include: string;
  ugc_asset_urls: string[];
  regulated: boolean;
  disclosures: string;
  regulatory_notes: string;
  cannot_claim: string;
  legal_copy: string;
  likeness_notes: string;
  ai_disclosure: boolean;
  captions_required: boolean;
  archetypes: string[];
  placements: string[];
  variants_needed: string;
  languages: string;
  reference_links: string;
  notes: string;
};

export const emptyBrief: BriefFormValues = {
  status: "draft",
  brand_id: "",
  project_name: "",
  deadline: "",
  signoff_owner: "",
  product_name: "",
  price: "",
  product_description: "",
  benefits: ["", "", ""],
  wedge: "",
  offer_type: "None",
  offer_detail: "",
  product_asset_urls: [],
  objective: "",
  awareness_stage: "",
  kpi_type: "",
  kpi_target: "",
  benchmark: "",
  destination_url: "",
  budget_tier: "",
  audience_age: "",
  audience_gender: "",
  audience_location: "",
  audience_income: "",
  psychographic: "",
  core_driver: "",
  objection: "",
  headspace: "",
  customer_language: "",
  testimonials: "",
  stats_claims: "",
  claims_substantiated: false,
  awards: "",
  must_include: "",
  ugc_asset_urls: [],
  regulated: false,
  disclosures: "",
  regulatory_notes: "",
  cannot_claim: "",
  legal_copy: "",
  likeness_notes: "",
  ai_disclosure: false,
  captions_required: false,
  archetypes: [],
  placements: [],
  variants_needed: "",
  languages: "",
  reference_links: "",
  notes: "",
};

const OFFER_TYPES = ["None", "Discount", "Free trial", "Bundle", "Urgency/scarcity", "Other"];
const OBJECTIVES = ["awareness", "traffic", "engagement", "leads", "sales"];
const AWARENESS = ["Cold", "Problem-aware", "Solution-aware", "Product-aware"];
const KPI_TYPES = ["CPA", "ROAS", "CPL", "CPM", "Other"];
const BUDGETS = ["Lean", "Standard", "Premium"];
const GENDERS = ["Any", "Female skew", "Male skew", "Non-binary skew"];
const INCOMES = ["Budget", "Mid-market", "Premium", "Luxury"];
const ARCHETYPES = [
  "UGC testimonial",
  "Cinematic hero",
  "Problem→solution",
  "Founder VO",
  "Listicle",
  "Demo",
];
const PLACEMENTS = ["Reels 9:16", "Feed 4:5", "Stories 9:16"];

function offerDetailLabel(t: string): { label: string; placeholder: string } {
  switch (t) {
    case "Discount":
      return { label: "Discount details", placeholder: "e.g. 20% off, code SUMMER" };
    case "Free trial":
      return { label: "Free trial details", placeholder: "e.g. 14-day free trial, no card" };
    case "Bundle":
      return { label: "Bundle details", placeholder: "e.g. Buy 2 get 1 free" };
    case "Urgency/scarcity":
      return { label: "Urgency / scarcity details", placeholder: "e.g. Ends Sunday, 50 left" };
    default:
      return { label: "Offer details", placeholder: "Describe the offer" };
  }
}

function Scene({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border pt-10 mt-10 first:border-t-0 first:pt-0 first:mt-0">
      <div className="flex items-baseline gap-4 mb-6 pb-4 border-b border-dashed border-border">
        <span className="label-mono text-[var(--color-rec)]">SCENE {num}</span>
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  children,
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

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span className="text-sm leading-tight">{label}</span>
    </label>
  );
}

function CheckGroup({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <label
            key={opt}
            className={cn(
              "flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-[3px] text-sm transition-colors",
              on
                ? "border-foreground bg-foreground/5"
                : "border-border hover:border-foreground/30",
            )}
          >
            <Checkbox
              checked={on}
              onCheckedChange={(v) => {
                if (v === true) onChange([...selected, opt]);
                else onChange(selected.filter((s) => s !== opt));
              }}
            />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function BrandCard({ brand }: { brand: BrandRow }) {
  const voice = (brand.brand_voice ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className="bg-background border border-border rounded-[3px] p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="label-mono mb-1">Brand context</p>
          <p className="font-display font-bold text-base leading-tight">{brand.name}</p>
          {brand.category && (
            <p className="text-xs text-muted-foreground mt-0.5">{brand.category}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {brand.primary_color && (
            <span
              className="h-6 w-6 rounded-[2px] border border-border"
              style={{ background: brand.primary_color }}
            />
          )}
          {brand.secondary_color && (
            <span
              className="h-6 w-6 rounded-[2px] border border-border"
              style={{ background: brand.secondary_color }}
            />
          )}
        </div>
      </div>
      {voice.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {voice.map((v) => (
            <span
              key={v}
              className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px] text-muted-foreground"
            >
              {v}
            </span>
          ))}
        </div>
      )}
      {brand.no_go_list && (
        <div>
          <p className="label-mono text-[10px] mb-1">No-go list</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {brand.no_go_list}
          </p>
        </div>
      )}
    </div>
  );
}

export function BriefForm({
  initial,
  mode,
}: {
  initial: BriefFormValues;
  mode: "create" | "edit";
}) {
  const navigate = useNavigate();
  const [values, setValues] = useState<BriefFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<BrandRow | null>(null);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [uploadingUgc, setUploadingUgc] = useState(false);
  const productRef = useRef<HTMLInputElement>(null);
  const ugcRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("brands")
        .select("*")
        .order("name", { ascending: true });
      if (data) setBrands(data);
    })();
  }, []);

  useEffect(() => {
    if (!values.brand_id) {
      setSelectedBrand(null);
      return;
    }
    const local = brands.find((b) => b.id === values.brand_id);
    if (local) {
      setSelectedBrand(local);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("brands")
        .select("*")
        .eq("id", values.brand_id)
        .maybeSingle();
      if (data) setSelectedBrand(data);
    })();
  }, [values.brand_id, brands]);

  function set<K extends keyof BriefFormValues>(key: K, v: BriefFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function validateForLock(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!values.brand_id) e.brand_id = "Select a brand";
    if (!values.project_name.trim()) e.project_name = "Project name is required";
    if (!values.product_name.trim()) e.product_name = "Product / SKU / offer name is required";
    if (!values.product_description.trim())
      e.product_description = "Describe what it does in plain language";
    if (!values.benefits[0].trim()) e.benefit_1 = "At least one benefit is required";
    if (!values.objective) e.objective = "Pick an objective";
    if (!values.psychographic.trim()) e.psychographic = "Psychographic description required";
    if (!values.core_driver.trim()) e.core_driver = "Pain / desire is required";
    if (values.regulated && !values.disclosures.trim())
      e.disclosures = "Required disclosures are needed when category is regulated";
    return e;
  }

  function validateForDraft(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!values.brand_id) e.brand_id = "Select a brand";
    if (!values.project_name.trim()) e.project_name = "Project name is required";
    return e;
  }

  async function ensureUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Not signed in");
    return data.user;
  }

  function buildPayload(userId: string) {
    return {
      user_id: userId,
      brand_id: values.brand_id,
      project_name: values.project_name.trim(),
      deadline: values.deadline || null,
      signoff_owner: values.signoff_owner.trim() || null,
      product_name: values.product_name.trim() || null,
      price: values.price ? Number(values.price) : null,
      product_description: values.product_description.trim() || null,
      benefits: values.benefits.filter((b) => b.trim()),
      wedge: values.wedge.trim() || null,
      offer_type: values.offer_type === "None" ? null : values.offer_type,
      offer_detail:
        values.offer_type !== "None" ? values.offer_detail.trim() || null : null,
      product_asset_urls: values.product_asset_urls,
      objective: (values.objective || null) as
        | Database["public"]["Enums"]["brief_objective"]
        | null,
      awareness_stage: values.awareness_stage || null,
      kpi_type: values.kpi_type || null,
      kpi_target: values.kpi_target.trim() || null,
      benchmark: values.benchmark.trim() || null,
      destination_url: values.destination_url.trim() || null,
      budget_tier: values.budget_tier || null,
      audience_age: values.audience_age.trim() || null,
      audience_gender: values.audience_gender || null,
      audience_location: values.audience_location.trim() || null,
      audience_income: values.audience_income || null,
      psychographic: values.psychographic.trim() || null,
      core_driver: values.core_driver.trim() || null,
      objection: values.objection.trim() || null,
      headspace: values.headspace.trim() || null,
      customer_language: values.customer_language.trim() || null,
      testimonials: values.testimonials.trim() || null,
      stats_claims: values.stats_claims.trim() || null,
      claims_substantiated: values.claims_substantiated,
      awards: values.awards.trim() || null,
      must_include: values.must_include.trim() || null,
      ugc_asset_urls: values.ugc_asset_urls,
      regulated: values.regulated,
      disclosures: values.regulated ? values.disclosures.trim() || null : null,
      regulatory_notes: values.regulated
        ? values.regulatory_notes.trim() || null
        : null,
      cannot_claim: values.cannot_claim.trim() || null,
      legal_copy: values.legal_copy.trim() || null,
      likeness_notes: values.likeness_notes.trim() || null,
      ai_disclosure: values.ai_disclosure,
      captions_required: values.captions_required,
      archetypes: values.archetypes,
      placements: values.placements,
      variants_needed: values.variants_needed ? Number(values.variants_needed) : null,
      languages: values.languages.trim() || null,
      reference_links: values.reference_links.trim() || null,
      notes: values.notes.trim() || null,
      status: values.status,
    };
  }

  async function ensureBriefId(): Promise<{ userId: string; briefId: string }> {
    const user = await ensureUser();
    if (values.id) return { userId: user.id, briefId: values.id };
    if (!values.brand_id) throw new Error("Select a brand before uploading files");
    const { data, error } = await supabase
      .from("briefs")
      .insert({
        user_id: user.id,
        brand_id: values.brand_id,
        project_name: values.project_name.trim() || "Untitled brief",
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    setValues((p) => ({ ...p, id: data.id }));
    return { userId: user.id, briefId: data.id };
  }

  async function uploadFiles(
    files: FileList | null,
    key: "product_asset_urls" | "ugc_asset_urls",
    setBusy: (b: boolean) => void,
    ref: React.RefObject<HTMLInputElement | null>,
  ) {
    if (!files || files.length === 0) return;
    try {
      setBusy(true);
      const { userId, briefId } = await ensureBriefId();
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const path = await uploadCampaignFile(userId, briefId, file);
        uploaded.push(path);
      }
      set(key, [...values[key], ...uploaded]);
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function removeAsset(key: "product_asset_urls" | "ugc_asset_urls", path: string) {
    await removeCampaignFiles([path]).catch(() => {});
    set(
      key,
      values[key].filter((p) => p !== path),
    );
  }

  async function persist(targetStatus: BriefStatus): Promise<string | null> {
    const user = await ensureUser();
    const payload = { ...buildPayload(user.id), status: targetStatus };
    if (values.id) {
      const { error } = await supabase.from("briefs").update(payload).eq("id", values.id);
      if (error) throw error;
      return values.id;
    }
    const { data, error } = await supabase
      .from("briefs")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    setValues((p) => ({ ...p, id: data.id }));
    return data.id;
  }

  async function saveDraft() {
    const e = validateForDraft();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error("Brand and project name are required, even for drafts");
      return;
    }
    setSaving(true);
    try {
      const id = await persist("draft");
      toast.success("Draft saved");
      if (mode === "create" && id) {
        navigate({ to: "/briefs/$briefId", params: { briefId: id } });
      }
    } catch (err) {
      toast.error("Save failed", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function lockBrief() {
    const e = validateForLock();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error("Fix required fields to lock", {
        description: Object.values(e).slice(0, 3).join(" · "),
      });
      return;
    }
    setLocking(true);
    try {
      const id = await persist("locked");
      toast.success("Brief locked");
      if (id) navigate({ to: "/briefs/$briefId", params: { briefId: id } });
    } catch (err) {
      toast.error("Lock failed", { description: (err as Error).message });
    } finally {
      setLocking(false);
    }
  }

  const offerDetail = offerDetailLabel(values.offer_type);

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto pb-32">
      <div className="mb-10">
        <p className="label-mono mb-2">Project intake</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {mode === "create" ? "New brief" : "Edit brief"}
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          The source of truth every later module reads from. Save a draft anytime;
          lock when all required fields are in.
        </p>
      </div>

      <div className="bg-card border border-border rounded-[3px] p-8 md:p-10">
        <Scene num="01" title="Project">
          <Field label="Brand" required error={errors.brand_id}>
            <Select
              value={values.brand_id || undefined}
              onValueChange={(v) => set("brand_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {b.category ? ` — ${b.category}` : ""}
                  </SelectItem>
                ))}
                {brands.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No brands yet. Create one first.
                  </div>
                )}
              </SelectContent>
            </Select>
          </Field>
          {selectedBrand && <BrandCard brand={selectedBrand} />}

          <Field label="Project name" required error={errors.project_name}>
            <Input
              value={values.project_name}
              onChange={(e) => set("project_name", e.target.value)}
              placeholder="e.g. Q3 launch — testimonial sprint"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Deadline">
              <Input
                type="date"
                value={values.deadline}
                onChange={(e) => set("deadline", e.target.value)}
              />
            </Field>
            <Field label="Creative sign-off owner">
              <Input
                value={values.signoff_owner}
                onChange={(e) => set("signoff_owner", e.target.value)}
                placeholder="Name"
              />
            </Field>
          </div>
        </Scene>

        <Scene num="02" title="Product / service">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Product / SKU / offer name" required error={errors.product_name}>
              <Input
                value={values.product_name}
                onChange={(e) => set("product_name", e.target.value)}
              />
            </Field>
            <Field label="Price point">
              <Input
                type="number"
                step="0.01"
                value={values.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="e.g. 49.00"
              />
            </Field>
          </div>
          <Field
            label="What it does, plain language"
            required
            error={errors.product_description}
          >
            <Textarea
              rows={3}
              value={values.product_description}
              onChange={(e) => set("product_description", e.target.value)}
            />
          </Field>

          <div className="space-y-3">
            <Field label="Benefit 1" required error={errors.benefit_1}>
              <Input
                value={values.benefits[0]}
                onChange={(e) =>
                  set("benefits", [e.target.value, values.benefits[1], values.benefits[2]])
                }
              />
            </Field>
            <Field label="Benefit 2">
              <Input
                value={values.benefits[1]}
                onChange={(e) =>
                  set("benefits", [values.benefits[0], e.target.value, values.benefits[2]])
                }
              />
            </Field>
            <Field label="Benefit 3">
              <Input
                value={values.benefits[2]}
                onChange={(e) =>
                  set("benefits", [values.benefits[0], values.benefits[1], e.target.value])
                }
              />
            </Field>
          </div>

          <Field label="The wedge — what makes it different">
            <Textarea
              rows={2}
              value={values.wedge}
              onChange={(e) => set("wedge", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Offer type">
              <Select
                value={values.offer_type}
                onValueChange={(v) => set("offer_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {values.offer_type !== "None" && (
              <Field label={offerDetail.label}>
                <Input
                  value={values.offer_detail}
                  onChange={(e) => set("offer_detail", e.target.value)}
                  placeholder={offerDetail.placeholder}
                />
              </Field>
            )}
          </div>

          <FileUploader
            label="Product images / footage"
            paths={values.product_asset_urls}
            uploading={uploadingProduct}
            inputRef={productRef}
            onPick={(files) =>
              uploadFiles(files, "product_asset_urls", setUploadingProduct, productRef)
            }
            onRemove={(p) => removeAsset("product_asset_urls", p)}
          />
        </Scene>

        <Scene num="03" title="Goal & funnel">
          <Field
            label="Objective"
            required
            error={errors.objective}
            hint="Maps to your Meta campaign objective."
          >
            <Select
              value={values.objective || undefined}
              onValueChange={(v) => set("objective", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick one" />
              </SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o[0].toUpperCase() + o.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Awareness stage">
              <Select
                value={values.awareness_stage || undefined}
                onValueChange={(v) => set("awareness_stage", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {AWARENESS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Budget tier">
              <Select
                value={values.budget_tier || undefined}
                onValueChange={(v) => set("budget_tier", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGETS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="KPI type">
              <Select
                value={values.kpi_type || undefined}
                onValueChange={(v) => set("kpi_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick" />
                </SelectTrigger>
                <SelectContent>
                  {KPI_TYPES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="KPI target">
              <Input
                value={values.kpi_target}
                onChange={(e) => set("kpi_target", e.target.value)}
                placeholder="e.g. $25 CPA"
              />
            </Field>
            <Field label="Current benchmark">
              <Input
                value={values.benchmark}
                onChange={(e) => set("benchmark", e.target.value)}
                placeholder="e.g. $34 CPA"
              />
            </Field>
          </div>
          <Field label="Destination URL">
            <Input
              value={values.destination_url}
              onChange={(e) => set("destination_url", e.target.value)}
              placeholder="https://"
            />
          </Field>
        </Scene>

        <Scene num="04" title="Audience">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Age range">
              <Input
                value={values.audience_age}
                onChange={(e) => set("audience_age", e.target.value)}
                placeholder="e.g. 25–44"
              />
            </Field>
            <Field label="Gender skew">
              <Select
                value={values.audience_gender || undefined}
                onValueChange={(v) => set("audience_gender", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Location(s)">
              <Input
                value={values.audience_location}
                onChange={(e) => set("audience_location", e.target.value)}
                placeholder="e.g. US + Canada, urban"
              />
            </Field>
            <Field label="Income tier">
              <Select
                value={values.audience_income || undefined}
                onValueChange={(v) => set("audience_income", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick" />
                </SelectTrigger>
                <SelectContent>
                  {INCOMES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field
            label="Psychographic description"
            required
            error={errors.psychographic}
          >
            <Textarea
              rows={3}
              value={values.psychographic}
              onChange={(e) => set("psychographic", e.target.value)}
              placeholder="Values, lifestyle, what they care about"
            />
          </Field>
          <Field label="The #1 pain or desire" required error={errors.core_driver}>
            <Textarea
              rows={2}
              value={values.core_driver}
              onChange={(e) => set("core_driver", e.target.value)}
            />
          </Field>
          <Field label="The #1 objection">
            <Textarea
              rows={2}
              value={values.objection}
              onChange={(e) => set("objection", e.target.value)}
            />
          </Field>
          <Field label="Where their head is at">
            <Textarea
              rows={2}
              value={values.headspace}
              onChange={(e) => set("headspace", e.target.value)}
              placeholder="The moment they'd see this ad"
            />
          </Field>
          <Field label="Customer language / exact phrases">
            <Textarea
              rows={3}
              value={values.customer_language}
              onChange={(e) => set("customer_language", e.target.value)}
              placeholder="Verbatim quotes from reviews, DMs, calls"
            />
          </Field>
        </Scene>

        <Scene num="05" title="Proof & assets">
          <Field label="Reviews / testimonials">
            <Textarea
              rows={3}
              value={values.testimonials}
              onChange={(e) => set("testimonials", e.target.value)}
            />
          </Field>
          <Field label="Key stats / claims">
            <Textarea
              rows={3}
              value={values.stats_claims}
              onChange={(e) => set("stats_claims", e.target.value)}
            />
          </Field>
          <CheckRow
            checked={values.claims_substantiated}
            onChange={(v) => set("claims_substantiated", v)}
            label="I confirm every claim above can be substantiated."
          />
          <Field label="Awards / press">
            <Textarea
              rows={2}
              value={values.awards}
              onChange={(e) => set("awards", e.target.value)}
            />
          </Field>
          <Field label="Must-include assets">
            <Textarea
              rows={2}
              value={values.must_include}
              onChange={(e) => set("must_include", e.target.value)}
              placeholder="e.g. founder shot in opening, packaging at 0:08"
            />
          </Field>
          <FileUploader
            label="Existing UGC / footage"
            paths={values.ugc_asset_urls}
            uploading={uploadingUgc}
            inputRef={ugcRef}
            onPick={(files) =>
              uploadFiles(files, "ugc_asset_urls", setUploadingUgc, ugcRef)
            }
            onRemove={(p) => removeAsset("ugc_asset_urls", p)}
          />
        </Scene>

        <Scene num="06" title="Constraints & compliance">
          <Field label="Is this a regulated category?">
            <div className="flex gap-2">
              {[
                { v: false, l: "No" },
                { v: true, l: "Yes" },
              ].map((opt) => (
                <button
                  key={opt.l}
                  type="button"
                  onClick={() => set("regulated", opt.v)}
                  className={cn(
                    "px-4 py-2 border rounded-[3px] text-sm transition-colors",
                    values.regulated === opt.v
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </Field>
          {values.regulated && (
            <>
              <Field
                label="Required disclosures"
                required
                error={errors.disclosures}
              >
                <Textarea
                  rows={3}
                  value={values.disclosures}
                  onChange={(e) => set("disclosures", e.target.value)}
                />
              </Field>
              <Field label="Other regulatory notes">
                <Textarea
                  rows={2}
                  value={values.regulatory_notes}
                  onChange={(e) => set("regulatory_notes", e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Claims we legally CANNOT make">
            <Textarea
              rows={2}
              value={values.cannot_claim}
              onChange={(e) => set("cannot_claim", e.target.value)}
            />
          </Field>
          <Field label="Mandatory legal copy / disclaimers">
            <Textarea
              rows={2}
              value={values.legal_copy}
              onChange={(e) => set("legal_copy", e.target.value)}
            />
          </Field>
          <Field label="Likeness / rights restrictions">
            <Textarea
              rows={2}
              value={values.likeness_notes}
              onChange={(e) => set("likeness_notes", e.target.value)}
            />
          </Field>
          <div className="space-y-1 pt-2">
            <CheckRow
              checked={values.ai_disclosure}
              onChange={(v) => set("ai_disclosure", v)}
              label="AI-generated content must be disclosed."
            />
            <CheckRow
              checked={values.captions_required}
              onChange={(v) => set("captions_required", v)}
              label="Burned-in captions on every cut."
            />
          </div>
        </Scene>

        <Scene num="07" title="Format & logistics">
          <Field label="Format archetypes">
            <CheckGroup
              options={ARCHETYPES}
              selected={values.archetypes}
              onChange={(v) => set("archetypes", v)}
            />
          </Field>
          <Field label="Placements">
            <CheckGroup
              options={PLACEMENTS}
              selected={values.placements}
              onChange={(v) => set("placements", v)}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Variants needed">
              <Input
                type="number"
                min="0"
                value={values.variants_needed}
                onChange={(e) => set("variants_needed", e.target.value)}
              />
            </Field>
            <Field label="Languages">
              <Input
                value={values.languages}
                onChange={(e) => set("languages", e.target.value)}
                placeholder="e.g. EN, ES"
              />
            </Field>
          </div>
          <Field label="Reference ads you love">
            <Textarea
              rows={3}
              value={values.reference_links}
              onChange={(e) => set("reference_links", e.target.value)}
              placeholder="Links or descriptions, one per line"
            />
          </Field>
          <Field label="Anything else">
            <Textarea
              rows={2}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </Scene>
      </div>

      <div className="sticky bottom-0 mt-8 -mx-8 px-8 py-4 bg-background/95 backdrop-blur border-t border-border flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/briefs" })}
          disabled={saving || locking}
        >
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={saveDraft} disabled={saving || locking}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save draft
          </Button>
          <Button onClick={lockBrief} disabled={saving || locking}>
            {locking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Lock brief
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileUploader({
  label,
  paths,
  uploading,
  inputRef,
  onPick,
  onRemove,
}: {
  label: string;
  paths: string[];
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (files: FileList | null) => void;
  onRemove: (path: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full justify-center"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload files
        </Button>
        {paths.length > 0 && (
          <ul className="border border-border rounded-[3px] divide-y divide-border bg-background">
            {paths.map((p) => (
              <li
                key={p}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate font-mono text-xs">
                    {campaignFileName(p)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(p)}
                  className="text-muted-foreground hover:text-[var(--color-rec)] transition-colors"
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
  );
}