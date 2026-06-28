import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/launch")({
  component: () => (
    <PlaceholderPage
      title="Launch & Tests"
      kicker="MEDIA"
      description="Campaign structure, naming, and test matrices."
      addLabel="New Campaign"
    />
  ),
});
