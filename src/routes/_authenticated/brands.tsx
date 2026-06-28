import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/brands")({
  component: () => (
    <PlaceholderPage
      title="Brands"
      kicker="BRAND BIBLE"
      description="Brand identity, voice, and guardrails for each client."
      addLabel="New Brand"
    />
  ),
});
