import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Lightbulb,
  ScrollText,
  Clapperboard,
  Sparkles,
  Scissors,
  Package,
  ShieldCheck,
  Rocket,
  LineChart,
  Library,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/brands", label: "Brands", icon: Building2 },
  { to: "/briefs", label: "Briefs", icon: FileText },
  { to: "/angles", label: "Angles", icon: Lightbulb },
  { to: "/scripts", label: "Scripts", icon: ScrollText },
  { to: "/storyboard", label: "Storyboard", icon: Clapperboard },
  { to: "/generation", label: "Generation", icon: Sparkles },
  { to: "/edit-room", label: "Edit Room", icon: Scissors },
  { to: "/deliverables", label: "Deliverables", icon: Package },
  { to: "/qa", label: "QA & Compliance", icon: ShieldCheck },
  { to: "/launch", label: "Launch & Tests", icon: Rocket },
  { to: "/performance", label: "Performance", icon: LineChart },
  { to: "/library", label: "Library", icon: Library },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const current = nav.find((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to))) ?? nav[0];

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-60 bg-[var(--color-ink)] text-[oklch(0.85_0.005_85)] flex flex-col shrink-0">
        <div className="px-5 h-12 flex items-center gap-2 border-b border-[oklch(0.28_0.005_280)]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-rec)] animate-pulse" />
          <span className="font-display font-bold text-[oklch(0.95_0.005_85)] text-sm tracking-tight">
            REEL ENGINE
          </span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-[3px] text-sm transition-colors",
                  active
                    ? "bg-[oklch(0.24_0.005_280)] text-white border-l-2 border-[var(--color-rec)] pl-[10px]"
                    : "text-[oklch(0.75_0.005_85)] hover:bg-[oklch(0.22_0.005_280)] hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-5 py-3 text-xs label-mono border-t border-[oklch(0.28_0.005_280)] hover:bg-[oklch(0.22_0.005_280)] hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 bg-[var(--color-ink)] text-[oklch(0.95_0.005_85)] flex items-center px-6 gap-3 border-b border-[oklch(0.28_0.005_280)]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-rec)] animate-pulse" />
          <span className="label-mono text-[oklch(0.85_0.005_85)]">REC</span>
          <div className="h-3 w-px bg-[oklch(0.35_0.005_280)]" />
          <span className="label-mono text-[oklch(0.95_0.005_85)]">{current.label}</span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}