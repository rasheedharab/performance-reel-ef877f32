import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/edit-room")({
  component: () => (
    <PlaceholderPage
      title="Edit Room"
      kicker="POST"
      description="Cuts and versions in flight."
      addLabel="New Cut"
    />
  ),
});
