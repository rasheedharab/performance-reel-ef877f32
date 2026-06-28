import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/generation")({
  component: () => (
    <PlaceholderPage
      title="Generation"
      kicker="AI BAY"
      description="Queue, generate, and triage clips, VOs, music, SFX."
      addLabel="New Generation"
    />
  ),
});
