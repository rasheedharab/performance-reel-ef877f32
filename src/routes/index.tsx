import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Check,
  Minus,
  Menu as MenuIcon,
  X,
  Sparkles,
  Wand2,
  Rocket,
  LineChart,
  Film,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reel Engine — The AI video-ad studio for Meta performance" },
      {
        name: "description",
        content:
          "Turn a brand brief into scroll-stopping Meta ads. Reel Engine runs strategy, AI video, compliance, testing, and the learning loop in one connected system for Facebook & Instagram.",
      },
      { property: "og:title", content: "Reel Engine — The AI video-ad studio for Meta performance" },
      {
        property: "og:description",
        content:
          "Brief in. Winners out. The AI video-ad studio built for the Meta auction — strategy, generation, compliance, testing, learning.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://performance-reel.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://performance-reel.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Reel Engine",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description:
            "AI video-ad studio for Meta performance. From brand brief to launched winners.",
        }),
      },
    ],
  }),
  component: LandingPage,
});

/* ---------- shared atoms ---------- */

function RecDot({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "inline-block h-2 w-2 rounded-full bg-[var(--color-rec)] motion-safe:animate-pulse " +
        className
      }
    />
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <RecDot />
      <span className="label-mono">{children}</span>
    </div>
  );
}

function SectionWrap({
  tone,
  children,
  id,
}: {
  tone: "dark" | "paper";
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={
        tone === "dark"
          ? "bg-[var(--color-ink)] text-[oklch(0.95_0.005_85)]"
          : "bg-[var(--color-paper)] text-[var(--color-ink)]"
      }
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-24">{children}</div>
    </section>
  );
}

/* ---------- nav ---------- */

