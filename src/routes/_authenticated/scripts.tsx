import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/scripts")({
  component: () => (
    <PlaceholderPage
      title="Scripts"
      kicker="WRITERS ROOM"
      description="Hooks, body, proof, CTA — written and timed."
      addLabel="New Script"
    />
  ),
});
