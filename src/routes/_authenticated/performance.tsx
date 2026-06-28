import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/performance")({
  component: () => (
    <PlaceholderPage
      title="Performance"
      kicker="TELEMETRY"
      description="Spend, hook rate, hold rate, CTR, CPA, ROAS."
      addLabel="Log Metrics"
    />
  ),
});
