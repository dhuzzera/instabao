import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import logoAsset from "@/assets/logo-osbao.png.asset.json";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Entrar · InstaBão" }] }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo de 8 caracteres").max(128),
});

function AuthPage() {
  const router = useRouter();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.navigate({ to: redirect ?? "/", replace: true });
    });
  }, [router, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "forgot") {
      const parsed = z.string().trim().email("Email inválido").max(255).safeParse(email);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
        return;
      }
      setBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Link de recuperação enviado! Verifique seu email.");
        setMode("login");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setBusy(false);
      }
      return;
    }

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        toast.success("Bem-vindo!");
      } else {
        const { error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada!");
      }
      router.navigate({ to: redirect ?? "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 paper-noise">
      <Toaster richColors position="top-center" />
      <Card className="w-full max-w-md p-8 rounded-3xl shadow-xl shadow-pink-100/60 border border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="story-ring-square shrink-0">
            <img src={logoAsset.url} alt="Os Bão" className="h-12 w-12 rounded-2xl bg-white block" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-brand-gradient">InstaBão</h1>
            <p className="text-xs text-muted-foreground font-medium">Acesso de moderadores</p>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-1">{mode === "login" ? "Entrar" : "Criar conta"}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login"
            ? "Use seu email e senha de moderador."
            : "O primeiro usuário cadastrado vira admin automaticamente."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Email</Label>
            <Input id="email" type="email" required autoComplete="email" maxLength={255}
              value={email} onChange={e => setEmail(e.target.value)}
              className="mt-2 rounded-xl bg-muted/60 border-border" />
          </div>
          <div>
            <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Senha</Label>
            <Input id="password" type="password" required minLength={8} maxLength={128}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password} onChange={e => setPassword(e.target.value)}
              className="mt-2 rounded-xl bg-muted/60 border-border" />
          </div>
          <Button type="submit" disabled={busy}
            className="w-full rounded-xl bg-brand-gradient text-white font-bold py-6 shadow-lg shadow-orange-200/80 border-0">
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(m => (m === "login" ? "signup" : "login"))}
          className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "login" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
      </Card>
    </div>
  );
}
