import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { Pencil, FilePlus2, ArrowLeft, Building2, FileText, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getSignedUrl, getSignedUrls, fileNameFromPath } from "@/lib/brand-assets";
import { StyleBibleSection } from "@/components/style-bible-form";
import type { Database } from "@/integrations/supabase/types";

type Brand = Database["public"]["Tables"]["brands"]["Row"];

export const Route = createFileRoute("/_authenticated/brands/$brandId/")({
  component: BrandDetailPage,
});

function parseVoice(v: string | null): string[] {
  if (!v) return [];
  return v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}

function personalityNumber(p: unknown, key: string): number | null {
  if (!p || typeof p !== "object") return null;
  const v = (p as Record<string, unknown>)[key];
  return typeof v === "number" ? v : null;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6 mt-6">
      <p className="label-mono mb-4">{label}</p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 text-sm">
      <div className="label-mono text-[10px] pt-0.5">{label}</div>
      <div className="text-foreground whitespace-pre-wrap break-words">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

function PersonalityBar({
  left,
  right,
  value,
}: {
  left: string;
  right: string;
  value: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between label-mono text-[10px]">
        <span>{left}</span>
        <span className="font-mono text-foreground">{value ?? "—"}</span>
        <span>{right}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full relative overflow-hidden">
        {value !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[var(--color-rec)]"
            style={{ left: `calc(${value}% - 6px)` }}
          />
        )}
      </div>
    </div>
  );
}

function BrandDetailPage() {
  const { brandId } = useParams({ from: "/_authenticated/brands/$brandId/" });
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null | "missing">(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("id", brandId)
        .maybeSingle();
      if (error || !data) {
        setBrand("missing");
        return;
      }
      setBrand(data);
      if (data.logo_url) setLogo(await getSignedUrl(data.logo_url));
      const paths = Array.isArray(data.brand_asset_urls)
        ? (data.brand_asset_urls as string[])
        : [];
      if (paths.length) setAssetUrls(await getSignedUrls(paths));
    })();
  }, [brandId]);

  if (brand === null) {
    return (
      <div className="px-8 py-20 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (brand === "missing") {
    return (
      <div className="px-8 py-20 text-center">
        <p className="label-mono mb-3">Not found</p>
        <p className="text-sm text-muted-foreground mb-6">
          That brand doesn't exist or you don't have access.
        </p>
        <Button asChild variant="outline">
          <Link to="/brands">Back to brands</Link>
        </Button>
      </div>
    );
  }

  const voice = parseVoice(brand.brand_voice);
  const assetPaths = Array.isArray(brand.brand_asset_urls)
    ? (brand.brand_asset_urls as string[])
    : [];

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <Link
        to="/brands"
        className="label-mono inline-flex items-center gap-1.5 mb-6 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All brands
      </Link>

      {/* Slate header */}
      <div className="bg-card border border-border rounded-[3px] p-8 mb-2">
        <div className="flex items-start gap-6">
          <div className="h-20 w-20 rounded-[3px] border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
            {logo ? (
              <img src={logo} alt="" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="label-mono mb-1">Brand slate</p>
            <h1 className="font-display text-4xl font-bold tracking-tight leading-none">
              {brand.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {brand.category && <span>{brand.category}</span>}
              {brand.website && (
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {brand.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {(brand.primary_color || brand.secondary_color) && (
              <div className="flex items-center gap-2 mt-4">
                {brand.primary_color && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-6 w-6 rounded-[2px] border border-border"
                      style={{ background: brand.primary_color }}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">
                      {brand.primary_color}
                    </span>
                  </div>
                )}
                {brand.secondary_color && (
                  <div className="flex items-center gap-1.5 ml-3">
                    <span
                      className="h-6 w-6 rounded-[2px] border border-border"
                      style={{ background: brand.secondary_color }}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">
                      {brand.secondary_color}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            navigate({
              to: "/brands/$brandId/edit",
              params: { brandId: brand.id },
            })
          }
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button asChild size="sm">
          <Link to="/briefs/new" search={{ brand: brand.id }}>
            <FilePlus2 className="h-4 w-4" />
            New brief for this brand
          </Link>
        </Button>
      </div>

      <div className="bg-card border border-border rounded-[3px] p-8">
        <Section label="Identity">
          <Row label="One-line" value={brand.one_line_what_you_sell} />
          <Row
            label="Years in business"
            value={brand.years_in_business?.toString()}
          />
        </Section>

        <Section label="Voice & Tone">
          <Row
            label="Voice"
            value={
              voice.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {voice.map((v) => (
                    <span
                      key={v}
                      className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-[2px]"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              ) : null
            }
          />
          <Row label="Tone do's" value={brand.tone_do} />
          <Row label="Tone don'ts" value={brand.tone_dont} />
        </Section>

        <Section label="Personality">
          <PersonalityBar
            left="Playful"
            right="Serious"
            value={personalityNumber(brand.personality, "playful_serious")}
          />
          <PersonalityBar
            left="Premium"
            right="Accessible"
            value={personalityNumber(brand.personality, "premium_accessible")}
          />
          <PersonalityBar
            left="Bold"
            right="Understated"
            value={personalityNumber(brand.personality, "bold_understated")}
          />
        </Section>

        <Section label="Visual identity">
          <Row label="Fonts" value={brand.fonts} />
          <Row
            label="Brand assets"
            value={
              assetPaths.length > 0 ? (
                <ul className="divide-y divide-border border border-border rounded-[3px] bg-background">
                  {assetPaths.map((p) => (
                    <li key={p} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{fileNameFromPath(p)}</span>
                      {assetUrls[p] && (
                        <a
                          href={assetUrls[p]}
                          target="_blank"
                          rel="noreferrer"
                          className="label-mono hover:text-foreground"
                        >
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null
            }
          />
        </Section>

        <Section label="Guardrails">
          <Row label="Avoid resembling" value={brand.avoid_competitors} />
          <Row label="No-go list" value={brand.no_go_list} />
          <Row label="Notes" value={brand.notes} />
        </Section>

        <Section label="Style Bible">
          <StyleBibleSection brandId={brand.id} />
        </Section>
      </div>
    </div>
  );
}