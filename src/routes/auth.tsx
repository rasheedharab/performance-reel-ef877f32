import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left rail — editorial */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[var(--color-ink)] text-[oklch(0.95_0.005_85)] p-12">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-rec)] animate-pulse" />
          <span className="label-mono text-[oklch(0.85_0.005_85)]">REC · REEL ENGINE</span>
        </div>
        <div>
          <h1 className="font-display text-6xl font-bold leading-[0.95] tracking-tight">
            The cutting room<br />for AI ads.
          </h1>
          <p className="mt-6 text-base text-[oklch(0.75_0.005_85)] max-w-md">
            From brief to launch — angles, scripts, shots, generations, cuts, deliverables, QA, and performance. One signal chain.
          </p>
        </div>
        <div className="label-mono text-[oklch(0.65_0.005_85)]">
          INTERNAL TOOL · v0.1
        </div>
      </div>

      {/* Right — auth */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="h-2 w-2 rounded-full bg-[var(--color-rec)]" />
            <span className="label-mono">REEL ENGINE</span>
          </div>
          <p className="label-mono mb-3">{mode === "signin" ? "Sign in" : "Create account"}</p>
          <h2 className="font-display text-3xl font-bold tracking-tight mb-8">
            {mode === "signin" ? "Back to the edit suite." : "Spin up your studio."}
          </h2>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="label-mono">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="label-mono">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-card"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>No account yet?{" "}
                <button onClick={() => setMode("signup")} className="text-foreground underline underline-offset-4">
                  Create one
                </button>
              </>
            ) : (
              <>Already have one?{" "}
                <button onClick={() => setMode("signin")} className="text-foreground underline underline-offset-4">
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}