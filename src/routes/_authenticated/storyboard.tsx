import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/storyboard")({
  component: () => (
    <PlaceholderPage
      title="Storyboard"
      kicker="PRE-PRODUCTION"
      description="Shot lists, camera moves, and references."
      addLabel="New Shot"
    />
  ),
});
