import { useEffect, useState } from "react";
import {
  createFileRoute,
  Link,
  useParams,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  Pencil,
  Lock,
  Unlock,
  Loader2,
  ArrowRight,
  Building2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSignedUrl } from "@/lib/brand-assets";
import { getCampaignSignedUrls, campaignFileName } from "@/lib/campaign-assets";
import type { Database } from "@/integrations/supabase/types";

type BriefRow = Database["public"]["Tables"]["briefs"]["Row"];
type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BriefStatus = Database["public"]["Enums"]["brief_status"];

export const Route = createFileRoute("/_authenticated/briefs/$briefId/")({
  component: BriefDetailPage,
});

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function StatusChip({ status }: { status: BriefStatus }) {
  const styles: Record<BriefStatus, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    locked: "bg-foreground text-background border-foreground",
    in_production: "bg-[var(--color-rec)] text-white border-[var(--color-rec)]",
    live: "bg-emerald-600 text-white border-emerald-600",
    archived: "bg-transparent text-muted-foreground/60 border-border/60",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-[2px]",
        styles[status],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function Scene({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-8 mt-8">
      <div className="flex items-baseline gap-4 mb-5 pb-3 border-b border-dashed border-border">
        <span className="label-mono text-[var(--color-rec)]">SCENE {num}</span>
        <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-6 gap-y-4">
        {children}
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return null;
  }
  return (
    <>
      <dt className="label-mono pt-0.5">{label}</dt>
      <dd className="text-sm whitespace-pre-wrap leading-relaxed">{value}</dd>
    </>
  );
}

function Bool({ on, label }: { on: boolean; label: string }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px] mr-2">
      ✓ {label}
    </span>
  );
}

