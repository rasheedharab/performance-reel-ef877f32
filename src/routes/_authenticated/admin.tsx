import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", u.user.id)
      .maybeSingle();
    if (data?.role !== "super_admin") throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});