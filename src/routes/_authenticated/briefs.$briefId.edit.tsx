import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BriefForm, emptyBrief, type BriefFormValues } from "@/components/brief-form";

export const Route = createFileRoute("/_authenticated/briefs/$briefId/edit")({
  component: EditBriefPage,
});

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function EditBriefPage() {
  const { briefId } = useParams({ from: "/_authenticated/briefs/$briefId/edit" });
  const [initial, setInitial] = useState<BriefFormValues | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("briefs")
        .select("*")
        .eq("id", briefId)
        .maybeSingle();
      if (error || !data) return;
      const benefits = asStringArray(data.benefits);
      setInitial({
        ...emptyBrief,
        id: data.id,
        status: data.status,
        brand_id: data.brand_id,
        project_name: data.project_name ?? "",
        deadline: data.deadline ?? "",
        signoff_owner: data.signoff_owner ?? "",
        product_name: data.product_name ?? "",
        price: data.price?.toString() ?? "",
        product_description: data.product_description ?? "",
        benefits: [
          benefits[0] ?? "",
          benefits[1] ?? "",
          benefits[2] ?? "",
        ],
        wedge: data.wedge ?? "",
        offer_type: data.offer_type ?? "None",
        offer_detail: data.offer_detail ?? "",
        product_asset_urls: asStringArray(data.product_asset_urls),
        objective: data.objective ?? "",
        awareness_stage: data.awareness_stage ?? "",
        kpi_type: data.kpi_type ?? "",
        kpi_target: data.kpi_target ?? "",
        benchmark: data.benchmark ?? "",
        destination_url: data.destination_url ?? "",
        budget_tier: data.budget_tier ?? "",
        audience_age: data.audience_age ?? "",
        audience_gender: data.audience_gender ?? "",
        audience_location: data.audience_location ?? "",
        audience_income: data.audience_income ?? "",
        psychographic: data.psychographic ?? "",
        core_driver: data.core_driver ?? "",
        objection: data.objection ?? "",
        headspace: data.headspace ?? "",
        customer_language: data.customer_language ?? "",
        testimonials: data.testimonials ?? "",
        stats_claims: data.stats_claims ?? "",
        claims_substantiated: !!data.claims_substantiated,
        awards: data.awards ?? "",
        must_include: data.must_include ?? "",
        ugc_asset_urls: asStringArray(data.ugc_asset_urls),
        regulated: !!data.regulated,
        disclosures: data.disclosures ?? "",
        regulatory_notes: data.regulatory_notes ?? "",
        cannot_claim: data.cannot_claim ?? "",
        legal_copy: data.legal_copy ?? "",
        likeness_notes: data.likeness_notes ?? "",
        ai_disclosure: !!data.ai_disclosure,
        captions_required: !!data.captions_required,
        archetypes: asStringArray(data.archetypes),
        placements: asStringArray(data.placements),
        variants_needed: data.variants_needed?.toString() ?? "",
        languages: data.languages ?? "",
        reference_links: data.reference_links ?? "",
        notes: data.notes ?? "",
      });
    })();
  }, [briefId]);

  if (!initial) {
    return (
      <div className="px-8 py-20 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return <BriefForm initial={initial} mode="edit" />;
}