import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/briefs")({
  component: () => (
    <PlaceholderPage
      title="Briefs"
      kicker="PROJECT INTAKE"
      description="Locked creative briefs — the source of truth for every ad."
      addLabel="New Brief"
    />
  ),
});
