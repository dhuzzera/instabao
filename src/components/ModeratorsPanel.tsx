import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, UserPlus, X } from "lucide-react";

type Row = { user_id: string; email: string; role: "admin" | "moderator"; created_at: string };

export function ModeratorsPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_moderators");
    if (error) {
      if (/forbidden/i.test(error.message)) { setForbidden(true); setRows([]); return; }
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (forbidden) return null;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!v) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_moderator_by_email", { _email: v, _grant: true });
    setBusy(false);
    if (error) {
      if (/user_not_found/i.test(error.message)) toast.error("Esse email ainda não tem conta no app.");
      else if (/forbidden/i.test(error.message)) toast.error("Apenas admins podem promover moderadores.");
      else toast.error(error.message);
      return;
    }
    toast.success("Moderador promovido!");
    setEmail("");
    load();
  }

  async function revoke(target: string) {
    if (!confirm(`Remover papel de moderador de ${target}?`)) return;
    const { error } = await supabase.rpc("set_moderator_by_email", { _email: target, _grant: false });
    if (error) { toast.error(error.message); return; }
    toast.success("Removido");
    load();
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-xl text-foreground mb-1 flex items-center gap-2">
        <Shield className="h-5 w-5 text-pink-500" /> Moderadores
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        Convide pelo email de uma conta já cadastrada no InstaBão.
      </p>

      <form onSubmit={invite} className="flex gap-2 mb-4">
        <Input
          type="email"
          placeholder="email@exemplo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          maxLength={255}
          required
          className="rounded-xl bg-muted/60"
        />
        <Button type="submit" disabled={busy} className="rounded-xl shrink-0">
          <UserPlus className="h-4 w-4 mr-1" /> Promover
        </Button>
      </form>

      <ul className="space-y-2 text-sm">
        {rows === null ? (
          <li className="text-muted-foreground text-xs">Carregando…</li>
        ) : rows.length === 0 ? (
          <li className="text-muted-foreground text-xs">Nenhum moderador ainda.</li>
        ) : (
          rows.map(r => (
            <li key={r.user_id + r.role} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                r.role === "admin" ? "bg-pink-100 text-pink-700" : "bg-orange-100 text-orange-700"
              }`}>{r.role}</span>
              <span className="truncate flex-1">{r.email}</span>
              {r.role === "moderator" && (
                <button onClick={() => revoke(r.email)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  aria-label="Remover">
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
