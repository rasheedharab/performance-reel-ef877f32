import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BriefForm, emptyBrief } from "@/components/brief-form";

const searchSchema = z.object({
  brand: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/briefs/new")({
  validateSearch: searchSchema,
  component: NewBriefPage,
});

function NewBriefPage() {
  const { brand } = Route.useSearch();
  return (
    <BriefForm
      initial={{ ...emptyBrief, brand_id: brand ?? "" }}
      mode="create"
    />
  );
}