function TopNav({ isAuthed }: { isAuthed: boolean }) {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#how", label: "How it works" },
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-[var(--color-ink)]/95 backdrop-blur text-[oklch(0.92_0.005_85)] border-b border-[oklch(0.28_0.005_280)]">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-14 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <RecDot />
          <span className="font-display font-bold text-sm tracking-tight text-[oklch(0.97_0.005_85)]">
            REEL ENGINE
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-[oklch(0.78_0.005_85)] hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden md:flex items-center gap-3">
          {isAuthed ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Link to="/auth" className="text-sm text-[oklch(0.85_0.005_85)] hover:text-white">
                Log in
              </Link>
              <Button asChild size="sm">
                <Link to="/auth">Start free</Link>
              </Button>
            </>
          )}
        </div>
        <button
          aria-label="Open menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden ml-auto p-2 rounded-[3px] hover:bg-[oklch(0.22_0.005_280)]"
        >
          {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-[oklch(0.28_0.005_280)] bg-[var(--color-ink)]">
          <div className="px-5 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-2 text-sm text-[oklch(0.85_0.005_85)]"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              {isAuthed ? (
                <Button asChild className="flex-1">
                  <Link to="/dashboard">Go to dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="flex-1 bg-transparent text-white border-[oklch(0.4_0.005_280)] hover:bg-[oklch(0.22_0.005_280)]">
                    <Link to="/auth">Log in</Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link to="/auth">Start free</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ---------- mock visuals ---------- */

function MockCaption({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex items-center gap-2 label-mono text-[oklch(0.6_0.005_85)]">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-rec)]" />
      <span>PREVIEW · {children}</span>
    </div>
  );
}

function MockFrame({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={
        "rounded-[4px] border overflow-hidden shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] " +
        (dark
          ? "bg-[oklch(0.22_0.005_280)] border-[oklch(0.32_0.005_280)] text-[oklch(0.95_0.005_85)]"
          : "bg-[var(--color-card)] border-[var(--color-hairline)] text-[var(--color-ink)]")
      }
    >
      <div
        className={
          "h-7 flex items-center gap-2 px-3 border-b " +
          (dark
            ? "border-[oklch(0.32_0.005_280)] bg-[oklch(0.2_0.005_280)]"
            : "border-[var(--color-hairline)] bg-[oklch(0.96_0.012_85)]")
        }
      >
        <RecDot />
        <span className="label-mono">REC</span>
        <span className={dark ? "h-2.5 w-px bg-[oklch(0.35_0.005_280)]" : "h-2.5 w-px bg-[var(--color-hairline)]"} />
        <span className="label-mono">REEL ENGINE</span>
      </div>
      {children}
    </div>
  );
}

function HeroStoryboardMock() {
  const shots = [
    { id: "01", label: "Hook · pattern interrupt", dur: "0:00–0:02", status: "GENERATED" },
    { id: "02", label: "Problem framing", dur: "0:02–0:05", status: "GENERATED" },
    { id: "03", label: "Product reveal", dur: "0:05–0:09", status: "QUEUED" },
    { id: "04", label: "Proof beat", dur: "0:09–0:13", status: "QUEUED" },
    { id: "05", label: "CTA", dur: "0:13–0:15", status: "DRAFT" },
  ];
  return (
    <MockFrame dark>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="label-mono mb-1 text-[oklch(0.7_0.005_85)]">STORYBOARD · 15s · 9:16</p>
            <p className="font-display font-bold text-sm sm:text-base">Lumen Skincare · Hook A — “3am text from my dermatologist”</p>
          </div>
          <span className="label-mono text-[var(--color-rec)] hidden sm:inline">● LIVE</span>
        </div>
        <div className="space-y-2">
          {shots.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[36px_64px_minmax(0,1fr)_auto] items-center gap-3 bg-[oklch(0.2_0.005_280)] border border-[oklch(0.32_0.005_280)] rounded-[3px] px-3 py-2.5"
            >
              <span className="label-mono text-[oklch(0.7_0.005_85)]">{s.id}</span>
              <div className="h-10 w-16 rounded-[2px] bg-gradient-to-br from-[oklch(0.32_0.02_280)] to-[oklch(0.18_0.005_280)] border border-[oklch(0.32_0.005_280)] relative overflow-hidden">
                <span className="absolute bottom-1 left-1 label-mono text-[9px] text-[oklch(0.85_0.005_85)]">{s.dur}</span>
              </div>
              <p className="text-xs sm:text-sm truncate">{s.label}</p>
              <span
                className={
                  "label-mono text-[10px] px-2 py-1 rounded-[2px] " +
                  (s.status === "GENERATED"
                    ? "bg-[oklch(0.3_0.05_150)] text-[oklch(0.9_0.05_150)]"
                    : s.status === "QUEUED"
                    ? "bg-[oklch(0.3_0.005_280)] text-[oklch(0.85_0.005_85)]"
                    : "bg-[oklch(0.32_0.18_27)] text-white")
                }
              >
                {s.status}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[oklch(0.32_0.005_280)] pt-3">
          <span className="label-mono text-[oklch(0.7_0.005_85)]">VEO 3 · KLING · FLUX</span>
          <span className="label-mono text-[oklch(0.7_0.005_85)]">CREDITS ▸ 12 / 200</span>
        </div>
      </div>
    </MockFrame>
  );
}

function MiniBriefMock() {
  return (
    <MockFrame>
      <div className="p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <p className="label-mono">BRIEF · SCENE 01 / PRODUCT</p>
          <span className="label-mono text-[var(--color-rec)]">DRAFT</span>
        </div>
        <div className="space-y-1.5">
          <p className="label-mono">PROJECT</p>
          <div className="h-7 rounded-[2px] border border-[var(--color-hairline)] bg-white/60 px-2 flex items-center font-medium">Lumen · Spring launch</div>
        </div>
        <div className="space-y-1.5">
          <p className="label-mono">AUDIENCE</p>
          <div className="h-7 rounded-[2px] border border-[var(--color-hairline)] bg-white/60 px-2 flex items-center">Women 28–42 · sensitive skin</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <p className="label-mono">OBJECTIVE</p>
            <div className="h-7 rounded-[2px] border border-[var(--color-hairline)] bg-white/60 px-2 flex items-center">Purchase</div>
          </div>
          <div className="space-y-1.5">
            <p className="label-mono">DEADLINE</p>
            <div className="h-7 rounded-[2px] border border-[var(--color-hairline)] bg-white/60 px-2 flex items-center">Apr 12</div>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

function MiniGenerationMock() {
  return (
    <MockFrame>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="label-mono">GENERATION · SHOT 03</p>
          <span className="label-mono">VEO 3</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-[9/16] rounded-[2px] bg-gradient-to-br from-[oklch(0.85_0.02_60)] to-[oklch(0.7_0.05_30)] border border-[var(--color-hairline)] relative"
            >
              <span className="absolute top-1 left-1 label-mono text-[9px] bg-white/80 px-1 rounded-[2px]">v{i}</span>
              {i === 2 && (
                <span className="absolute bottom-1 right-1 label-mono text-[9px] bg-[var(--color-rec)] text-white px-1 rounded-[2px]">PICK</span>
              )}
            </div>
          ))}
        </div>
        <p className="label-mono text-[oklch(0.5_0.005_85)]">SEED 7128 · BRAND BIBLE LOCKED</p>
      </div>
    </MockFrame>
  );
}

function MiniLaunchMock() {
  const cells = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"];
  return (
    <MockFrame>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-mono">TEST MATRIX</p>
          <span className="label-mono">HOOKS × ANGLES</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {cells.map((c, i) => (
            <div
              key={c}
              className={
                "aspect-square rounded-[2px] border flex items-center justify-center label-mono text-[10px] " +
                (i === 4
                  ? "bg-[var(--color-rec)] text-white border-[var(--color-rec)]"
                  : i % 3 === 0
                  ? "bg-[oklch(0.92_0.04_140)] border-[var(--color-hairline)]"
                  : "bg-[var(--color-card)] border-[var(--color-hairline)]")
              }
            >
              {c}
            </div>
          ))}
        </div>
        <p className="label-mono text-[oklch(0.5_0.005_85)]">9 VARIANTS · 4:5 + 9:16 · READY</p>
      </div>
    </MockFrame>
  );
}

function MiniPerformanceMock() {
  const bars = [40, 65, 50, 80, 95, 70, 60];
  return (
    <MockFrame>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-mono">PERFORMANCE · HOOK RATE</p>
          <span className="label-mono text-[var(--color-rec)]">+34%</span>
        </div>
        <div className="h-20 flex items-end gap-1.5">
          {bars.map((h, i) => (
            <div
              key={i}
              className={
                "flex-1 rounded-t-[2px] " + (i === 4 ? "bg-[var(--color-rec)]" : "bg-[oklch(0.8_0.012_85)]")
              }
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 label-mono">
          <div><span className="text-[oklch(0.5_0.005_85)]">HOOK</span><br/><span className="text-[var(--color-ink)] text-base">38%</span></div>
          <div><span className="text-[oklch(0.5_0.005_85)]">HOLD</span><br/><span className="text-[var(--color-ink)] text-base">61%</span></div>
          <div><span className="text-[oklch(0.5_0.005_85)]">ROAS</span><br/><span className="text-[var(--color-ink)] text-base">2.9x</span></div>
        </div>
      </div>
    </MockFrame>
  );
}

/* ---------- pipeline diagram ---------- */

function Pipeline() {
  const stops = [
    "Brand",
    "Brief",
    "Angles",
    "Scripts",
    "Storyboard",
    "Generation",
    "Edit",
    "Deliverables",
    "QA",
    "Launch",
    "Performance",
    "Library",
  ];
  return (
    <div className="relative">
      <div className="overflow-x-auto pb-4 -mx-5 sm:mx-0 px-5 sm:px-0 [scrollbar-width:thin]">
        <div className="flex items-stretch gap-2 min-w-max">
          {stops.map((s, i) => (
            <div key={s} className="flex items-stretch gap-2">
              <div className="w-[148px] sm:w-[160px] bg-[oklch(0.22_0.005_280)] border border-[oklch(0.32_0.005_280)] rounded-[3px] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="label-mono text-[oklch(0.6_0.005_85)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-rec)]" />
                </div>
                <p className="font-display font-bold text-sm">{s}</p>
                <div className="mt-3 h-1 w-full bg-[oklch(0.32_0.005_280)] overflow-hidden rounded-full">
                  <div
                    className="h-full bg-[var(--color-rec)]"
                    style={{ width: `${20 + ((i * 7) % 80)}%` }}
                  />
                </div>
              </div>
              {i < stops.length - 1 && (
                <div className="self-center text-[var(--color-rec)]">
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 text-[oklch(0.7_0.005_85)]">
        <div className="h-px flex-1 bg-[oklch(0.32_0.005_280)]" />
        <span className="label-mono flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-rec)]" />
          Library feeds the next brief
        </span>
        <div className="h-px flex-1 bg-[oklch(0.32_0.005_280)]" />
      </div>
    </div>
  );
}

/* ---------- book a demo ---------- */

function BookDemoDialog({
  trigger,
}: {
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("leads").insert({
        name: form.name,
        email: form.email,
        company: form.company || null,
        message: form.message || null,
        source: "landing_demo",
      });
      if (error) throw error;
      toast.success("Thanks — we'll be in touch within one business day.");
      setOpen(false);
      setForm({ name: "", email: "", company: "", message: "" });
    } catch (err) {
      // graceful mailto fallback
      const subject = encodeURIComponent("Reel Engine — demo request");
      const body = encodeURIComponent(
        `Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company}\n\n${form.message}`,
      );
      window.location.href = `mailto:hello@reelengine.app?subject=${subject}&body=${body}`;
      toast.message("Opening your email client as a fallback.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <RecDot />
            <span className="label-mono">BOOK A DEMO</span>
          </div>
          <DialogTitle className="font-display text-2xl">Walk through Reel Engine.</DialogTitle>
          <DialogDescription>
            Tell us about your team. We&apos;ll set up a 30-minute walkthrough.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="label-mono">Name</Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="label-mono">Work email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company" className="label-mono">Company</Label>
            <Input id="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message" className="label-mono">What are you trying to ship?</Label>
            <Textarea id="message" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Sending…" : "Request a demo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- the page ---------- */

function LandingPage() {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setIsAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthed(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const primaryCta = () =>
    isAuthed ? navigate({ to: "/dashboard" }) : navigate({ to: "/auth" });

  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]">
      <TopNav isAuthed={isAuthed} />

      {/* HERO */}
      <section className="relative bg-[var(--color-ink)] text-[oklch(0.95_0.005_85)] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, var(--color-rec) 0, transparent 40%), radial-gradient(circle at 80% 60%, oklch(0.4 0.04 280) 0, transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8 pt-12 sm:pt-20 pb-16 sm:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
            <Eyebrow>THE AI VIDEO-AD STUDIO FOR META PERFORMANCE</Eyebrow>
            <h1 className="font-display font-bold tracking-tight leading-[0.95] text-[2.5rem] sm:text-6xl lg:text-[4.25rem]">
              Turn a brand brief into <span className="text-[var(--color-rec)]">scroll-stopping</span> Meta ads.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-[oklch(0.78_0.005_85)] max-w-xl">
              Reel Engine runs your entire performance-creative pipeline — strategy, AI video, compliance, testing, and the learning loop — in one connected system built for Facebook and Instagram.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={primaryCta}>
                Start free <ArrowRight className="h-4 w-4" />
              </Button>
              <BookDemoDialog
                trigger={
                  <Button
                    size="lg"
                    variant="outline"
                    className="bg-transparent text-white border-[oklch(0.45_0.005_280)] hover:bg-[oklch(0.22_0.005_280)] hover:text-white"
                  >
                    Book a demo
                  </Button>
                }
              />
            </div>
            <p className="mt-10 label-mono text-[oklch(0.65_0.005_85)]">
              POWERED BY VEO · KLING · RUNWAY · FLUX
            </p>
          </div>
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-1000">
            <HeroStoryboardMock />
            <MockCaption>Storyboard · in-app preview</MockCaption>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <SectionWrap tone="paper" id="problem">
        <Eyebrow>SCENE 01 / THE BOTTLENECK</Eyebrow>
        <h2 className="font-display font-bold tracking-tight text-3xl sm:text-5xl max-w-3xl leading-[1.05]">
          Creative is the bottleneck. Your stack is the reason.
        </h2>
        <p className="mt-5 text-base sm:text-lg max-w-3xl text-[oklch(0.35_0.01_80)]">
          Meta&apos;s algorithm runs on fresh creative. Winning means shipping new, on-brand, spec-correct videos every week — and most teams can&apos;t move that fast.
        </p>
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {[
            { t: "Tool sprawl", d: "Six disconnected tools. The brief re-typed into every one." },
            { t: "Slow velocity", d: "Hand-stitching clips while creative fatigue eats your spend." },
            { t: "Off-brand AI slop", d: "Warped products, drifting faces, generic output that doesn't convert." },
          ].map((p, i) => (
            <div
              key={p.t}
              className="bg-[var(--color-card)] border border-[var(--color-hairline)] rounded-[3px] p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="label-mono">PAIN · {String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="font-display font-bold text-xl tracking-tight">{p.t}</h3>
              <p className="mt-3 text-sm text-[oklch(0.4_0.01_80)] leading-relaxed">{p.d}</p>
            </div>
          ))}
        </div>
      </SectionWrap>

      {/* SOLUTION / PIPELINE */}
      <SectionWrap tone="dark" id="solution">
        <Eyebrow>SCENE 02 / THE SYSTEM</Eyebrow>
        <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end">
          <h2 className="font-display font-bold tracking-tight text-3xl sm:text-5xl max-w-3xl leading-[1.05]">
            One system, from brief to winner.
          </h2>
          <p className="text-[oklch(0.78_0.005_85)] max-w-md text-sm sm:text-base">
            Every stage feeds the next. Nothing gets re-entered. Nothing gets lost.
          </p>
        </div>
        <div className="mt-12">
          <Pipeline />
        </div>
      </SectionWrap>

      {/* HOW IT WORKS */}
      <SectionWrap tone="paper" id="how">
        <Eyebrow>SCENE 03 / HOW IT WORKS</Eyebrow>
        <h2 className="font-display font-bold tracking-tight text-3xl sm:text-5xl max-w-3xl leading-[1.05]">
          Four steps. One throughline.
        </h2>
        <div className="mt-12 space-y-10 sm:space-y-16">
          {[
            {
              n: "01",
              t: "Capture the brief",
              d: "Brand voice, product, audience, and goals in one structured intake.",
              mock: <MiniBriefMock />,
              cap: "Brief intake",
              icon: Sparkles,
            },
            {
              n: "02",
              t: "Generate & assemble",
              d: "AI drafts angles and scripts, breaks them into shots, generates images and video across the best models, and assembles spec-correct cuts.",
              mock: <MiniGenerationMock />,
              cap: "Generation board",
              icon: Wand2,
            },
            {
              n: "03",
              t: "Launch & test",
              d: "Placement-ready exports mapped into a hooks × angles × formats test matrix.",
              mock: <MiniLaunchMock />,
              cap: "Test matrix",
              icon: Rocket,
            },
            {
              n: "04",
              t: "Learn & scale",
              d: "Funnel diagnostics show what won and why. Winners distill into a library that compounds.",
              mock: <MiniPerformanceMock />,
              cap: "Performance diagnostics",
              icon: LineChart,
            },
          ].map((step, i) => (
            <div
              key={step.n}
              className={
                "grid lg:grid-cols-2 gap-8 lg:gap-14 items-center " +
                (i % 2 ? "" : "")
              }
            >
              <div className={i % 2 ? "lg:order-2" : ""}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-[3px] bg-[var(--color-ink)] text-white font-display font-bold text-sm">
                    {step.n}
                  </span>
                  <step.icon className="h-4 w-4 text-[var(--color-rec)]" />
                </div>
                <h3 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">{step.t}</h3>
                <p className="mt-3 text-[oklch(0.4_0.01_80)] max-w-md">{step.d}</p>
              </div>
              <div className={i % 2 ? "lg:order-1" : ""}>
                {step.mock}
                <MockCaption>{step.cap}</MockCaption>
              </div>
            </div>
          ))}
        </div>
      </SectionWrap>

      {/* FEATURES */}
      <SectionWrap tone="dark" id="features">
        <Eyebrow>SCENE 04 / WHAT&apos;S INSIDE</Eyebrow>
        <h2 className="font-display font-bold tracking-tight text-3xl sm:text-5xl max-w-3xl leading-[1.05]">
          Five pillars. Built for the auction.
        </h2>
        <div className="mt-12 grid md:grid-cols-2 gap-4">
          {[
            {
              t: "Never re-type a brief again",
              d: "AI angles grounded in your real audience truth, and hook-led scripts built to land with the sound off.",
              mock: (
                <div className="space-y-1.5">
                  {["Hook · pattern interrupt", "Angle · pain → outcome", "Script · 15s · sound-off"].map((s) => (
                    <div key={s} className="flex items-center gap-2 bg-[oklch(0.2_0.005_280)] border border-[oklch(0.32_0.005_280)] rounded-[2px] px-2.5 py-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-rec)]" />
                      <span className="text-xs">{s}</span>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              t: "Generation that stays on-brand",
              d: "Multi-model video and image generation with a prompt compiler, AI anchor-frame creation, and brand consistency locked by seed and style bible.",
              mock: (
                <div className="grid grid-cols-4 gap-1.5">
                  {[0,1,2,3].map((i) => (
                    <div key={i} className="aspect-[9/16] rounded-[2px] bg-gradient-to-br from-[oklch(0.4_0.05_30)] to-[oklch(0.28_0.02_280)] border border-[oklch(0.32_0.005_280)]" />
                  ))}
                </div>
              ),
            },
            {
              t: "Spec-perfect, compliance-checked",
              d: "Storyboard tool-routing, edit assembly, placement-correct 9:16 and 4:5 exports, and a pre-launch compliance gate.",
              mock: (
                <div className="flex gap-2 items-end">
                  <div className="w-12 aspect-[9/16] rounded-[2px] bg-[oklch(0.32_0.005_280)] border border-[oklch(0.4_0.005_280)] flex items-end justify-center p-1"><span className="label-mono text-[9px]">9:16</span></div>
                  <div className="w-16 aspect-[4/5] rounded-[2px] bg-[oklch(0.32_0.005_280)] border border-[oklch(0.4_0.005_280)] flex items-end justify-center p-1"><span className="label-mono text-[9px]">4:5</span></div>
                  <div className="flex-1 space-y-1 pl-2">
                    <div className="flex items-center gap-1.5 text-xs"><Check className="h-3 w-3 text-[var(--color-rec)]" /> Safe zones</div>
                    <div className="flex items-center gap-1.5 text-xs"><Check className="h-3 w-3 text-[var(--color-rec)]" /> Captions burned</div>
                    <div className="flex items-center gap-1.5 text-xs"><Check className="h-3 w-3 text-[var(--color-rec)]" /> Policy clean</div>
                  </div>
                </div>
              ),
            },
            {
              t: "Know which creative won — and why",
              d: "A test matrix plus hook-rate, hold-rate, CTR and ROAS diagnostics, feeding a winners library that makes the next campaign faster.",
              mock: (
                <div className="grid grid-cols-3 gap-2 label-mono">
                  <div className="bg-[oklch(0.2_0.005_280)] p-2 rounded-[2px]"><div className="text-[oklch(0.6_0.005_85)]">HOOK</div><div className="text-white text-base">41%</div></div>
                  <div className="bg-[oklch(0.2_0.005_280)] p-2 rounded-[2px]"><div className="text-[oklch(0.6_0.005_85)]">HOLD</div><div className="text-white text-base">63%</div></div>
                  <div className="bg-[var(--color-rec)]/15 p-2 rounded-[2px] border border-[var(--color-rec)]/40"><div className="text-[oklch(0.8_0.1_27)]">ROAS</div><div className="text-white text-base">3.4x</div></div>
                </div>
              ),
            },
            {
              t: "Built to run as a platform",
              d: "Multi-tenant team access and credit wallets in INR or USD, with spend visible down to the individual shot.",
              mock: (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-[oklch(0.2_0.005_280)] border border-[oklch(0.32_0.005_280)] rounded-[2px] px-3 py-2"><span className="label-mono">BALANCE</span><span className="font-display font-bold">₹ 18,420</span></div>
                  <div className="flex items-center justify-between bg-[oklch(0.2_0.005_280)] border border-[oklch(0.32_0.005_280)] rounded-[2px] px-3 py-2"><span className="label-mono">SHOT 03 · VEO</span><span className="label-mono text-[var(--color-rec)]">−₹ 320</span></div>
                </div>
              ),
            },
          ].map((f) => (
            <div
              key={f.t}
              className="bg-[oklch(0.22_0.005_280)] border border-[oklch(0.32_0.005_280)] rounded-[3px] p-6"
            >
              <h3 className="font-display font-bold text-xl sm:text-2xl tracking-tight leading-snug">
                {f.t}
              </h3>
              <p className="mt-3 text-sm text-[oklch(0.78_0.005_85)] leading-relaxed">{f.d}</p>
              <div className="mt-5 pt-5 border-t border-[oklch(0.32_0.005_280)]">{f.mock}</div>
            </div>
          ))}
        </div>
      </SectionWrap>

      {/* BUILT FOR META */}
      <SectionWrap tone="paper" id="meta">
        <Eyebrow>SCENE 05 / ENGINEERED FOR THE AUCTION</Eyebrow>
        <h2 className="font-display font-bold tracking-tight text-3xl sm:text-5xl max-w-3xl leading-[1.05]">
          Not generic AI video. Engineered for the Meta auction.
        </h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            "Correct 9:16 & 4:5 specs and safe zones, baked in.",
            "Burned-in captions for sound-off viewing.",
            "Full-resolution exports — because Meta's delivery rewards creative quality.",
            "Diagnostics in the metrics that matter: hook rate, hold rate, thumbstop.",
          ].map((line, i) => (
            <div key={i} className="bg-[var(--color-card)] border border-[var(--color-hairline)] rounded-[3px] p-5">
              <span className="label-mono">FACT · {String(i + 1).padStart(2, "0")}</span>
              <p className="mt-3 text-sm font-medium leading-relaxed">{line}</p>
            </div>
          ))}
        </div>
      </SectionWrap>

      {/* DIFFERENTIATION */}
      <SectionWrap tone="dark" id="difference">
        <Eyebrow>SCENE 06 / THE DIFFERENCE</Eyebrow>
        <h2 className="font-display font-bold tracking-tight text-3xl sm:text-5xl max-w-3xl leading-[1.05]">
          Same job. Three very different ways to do it.
        </h2>
        <div className="mt-10 overflow-x-auto -mx-5 sm:mx-0">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-4 label-mono text-[oklch(0.6_0.005_85)] font-normal align-bottom"> </th>
                <th className="p-4 align-bottom">
                  <div className="flex items-center gap-2">
                    <RecDot />
                    <span className="font-display font-bold text-base">Reel Engine</span>
                  </div>
                </th>
                <th className="p-4 align-bottom font-display font-bold text-[oklch(0.78_0.005_85)]">A stack of point tools</th>
                <th className="p-4 align-bottom font-display font-bold text-[oklch(0.78_0.005_85)]">Doing it manually</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Time per concept", "Hours", "Days", "Weeks"],
                ["Brand consistency", true, "Partial", false],
                ["Spec compliance", true, "Manual", "Manual"],
                ["Testing built in", true, false, false],
                ["Learnings retained", true, false, "Tribal"],
                ["Cost visibility", "Per shot", "Per tool", "Hidden"],
              ].map((row, i) => (
                <tr key={i} className={i % 2 ? "bg-[oklch(0.2_0.005_280)]" : ""}>
                  <td className="p-4 label-mono text-[oklch(0.78_0.005_85)] border-t border-[oklch(0.32_0.005_280)]">{row[0] as string}</td>
                  {[1, 2, 3].map((c) => {
                    const val = row[c];
                    return (
                      <td key={c} className="p-4 border-t border-[oklch(0.32_0.005_280)]">
                        {val === true ? (
                          <Check className={"h-4 w-4 " + (c === 1 ? "text-[var(--color-rec)]" : "text-[oklch(0.78_0.005_85)]")} />
                        ) : val === false ? (
                          <Minus className="h-4 w-4 text-[oklch(0.55_0.005_85)]" />
                        ) : (
                          <span className={c === 1 ? "font-medium text-white" : "text-[oklch(0.78_0.005_85)]"}>{val as string}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionWrap>

      {/* PRICING */}
      <SectionWrap tone="paper" id="pricing">
        <Eyebrow>SCENE 07 / PRICING</Eyebrow>
        <h2 className="font-display font-bold tracking-tight text-3xl sm:text-5xl max-w-3xl leading-[1.05]">
          Plans for seats. Credits for what you produce.
        </h2>
        <p className="mt-5 text-base sm:text-lg max-w-2xl text-[oklch(0.35_0.01_80)]">
          Transparent, controllable spend — see every rupee and dollar, down to the shot.
        </p>
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {[
            {
              name: "Starter",
              price: "$—/mo",
              seats: "1 seat",
              credits: "Light monthly credits",
              features: ["1 brand", "Brief → Generation → Launch", "Basic diagnostics", "Email support"],
              cta: "Start free",
              ctaAction: "auth" as const,
              featured: false,
            },
            {
              name: "Studio",
              price: "$—/mo",
              seats: "Up to 5 seats",
              credits: "Pro monthly credits",
              features: ["Up to 5 brands", "Full pipeline + Edit Room", "Style bibles & seeds", "Performance loop & library"],
              cta: "Start free",
              ctaAction: "auth" as const,
              featured: true,
            },
            {
              name: "Agency",
              price: "Talk to us",
              seats: "Unlimited seats",
              credits: "Pooled credit wallet",
              features: ["Unlimited brands", "Multi-tenant org & SSO-ready", "Priority models & queues", "Dedicated CSM"],
              cta: "Talk to us",
              ctaAction: "demo" as const,
              featured: false,
            },
          ].map((tier) => {
            const card = (
              <div
                key={tier.name}
                className={
                  "rounded-[3px] border p-6 flex flex-col h-full bg-[var(--color-card)] " +
                  (tier.featured
                    ? "border-[var(--color-rec)] shadow-[0_24px_60px_-30px_rgba(224,48,30,0.45)]"
                    : "border-[var(--color-hairline)]")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="label-mono">{tier.name.toUpperCase()}</span>
                  {tier.featured && (
                    <span className="label-mono text-[var(--color-rec)] flex items-center gap-1.5">
                      <RecDot /> MOST PICKED
                    </span>
                  )}
                </div>
                <p className="mt-4 font-display font-bold text-4xl tracking-tight">{tier.price}</p>
                <p className="mt-1 label-mono">{tier.seats}</p>
                <p className="label-mono">{tier.credits}</p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 mt-0.5 text-[var(--color-rec)] shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {tier.ctaAction === "demo" ? (
                    <BookDemoDialog
                      trigger={
                        <Button variant={tier.featured ? "default" : "outline"} className="w-full">
                          {tier.cta}
                        </Button>
                      }
                    />
                  ) : (
                    <Button asChild variant={tier.featured ? "default" : "outline"} className="w-full">
                      <Link to="/auth">{tier.cta}</Link>
                    </Button>
                  )}
                </div>
              </div>
            );
            return card;
          })}
        </div>
        <p className="mt-6 text-sm text-[oklch(0.4_0.01_80)] max-w-2xl">
          Generation runs on credits in INR or USD — pay only for what you make.
        </p>
      </SectionWrap>

      {/* PROOF */}
      <SectionWrap tone="dark" id="proof">
        <Eyebrow>SCENE 08 / RESULTS</Eyebrow>
        <h2 className="font-display font-bold tracking-tight text-3xl sm:text-5xl max-w-3xl leading-[1.05]">
          Real teams. Real reps. <span className="text-[var(--color-rec)]">Placeholders for now.</span>
        </h2>
        <div className="mt-12 grid sm:grid-cols-3 gap-4 mb-12">
          {[
            { stat: "Xx", label: "MORE CREATIVE SHIPPED PER WEEK" },
            { stat: "X%", label: "FASTER FROM BRIEF TO LAUNCH" },
            { stat: "X%", label: "ROAS LIFT ON WINNERS" },
          ].map((s) => (
            <div key={s.label} className="bg-[oklch(0.22_0.005_280)] border border-[oklch(0.32_0.005_280)] rounded-[3px] p-6">
              <p className="font-display font-bold text-5xl tracking-tight text-[var(--color-rec)]">{s.stat}</p>
              <p className="mt-3 label-mono text-[oklch(0.78_0.005_85)]">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { q: "We ship in days what used to take weeks — and the brand still looks like us.", who: "[ Placeholder ]", role: "[ Head of Growth, brand TBD ]" },
            { q: "The test matrix and diagnostics finally connected what we made to what worked.", who: "[ Placeholder ]", role: "[ Creative Director, agency TBD ]" },
          ].map((t, i) => (
            <figure key={i} className="bg-[oklch(0.22_0.005_280)] border border-[oklch(0.32_0.005_280)] rounded-[3px] p-6">
              <blockquote className="font-display text-xl leading-snug">&ldquo;{t.q}&rdquo;</blockquote>
              <figcaption className="mt-5 label-mono text-[oklch(0.78_0.005_85)]">
                {t.who} · {t.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </SectionWrap>

      {/* FAQ */}
      <SectionWrap tone="paper" id="faq">
        <Eyebrow>SCENE 09 / QUESTIONS</Eyebrow>
        <h2 className="font-display font-bold tracking-tight text-3xl sm:text-5xl max-w-3xl leading-[1.05]">
          Things teams ask first.
        </h2>
        <div className="mt-10 max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {[
              {
                q: "Will the output actually be on-brand?",
                a: "Yes. Every brand has a style bible and locked seeds, the prompt compiler grounds every generation in your voice and visual rules, and anchor-frame creation keeps faces and products consistent across shots.",
              },
              {
                q: "Do I own the content and commercial rights?",
                a: "You own everything you generate. Reel Engine is the production environment — the assets, the briefs, the cuts, and the learnings belong to your team.",
              },
              {
                q: "Which AI models does it use?",
                a: "We multi-model by design: Veo, Kling, and Runway for video; Flux for image and anchor frames; ElevenLabs for voiceover; Claude for strategy and copy. The storyboard tool-router picks the right model per shot.",
              },
              {
                q: "How does credit pricing work?",
                a: "Seats are subscription. Generation runs on credits, in INR or USD. Every credit debit is logged against the exact brief, brand, and shot — so you always see what each cut actually cost.",
              },
              {
                q: "Is it compliant with Meta's ad policies?",
                a: "Spec compliance is baked in: 9:16 and 4:5 placements, safe zones, burned-in captions, and a pre-launch QA pass that flags policy and disclosure risks before anything ships.",
              },
              {
                q: "Can my whole team use it?",
                a: "Yes. Multi-tenant by default, with role-based access, brand-level permissions, pooled credit wallets, and admin spend caps per brief or user.",
              },
            ].map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-[var(--color-hairline)]">
                <AccordionTrigger className="font-display font-bold text-left text-lg hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-[oklch(0.35_0.01_80)] text-base leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SectionWrap>

      {/* FINAL CTA */}
      <section className="relative bg-[var(--color-ink)] text-white overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at center, var(--color-rec) 0, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8 py-20 sm:py-28 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <RecDot />
            <span className="label-mono">FINAL CUT</span>
          </div>
          <h2 className="font-display font-bold tracking-tight text-4xl sm:text-6xl lg:text-7xl leading-[0.95] max-w-4xl mx-auto">
            Stop assembling tools.<br />
            Start shipping <span className="text-[var(--color-rec)]">winners</span>.
          </h2>
          <p className="mt-6 text-base sm:text-lg text-[oklch(0.8_0.005_85)]">
            Brief in. Winners out.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={primaryCta}>
              Start free <ArrowRight className="h-4 w-4" />
            </Button>
            <BookDemoDialog
              trigger={
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent text-white border-[oklch(0.45_0.005_280)] hover:bg-[oklch(0.22_0.005_280)] hover:text-white"
                >
                  Book a demo
                </Button>
              }
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[var(--color-ink)] text-[oklch(0.75_0.005_85)] border-t border-[oklch(0.28_0.005_280)]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-12 grid md:grid-cols-[1.2fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <RecDot />
              <span className="font-display font-bold text-white text-sm tracking-tight">REEL ENGINE</span>
            </div>
            <p className="text-xs max-w-xs leading-relaxed">
              Built for performance marketers, by people who live in Ads Manager.
            </p>
          </div>
          <div>
            <p className="label-mono text-[oklch(0.55_0.005_85)] mb-3">Product</p>
            <ul className="space-y-2 text-sm">
              <li><a className="hover:text-white" href="#how">How it works</a></li>
              <li><a className="hover:text-white" href="#features">Features</a></li>
              <li><a className="hover:text-white" href="#pricing">Pricing</a></li>
              <li><a className="hover:text-white" href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="label-mono text-[oklch(0.55_0.005_85)] mb-3">Legal</p>
            <ul className="space-y-2 text-sm">
              <li><a className="hover:text-white" href="#">Terms</a></li>
              <li><a className="hover:text-white" href="#">Privacy</a></li>
              <li><a className="hover:text-white" href="#">AI Disclosure</a></li>
            </ul>
          </div>
          <div>
            <p className="label-mono text-[oklch(0.55_0.005_85)] mb-3">Contact</p>
            <ul className="space-y-2 text-sm">
              <li><a className="hover:text-white" href="mailto:hello@reelengine.app">hello@reelengine.app</a></li>
              <li><a className="hover:text-white" href="#">Twitter / X</a></li>
              <li><a className="hover:text-white" href="#">LinkedIn</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[oklch(0.28_0.005_280)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 label-mono">
            <span>© {new Date().getFullYear()} REEL ENGINE · ALL RIGHTS RESERVED</span>
            <span className="flex items-center gap-2"><Film className="h-3 w-3 text-[var(--color-rec)]" /> CUT IN THE EDIT SUITE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
