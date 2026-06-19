import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import logoAsset from "@/assets/logo-osbao.png.asset.json";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha · InstaBão" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValid(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValid(true);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso!");
      router.navigate({ to: "/auth", replace: true });
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

        <h2 className="text-xl font-bold mb-1">Nova senha</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Digite sua nova senha abaixo.
        </p>

        {valid ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Nova senha</Label>
              <Input id="password" type="password" required minLength={8} maxLength={128}
                autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                className="mt-2 rounded-xl bg-muted/60 border-border" />
            </div>
            <div>
              <Label htmlFor="confirm" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Confirmar senha</Label>
              <Input id="confirm" type="password" required minLength={8} maxLength={128}
                autoComplete="new-password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="mt-2 rounded-xl bg-muted/60 border-border" />
            </div>
            <Button type="submit" disabled={busy}
              className="w-full rounded-xl bg-brand-gradient text-white font-bold py-6 shadow-lg shadow-orange-200/80 border-0">
              {busy ? "Aguarde…" : "Salvar nova senha"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este link de recuperação é inválido ou expirou. Solicite um novo link na tela de login.
          </p>
        )}

        <button
          type="button"
          onClick={() => router.navigate({ to: "/auth", replace: true })}
          className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Voltar para entrar
        </button>
      </Card>
    </div>
  );
}