function BriefDetailPage() {
  const { briefId } = useParams({ from: "/_authenticated/briefs/$briefId/" });
  const navigate = useNavigate();
  const [brief, setBrief] = useState<BriefRow | null>(null);
  const [brand, setBrand] = useState<BrandRow | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [productUrls, setProductUrls] = useState<Record<string, string>>({});
  const [ugcUrls, setUgcUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("briefs")
      .select("*")
      .eq("id", briefId)
      .maybeSingle();
    if (error || !data) return;
    setBrief(data);
    const { data: b } = await supabase
      .from("brands")
      .select("*")
      .eq("id", data.brand_id)
      .maybeSingle();
    setBrand(b);
    if (b?.logo_url) setLogoUrl(await getSignedUrl(b.logo_url));
    setProductUrls(await getCampaignSignedUrls(asStringArray(data.product_asset_urls)));
    setUgcUrls(await getCampaignSignedUrls(asStringArray(data.ugc_asset_urls)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefId]);

  async function toggleLock() {
    if (!brief) return;
    setBusy(true);
    const next: BriefStatus = brief.status === "locked" ? "draft" : "locked";
    const { error } = await supabase
      .from("briefs")
      .update({ status: next })
      .eq("id", brief.id);
    setBusy(false);
    if (error) {
      toast.error("Update failed", { description: error.message });
      return;
    }
    toast.success(next === "locked" ? "Brief locked" : "Brief unlocked");
    load();
  }

  if (!brief) {
    return (
      <div className="px-8 py-20 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const benefits = asStringArray(brief.benefits);
  const archetypes = asStringArray(brief.archetypes);
  const placements = asStringArray(brief.placements);
  const productPaths = asStringArray(brief.product_asset_urls);
  const ugcPaths = asStringArray(brief.ugc_asset_urls);
  const locked = brief.status === "locked";

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto pb-20">
      <button
        onClick={() => navigate({ to: "/briefs" })}
        className="inline-flex items-center gap-2 label-mono mb-6 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All briefs
      </button>

      {/* Brand slate */}
      <div
        className="rounded-[3px] border border-border p-6 mb-6 flex items-start gap-5"
        style={{
          background: brand?.primary_color
            ? `linear-gradient(135deg, ${brand.primary_color}10, transparent 60%)`
            : undefined,
        }}
      >
        <div className="h-16 w-16 rounded-[3px] border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="label-mono mb-1">Creative brief</p>
          <h1 className="font-display text-3xl font-bold tracking-tight leading-tight">
            {brief.project_name}
          </h1>
          {brand && (
            <p className="text-sm text-muted-foreground mt-1">
              <Link
                to="/brands/$brandId"
                params={{ brandId: brand.id }}
                className="hover:text-foreground underline-offset-2 hover:underline"
              >
                {brand.name}
              </Link>
              {brand.category && <span> — {brand.category}</span>}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <StatusChip status={brief.status} />
            {brand?.primary_color && (
              <span
                className="h-5 w-5 rounded-[2px] border border-border"
                style={{ background: brand.primary_color }}
              />
            )}
            {brand?.secondary_color && (
              <span
                className="h-5 w-5 rounded-[2px] border border-border"
                style={{ background: brand.secondary_color }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Button
          variant="outline"
          size="sm"
          disabled={locked}
          onClick={() =>
            navigate({
              to: "/briefs/$briefId/edit",
              params: { briefId: brief.id },
            })
          }
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={toggleLock} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : locked ? (
            <Unlock className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {locked ? "Unlock to edit" : "Lock brief"}
        </Button>
        <Button size="sm" asChild>
          <Link to="/angles">
            Develop angles
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Document */}
      <div className="bg-card border border-border rounded-[3px] p-8 md:p-10 mt-6">
        <Scene num="01" title="Project">
          <Row label="Brand" value={brand?.name} />
          <Row label="Project" value={brief.project_name} />
          <Row label="Deadline" value={brief.deadline} />
          <Row label="Sign-off owner" value={brief.signoff_owner} />
        </Scene>

        <Scene num="02" title="Product / service">
          <Row label="Name" value={brief.product_name} />
          <Row
            label="Price"
            value={brief.price !== null ? `$${brief.price}` : null}
          />
          <Row label="What it does" value={brief.product_description} />
          {benefits.length > 0 && (
            <Row
              label="Benefits"
              value={
                <ul className="space-y-1 list-disc pl-4">
                  {benefits.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              }
            />
          )}
          <Row label="Wedge" value={brief.wedge} />
          <Row label="Offer type" value={brief.offer_type} />
          <Row label="Offer details" value={brief.offer_detail} />
          {productPaths.length > 0 && (
            <Row
              label="Product assets"
              value={
                <ul className="space-y-1">
                  {productPaths.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {productUrls[p] ? (
                        <a
                          href={productUrls[p]}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs hover:underline"
                        >
                          {campaignFileName(p)}
                        </a>
                      ) : (
                        <span className="font-mono text-xs">{campaignFileName(p)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </Scene>

        <Scene num="03" title="Goal & funnel">
          <Row
            label="Objective"
            value={
              brief.objective ? (
                <span className="capitalize">{brief.objective}</span>
              ) : null
            }
          />
          <Row label="Awareness stage" value={brief.awareness_stage} />
          <Row label="KPI type" value={brief.kpi_type} />
          <Row label="KPI target" value={brief.kpi_target} />
          <Row label="Benchmark" value={brief.benchmark} />
          <Row label="Budget tier" value={brief.budget_tier} />
          <Row
            label="Destination"
            value={
              brief.destination_url ? (
                <a
                  href={brief.destination_url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline break-all"
                >
                  {brief.destination_url}
                </a>
              ) : null
            }
          />
        </Scene>

        <Scene num="04" title="Audience">
          <Row label="Age" value={brief.audience_age} />
          <Row label="Gender" value={brief.audience_gender} />
          <Row label="Location" value={brief.audience_location} />
          <Row label="Income" value={brief.audience_income} />
          <Row label="Psychographic" value={brief.psychographic} />
          <Row label="#1 pain / desire" value={brief.core_driver} />
          <Row label="#1 objection" value={brief.objection} />
          <Row label="Headspace" value={brief.headspace} />
          <Row label="Customer language" value={brief.customer_language} />
        </Scene>

        <Scene num="05" title="Proof & assets">
          <Row label="Testimonials" value={brief.testimonials} />
          <Row label="Stats / claims" value={brief.stats_claims} />
          {brief.claims_substantiated && (
            <Row
              label="Claims"
              value={<Bool on={true} label="Substantiated" />}
            />
          )}
          <Row label="Awards / press" value={brief.awards} />
          <Row label="Must include" value={brief.must_include} />
          {ugcPaths.length > 0 && (
            <Row
              label="UGC / footage"
              value={
                <ul className="space-y-1">
                  {ugcPaths.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {ugcUrls[p] ? (
                        <a
                          href={ugcUrls[p]}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs hover:underline"
                        >
                          {campaignFileName(p)}
                        </a>
                      ) : (
                        <span className="font-mono text-xs">{campaignFileName(p)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </Scene>

        <Scene num="06" title="Constraints & compliance">
          <Row label="Regulated" value={brief.regulated ? "Yes" : null} />
          <Row label="Disclosures" value={brief.disclosures} />
          <Row label="Regulatory notes" value={brief.regulatory_notes} />
          <Row label="Cannot claim" value={brief.cannot_claim} />
          <Row label="Legal copy" value={brief.legal_copy} />
          <Row label="Likeness" value={brief.likeness_notes} />
          {(brief.ai_disclosure || brief.captions_required) && (
            <Row
              label="Flags"
              value={
                <div className="flex flex-wrap gap-1.5">
                  <Bool on={!!brief.ai_disclosure} label="AI disclosed" />
                  <Bool on={!!brief.captions_required} label="Captions required" />
                </div>
              }
            />
          )}
        </Scene>

        <Scene num="07" title="Format & logistics">
          {archetypes.length > 0 && (
            <Row
              label="Archetypes"
              value={
                <div className="flex flex-wrap gap-1.5">
                  {archetypes.map((a) => (
                    <span
                      key={a}
                      className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px]"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              }
            />
          )}
          {placements.length > 0 && (
            <Row
              label="Placements"
              value={
                <div className="flex flex-wrap gap-1.5">
                  {placements.map((p) => (
                    <span
                      key={p}
                      className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded-[2px]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              }
            />
          )}
          <Row label="Variants" value={brief.variants_needed?.toString()} />
          <Row label="Languages" value={brief.languages} />
          <Row label="References" value={brief.reference_links} />
          <Row label="Notes" value={brief.notes} />
        </Scene>
      </div>
    </div>
  );
}