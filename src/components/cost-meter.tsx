import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

type Props = {
  /** Raw USD estimate from the provider model (before markup/fx). */
  estimatedUsd: number;
  /** Optional label for the line item (defaults to "Estimated spend"). */
  label?: string;
  className?: string;
};

/**
 * Reusable cost-aware footer for spend-before-confirm modals.
 * Shows cost in the user's display currency, current balance,
 * and balance-after-this-spend, with a clear insufficient-credits banner.
 */
export function CostMeter({ estimatedUsd, label = "Estimated spend", className }: Props) {
  const { profile, balance, toDisplay, format, currency } = useWallet();
  const charged = toDisplay(estimatedUsd);
  const available = balance?.available ?? 0;
  const after = available - charged;
  const insufficient = profile != null && balance != null && after < 0;
  const lowAfter =
    profile != null && balance != null && !insufficient && after < (profile.low_balance_threshold ?? 0);

  return (
    <div
      className={cn(
        "border rounded-[3px] bg-background p-3 text-xs space-y-2",
        insufficient ? "border-[var(--color-rec)]" : "border-border",
        className,
      )}
    >
      <div className="grid grid-cols-3 gap-3">
        <Cell label={label} value={format(charged)} accent />
        <Cell label="Balance" value={format(available)} />
        <Cell
          label="After"
          value={format(after)}
          tone={insufficient ? "danger" : lowAfter ? "warn" : "default"}
        />
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        ~${(Number(estimatedUsd) || 0).toFixed(4)} provider · ×
        {(profile?.markup_multiplier ?? 1).toFixed(2)} markup
        {currency === "INR" && profile
          ? ` · ₹${profile.fx_rate_inr_per_usd}/USD`
          : ""}
      </p>
      {insufficient && (
        <div className="flex items-start gap-2 text-[var(--color-rec)]">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Insufficient credits — you need{" "}
            <span className="font-mono font-semibold">{format(-after)}</span>{" "}
            more.{" "}
            <Link to="/wallet" className="underline underline-offset-2">
              Open wallet
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
  tone = "default",
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "default" | "warn" | "danger";
}) {
  return (
    <div>
      <p className="label-mono text-[9px]">{label}</p>
      <p
        className={cn(
          "font-mono font-semibold",
          accent && "text-foreground",
          tone === "warn" && "text-amber-600",
          tone === "danger" && "text-[var(--color-rec)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Returns true when the user cannot afford the given USD estimate.
 * Use to disable confirm buttons in spend modals.
 */
export function useCannotAfford(estimatedUsd: number): boolean {
  const { balance, toDisplay } = useWallet();
  if (!balance) return false;
  const charged = toDisplay(estimatedUsd);
  return charged > 0 && balance.available < charged;
}

/**
 * Tiny inline cost hint for AI-helper buttons (suggest angles, draft script, etc).
 * Renders just "~₹0.42" or "~$0.005" in the user's currency.
 */
export function CostHint({
  usd,
  className,
}: {
  usd: number;
  className?: string;
}) {
  const { toDisplay, format } = useWallet();
  const charged = toDisplay(usd);
  if (!usd) return null;
  return (
    <span className={cn("font-mono text-[10px] text-muted-foreground", className)}>
      ~{format(charged)}
    </span>
  );
}