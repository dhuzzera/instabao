import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { uploadEventFile } from "@/lib/upload";
import { compressImage } from "@/lib/compress";
import { rotateImage } from "@/lib/rotate";
import { getClientId } from "@/lib/client-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Camera, CheckCircle2, Upload, RotateCw, RotateCcw, X, Plus, Tv, Heart } from "lucide-react";
import logoAsset from "@/assets/logo-osbao.png.asset.json";
import { EventThemeScene } from "@/components/EventTheme";
import { UploadTutorial } from "@/components/UploadTutorial";


export const Route = createFileRoute("/event/$id/upload")({
  head: ({ params }) => ({
    meta: [
      { title: "Enviar foto · InstaBão" },
      { name: "description", content: `Envie sua foto para o telão do evento ${params.id}.` },
    ],
  }),
  component: UploadRoute,
});

function UploadRoute() {
  const { id } = Route.useParams();
  return <UploadPage eventId={id} />;
}

const MAX_FILES = 8;

type Item = { id: string; file: File; preview: string };

export function UploadPage({ eventId: id }: { eventId: string }) {

  const [eventName, setEventName] = useState("");
  const [eventStatus, setEventStatus] = useState<string>("active");
  const [theme, setTheme] = useState<string>("default");
  const [guest, setGuest] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [sent, setSent] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("events").select("name,status,theme").eq("id", id).single()
      .then(({ data }) => { if (data) { setEventName(data.name); setEventStatus(data.status); setTheme(data.theme ?? "default"); } });
  }, [id]);

  useEffect(() => {
    return () => { items.forEach(i => URL.revokeObjectURL(i.preview)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files).slice(0, MAX_FILES - items.length);
    if (files.length > MAX_FILES - items.length) {
      toast.warning(`Máximo de ${MAX_FILES} fotos por envio`);
    }
    const next = incoming.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setItems(prev => [...prev, ...next]);
  }

  function removeItem(itemId: string) {
    setItems(prev => {
      const it = prev.find(i => i.id === itemId);
      if (it) URL.revokeObjectURL(it.preview);
      return prev.filter(i => i.id !== itemId);
    });
  }

  async function rotateItem(itemId: string, deg: 90 | 180 | 270) {
    const it = items.find(i => i.id === itemId);
    if (!it) return;
    const rotated = await rotateImage(it.file, deg);
    URL.revokeObjectURL(it.preview);
    setItems(prev => prev.map(p => p.id === itemId ? { ...p, file: rotated, preview: URL.createObjectURL(rotated) } : p));
  }

  function celebrate() {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
      colors: ["#f43f5e", "#fbbf24", "#10b981", "#3b82f6", "#a855f7"],
    });
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.7 } }), 250);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { toast.error("Tire ou escolha uma foto"); return; }
    setSending(true);
    let okCount = 0;
    try {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        setProgress(items.length > 1 ? `Enviando ${i + 1}/${items.length}…` : "Enviando pro telão…");
        try {
          const optimized = await compressImage(it.file);
          const { url, path } = await uploadEventFile(id, optimized, "photo");
          const { error } = await supabase.from("photos").insert({
            event_id: id,
            image_url: url,
            storage_path: path,
            client_id: getClientId(),
            guest_name: guest.trim() || null,
          });
          if (error) throw error;
          okCount += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`Foto ${i + 1}: ${msg}`);
        }
      }
      if (okCount > 0) {
        celebrate();
        setSent(okCount);
        items.forEach(it => URL.revokeObjectURL(it.preview));
        setItems([]);
        setGuest("");
        setTimeout(() => setSent(0), 3500);
      }
    } finally {
      setSending(false);
      setProgress("");
    }
  }

  if (eventStatus === "finished") {
    return (
      <EventThemeScene theme={theme} className="min-h-screen relative flex flex-col items-center justify-center px-6 text-center">
        <img src={logoAsset.url} alt="InstaBão" className="h-20 w-20 rounded-2xl mb-4" />
        <h1 className="text-4xl font-display text-foreground">A festa acabou 🎉</h1>
        <p className="mt-2 text-muted-foreground max-w-sm">
          Este evento foi finalizado. Mas as memórias ficam — veja todas as fotos no AfterFest.
        </p>
        <Button asChild className="mt-8">
          <Link to="/event/$id/afterfest" params={{ id }}>Ver AfterFest</Link>
        </Button>
      </EventThemeScene>
    );
  }

  if (sent > 0) {
    return (
      <EventThemeScene theme={theme} className="min-h-screen relative flex flex-col items-center justify-center px-6 text-center">
        <Toaster richColors position="top-center" />
        <div className="grid h-24 w-24 place-items-center rounded-full bg-foreground text-background mb-6 animate-fade-up">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <h1 className="text-4xl font-display text-foreground animate-fade-up">
          {sent > 1 ? `${sent} fotos no telão!` : "Foi pro telão!"}
        </h1>
        <p className="mt-2 text-muted-foreground animate-fade-up">Já estão rodando agora.</p>
        <div className="flex flex-col sm:flex-row gap-3 mt-8 animate-fade-up">
          <Button onClick={() => setSent(0)}>Enviar mais fotos</Button>
          <Button asChild variant="outline">
            <Link to="/event/$id/afterfest" params={{ id }}>
              <Heart className="h-4 w-4 mr-2" /> Ver e curtir todas
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/event/$id/tv" params={{ id }} target="_blank">
              <Tv className="h-4 w-4 mr-2" /> Telão
            </Link>
          </Button>
        </div>
      </EventThemeScene>
    );
  }

  return (
    <EventThemeScene theme={theme} className="min-h-screen relative pb-12">
      <Toaster richColors position="top-center" />
      <UploadTutorial eventId={id} />
      <header className="px-5 py-8 max-w-md mx-auto text-center flex flex-col items-center">
        <div className="story-ring-square mb-3">
          <img src={logoAsset.url} alt="Os Bão" className="h-20 w-20 rounded-2xl bg-white block" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-brand-gradient">InstaBão</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1.5">{eventName || "Evento"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Mande até {MAX_FILES} fotos pro telão</p>
      </header>

      <main className="px-5 max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="p-4 rounded-3xl border border-border shadow-sm">
            <input
              ref={inputRef} type="file" accept="image/*" multiple
              className="hidden"
              onChange={e => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }}
            />
            {items.length === 0 ? (
              <button type="button" onClick={() => inputRef.current?.click()}
                className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-border bg-gradient-to-br from-pink-50/60 via-orange-50/60 to-amber-50/60 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-transform">
                <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg shadow-orange-200">
                  <Camera className="h-8 w-8 text-white" />
                </div>
                <span className="text-2xl font-extrabold tracking-tight text-foreground">Tirar fotos</span>
                <span className="text-xs text-muted-foreground">ou escolher da galeria (até {MAX_FILES})</span>
              </button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {items.map(it => (
                    <div key={it.id} className="relative rounded-xl overflow-hidden bg-muted aspect-square group">
                      <img src={it.preview} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeItem(it.id)} disabled={sending}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                        <button type="button" onClick={() => rotateItem(it.id, 270)} disabled={sending}
                          className="flex-1 bg-black/60 text-white rounded-md py-1 grid place-items-center">
                          <RotateCcw className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => rotateItem(it.id, 90)} disabled={sending}
                          className="flex-1 bg-black/60 text-white rounded-md py-1 grid place-items-center">
                          <RotateCw className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length < MAX_FILES && (
                    <button type="button" onClick={() => inputRef.current?.click()} disabled={sending}
                      className="aspect-square rounded-xl border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-1 text-muted-foreground active:scale-[0.98] transition-transform">
                      <Plus className="h-6 w-6" />
                      <span className="text-xs">Adicionar</span>
                    </button>
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground mt-3">
                  {items.length} de {MAX_FILES} foto{items.length > 1 ? "s" : ""}
                </p>
              </>
            )}
          </Card>

          <div>
            <Label htmlFor="guest" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Seu nome (opcional)</Label>
            <Input id="guest" value={guest} onChange={e => setGuest(e.target.value)} placeholder="Ex: Maria" maxLength={40}
              className="mt-2 rounded-xl bg-muted/60 border-border" />
          </div>

          <Button type="submit" size="lg"
            className="w-full text-base rounded-xl bg-brand-gradient text-white font-bold py-6 shadow-lg shadow-orange-200/80 hover:scale-[1.01] active:scale-[0.98] transition-transform border-0"
            disabled={sending || items.length === 0}>
            <Upload className="h-5 w-5 mr-2" />
            {sending ? (progress || "Enviando…") : items.length > 1 ? `Enviar ${items.length} fotos` : "Enviar pro telão"}
          </Button>

          <Link
            to="/event/$id/afterfest"
            params={{ id }}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground py-3"
          >
            <Heart className="h-4 w-4" /> Ver e curtir todas as fotos
          </Link>
        </form>
      </main>
    </EventThemeScene>
  );
}
