import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getSignedUrls } from "@/lib/brand-assets";
import type { Database } from "@/integrations/supabase/types";

type Brand = Database["public"]["Tables"]["brands"]["Row"];

export const Route = createFileRoute("/_authenticated/brands/")({
  component: BrandsListPage,
});

function parseVoice(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function BrandsListPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return;
      setBrands(data);
      const paths = data.map((b) => b.logo_url).filter((p): p is string => !!p);
      if (paths.length) setLogoUrls(await getSignedUrls(paths));
    })();
  }, []);

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
        <div>
          <p className="label-mono mb-2">Brand Bible</p>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Reusable client profiles. Briefs attach to a brand to inherit voice,
            colors, and guardrails.
          </p>
        </div>
        <Button asChild>
          <Link to="/brands/new">
            <Plus className="h-4 w-4" />
            New Brand
          </Link>
        </Button>
      </div>

      {brands === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-[3px] border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
          <p className="label-mono mb-3">Empty reel</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            No brands yet. Add your first client brand to start producing ads.
          </p>
          <Button asChild>
            <Link to="/brands/new">
              <Plus className="h-4 w-4" />
              New Brand
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => {
            const voice = parseVoice(b.brand_voice);
            const logo = b.logo_url ? logoUrls[b.logo_url] : null;
            return (
              <Link
                key={b.id}
                to="/brands/$brandId"
                params={{ brandId: b.id }}
                className="group bg-card border border-border rounded-[3px] p-5 hover:border-foreground/30 transition-colors flex flex-col"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-12 w-12 rounded-[3px] border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                    {logo ? (
                      <img
                        src={logo}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display font-bold text-lg leading-tight truncate">
                      {b.name}
                    </h2>
                    {b.category && (
                      <p className="label-mono text-[10px] mt-1 truncate">
                        {b.category}
                      </p>
                    )}
                  </div>
                </div>

                {(b.primary_color || b.secondary_color) && (
                  <div className="flex items-center gap-1.5 mb-3">
                    {b.primary_color && (
                      <span
                        className="h-5 w-5 rounded-[2px] border border-border"
                        style={{ background: b.primary_color }}
                        title={b.primary_color}
                      />
                    )}
                    {b.secondary_color && (
                      <span
                        className="h-5 w-5 rounded-[2px] border border-border"
                        style={{ background: b.secondary_color }}
                        title={b.secondary_color}
                      />
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground ml-1 truncate">
                      {b.primary_color}
                    </span>
                  </div>
                )}

                {voice.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-auto">
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}