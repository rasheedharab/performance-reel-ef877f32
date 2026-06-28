import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/deliverables")({
  component: () => (
    <PlaceholderPage
      title="Deliverables"
      kicker="EXPORTS"
      description="Final masters per placement and aspect ratio."
      addLabel="New Deliverable"
    />
  ),
});
