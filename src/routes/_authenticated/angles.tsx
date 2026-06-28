import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/angles")({
  component: () => (
    <PlaceholderPage
      title="Angles"
      kicker="STRATEGY"
      description="Entry points, segments, and the wedges driving each campaign."
      addLabel="New Angle"
    />
  ),
});
