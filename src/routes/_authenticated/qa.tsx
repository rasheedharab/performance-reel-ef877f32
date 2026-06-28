import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/qa")({
  component: () => (
    <PlaceholderPage
      title="QA & Compliance"
      kicker="REVIEW"
      description="Claims, disclosures, brand, specs — signed off."
      addLabel="New Review"
    />
  ),
});
