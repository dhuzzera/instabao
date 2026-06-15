import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Calendar, Camera, Tv, Plus, LogIn, Trash2 } from "lucide-react";
import logoAsset from "@/assets/logo-osbao.png.asset.json";
import { useAuthUser } from "@/lib/use-auth";
import { SignOutButton } from "@/components/SignOutButton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InstaBão — Telão de fotos ao vivo" },
      { name: "description", content: "Crie eventos, receba fotos dos convidados via QR Code e exiba no telão em tempo real." },
      { property: "og:title", content: "InstaBão" },
      { property: "og:description", content: "Telão de fotos ao vivo para festas e eventos." },
    ],
  }),
  component: Home,
});

function Home() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setEvents((data ?? []) as EventRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("events")
      .insert({ name: name.trim(), event_date: date || null, status: "active" })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Evento criado! 🎉");
    setName(""); setDate("");
    router.navigate({ to: "/event/$id/admin", params: { id: data.id } });
  }

  async function deleteEvent(id: string) {
    const { error } = await supabase.rpc("delete_event", { _event_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Evento excluído");
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div className="min-h-screen paper-noise">
      <Toaster richColors position="top-center" />

      <header className="px-6 pt-12 pb-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="story-ring-square shrink-0">
            <img src={logoAsset.url} alt="Os Bão" className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-white block" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-brand-gradient">InstaBão</h1>
            <p className="text-sm text-muted-foreground font-medium">Telão ao vivo · QR Code · sem app, só festa</p>
          </div>
          {!authLoading && (
            user ? (
              <SignOutButton variant="outline" />
            ) : (
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/auth"><LogIn className="h-4 w-4 mr-2" />Entrar</Link>
              </Button>
            )
          )}
        </div>
      </header>

      <main className="px-6 pb-20 max-w-5xl mx-auto grid gap-8 md:grid-cols-[1fr_380px]">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Seus eventos</h2>
            {!loading && events.length > 0 && (
              <span className="px-2 py-1 bg-muted rounded-md text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {events.length} {events.length === 1 ? "evento" : "eventos"}
              </span>
            )}
          </div>
          {loading ? (
            <Card className="p-4 bg-muted/40 border-dashed rounded-2xl flex items-center justify-center py-10">
              <p className="text-muted-foreground text-sm">Carregando seus eventos…</p>
            </Card>
          ) : events.length === 0 ? (
            <Card className="p-8 text-center border-dashed rounded-2xl">
              <p className="text-muted-foreground">Nenhum evento ainda. Bora criar o primeiro!</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {events.map(ev => (
                <Card key={ev.id} className="p-4 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-pink-100 to-orange-100 flex items-center justify-center shrink-0">
                        <Camera className="w-6 h-6 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-foreground truncate">{ev.name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {ev.event_date ?? "sem data"} ·
                          <span className={ev.status === "active" ? "text-emerald-600 font-semibold" : ""}>{ev.status}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button asChild variant="secondary" size="sm" className="rounded-full">
                        <Link to="/event/$id/upload" params={{ id: ev.id }}>
                          <Camera className="h-4 w-4 mr-1" /> Upload
                        </Link>
                      </Button>
                      <Button asChild size="sm" className="rounded-full">
                        <Link to="/event/$id/tv" params={{ id: ev.id }}>
                          <Tv className="h-4 w-4 mr-1" /> Telão
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="rounded-full">
                        <Link to="/event/$id/admin" params={{ id: ev.id }}>Gerenciar</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <aside>
          <Card className="p-7 sticky top-6 rounded-3xl shadow-xl shadow-pink-100/60 border border-border">
            <div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg shadow-orange-200 mb-4">
              <Plus className="h-6 w-6 text-white" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Novo evento</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              {user ? "Crie um álbum digital e receba fotos via QR Code." : "Faça login como moderador para criar eventos."}
            </p>
            {user ? (
              <form onSubmit={createEvent} className="space-y-5">
                <div>
                  <Label htmlFor="name" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Nome do evento</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Festa Os Bão 2026" required maxLength={120}
                    className="mt-2 rounded-xl bg-muted/60 border-border focus-visible:ring-pink-500/30" />
                </div>
                <div>
                  <Label htmlFor="date" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Data</Label>
                  <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="mt-2 rounded-xl bg-muted/60 border-border" />
                </div>
                <Button type="submit"
                  className="w-full rounded-xl bg-brand-gradient text-white font-bold py-6 shadow-lg shadow-orange-200/80 hover:scale-[1.02] active:scale-[0.98] transition-transform border-0"
                  disabled={creating}>
                  {creating ? "Criando…" : "Criar evento"}
                </Button>
              </form>
            ) : (
              <Button asChild className="w-full rounded-xl bg-brand-gradient text-white font-bold py-6 shadow-lg shadow-orange-200/80 border-0">
                <Link to="/auth"><LogIn className="h-4 w-4 mr-2" />Entrar como moderador</Link>
              </Button>
            )}
          </Card>
        </aside>
      </main>
    </div>
  );
}
