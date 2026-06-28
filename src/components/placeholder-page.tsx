import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function PlaceholderPage({
  title,
  kicker,
  description,
  addLabel,
}: {
  title: string;
  kicker: string;
  description: string;
  addLabel: string;
}) {
  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-6 mb-10">
        <div>
          <p className="label-mono mb-2">{kicker}</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">{description}</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      <div className="border border-dashed border-border rounded-[3px] bg-card/50 p-16 text-center">
        <p className="label-mono mb-3">Empty reel</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This module is wired to the database and ready for forms. Add the first one to begin.
        </p>
      </div>
    </div>
  );
}