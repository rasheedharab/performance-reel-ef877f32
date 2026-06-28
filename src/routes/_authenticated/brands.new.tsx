import { createFileRoute } from "@tanstack/react-router";
import { BrandForm, emptyBrand } from "@/components/brand-form";

export const Route = createFileRoute("/_authenticated/brands/new")({
  component: () => <BrandForm initial={emptyBrand} mode="create" />,
});