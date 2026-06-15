import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function SignOutButton({ variant = "ghost" as const }: { variant?: "ghost" | "outline" | "secondary" | "default" }) {
  const router = useRouter();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }
  return (
    <Button variant={variant} onClick={signOut} title="Sair">
      <LogOut className="h-4 w-4 mr-2" /> Sair
    </Button>
  );
}
