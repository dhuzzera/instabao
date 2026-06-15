import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Calendar, Camera, Tv, Plus, Sparkles } from "lucide-react";

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

  return (
    <div className="min-h-screen paper-noise">
      <Toaster richColors position="top-center" />
      <div className="h-6 bunting" />

      <header className="px-6 pt-10 pb-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-4xl md:text-5xl font-display text-secondary">InstaBão</h1>
            <p className="text-sm text-muted-foreground">Telão ao vivo · QR Code · sem app, só festa 🔥</p>
          </div>
        </div>
      </header>

      <main className="px-6 pb-20 max-w-5xl mx-auto grid gap-8 md:grid-cols-[1fr_360px]">
        <section>
          <h2 className="text-2xl font-display mb-4 text-secondary">Seus eventos</h2>
          {loading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : events.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-muted-foreground">Nenhum evento ainda. Crie o primeiro arraiá! 🌽</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {events.map(ev => (
                <Card key={ev.id} className="p-5 hover:shadow-lg transition-shadow">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xl font-display text-secondary truncate">{ev.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        {ev.event_date ?? "sem data"} ·
                        <span className={ev.status === "active" ? "text-primary font-bold" : ""}>{ev.status}</span>
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button asChild variant="secondary" size="sm">
                        <Link to="/event/$id/upload" params={{ id: ev.id }}>
                          <Camera className="h-4 w-4 mr-1" /> Upload
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link to="/event/$id/tv" params={{ id: ev.id }}>
                          <Tv className="h-4 w-4 mr-1" /> Telão
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
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
          <Card className="p-6 sticky top-6 border-2 border-primary/30">
            <h2 className="text-xl font-display text-secondary mb-1 flex items-center gap-2">
              <Plus className="h-5 w-5" /> Novo evento
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Cada evento gera um álbum e um QR Code próprio.</p>
            <form onSubmit={createEvent} className="space-y-3">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Arraiá 2026" required />
              </div>
              <div>
                <Label htmlFor="date">Data</Label>
                <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Criando…" : "Criar evento 🎉"}
              </Button>
            </form>
          </Card>
        </aside>
      </main>
    </div>
  );
}
