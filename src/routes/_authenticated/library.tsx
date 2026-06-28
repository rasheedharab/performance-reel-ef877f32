import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/library")({
  component: () => (
    <PlaceholderPage
      title="Library"
      kicker="PROMPT VAULT"
      description="Reusable prompts tagged by archetype, tool, and performance."
      addLabel="New Prompt"
    />
  ),
});
