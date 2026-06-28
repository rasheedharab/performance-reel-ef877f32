import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandForm, emptyBrand, type BrandFormValues } from "@/components/brand-form";

export const Route = createFileRoute("/_authenticated/brands/$brandId/edit")({
  component: EditBrandPage,
});

function EditBrandPage() {
  const { brandId } = useParams({ from: "/_authenticated/brands/$brandId/edit" });
  const [initial, setInitial] = useState<BrandFormValues | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("id", brandId)
        .maybeSingle();
      if (error || !data) return;
      const p = (data.personality && typeof data.personality === "object"
        ? (data.personality as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      setInitial({
        ...emptyBrand,
        id: data.id,
        name: data.name ?? "",
        website: data.website ?? "",
        category: data.category ?? "",
        one_line_what_you_sell: data.one_line_what_you_sell ?? "",
        years_in_business: data.years_in_business?.toString() ?? "",
        brand_voice: data.brand_voice ?? "",
        tone_do: data.tone_do ?? "",
        tone_dont: data.tone_dont ?? "",
        personality: {
          playful_serious: typeof p.playful_serious === "number" ? p.playful_serious : 50,
          premium_accessible: typeof p.premium_accessible === "number" ? p.premium_accessible : 50,
          bold_understated: typeof p.bold_understated === "number" ? p.bold_understated : 50,
        },
        primary_color: data.primary_color ?? "#17171B",
        secondary_color: data.secondary_color ?? "#E0301E",
        fonts: data.fonts ?? "",
        logo_url: data.logo_url,
        brand_asset_urls: Array.isArray(data.brand_asset_urls)
          ? (data.brand_asset_urls as string[])
          : [],
        avoid_competitors: data.avoid_competitors ?? "",
        no_go_list: data.no_go_list ?? "",
        notes: data.notes ?? "",
      });
    })();
  }, [brandId]);

  if (!initial) {
    return (
      <div className="px-8 py-20 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return <BrandForm initial={initial} mode="edit" />;
}