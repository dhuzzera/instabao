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
import { Camera, CheckCircle2, Upload, RotateCw, RotateCcw } from "lucide-react";
import logoAsset from "@/assets/logo-osbao.png.asset.json";
import { EventThemeScene } from "@/components/EventTheme";


export const Route = createFileRoute("/event/$id/upload")({
  head: ({ params }) => ({
    meta: [
      { title: "Enviar foto · InstaBão" },
      { name: "description", content: `Envie sua foto para o telão do evento ${params.id}.` },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const { id } = Route.useParams();
  const [eventName, setEventName] = useState("");
  const [eventStatus, setEventStatus] = useState<string>("active");
  const [theme, setTheme] = useState<string>("default");
  const [guest, setGuest] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("events").select("name,status,theme").eq("id", id).single()
      .then(({ data }) => { if (data) { setEventName(data.name); setEventStatus(data.status); setTheme(data.theme ?? "default"); } });
  }, [id]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
    if (!file) { toast.error("Tire ou escolha uma foto"); return; }
    setSending(true);
    try {
      setProgress("Otimizando foto…");
      const optimized = await compressImage(file);
      setProgress("Enviando pro telão…");
      const { url, path } = await uploadEventFile(id, optimized, "photo");
      const { error } = await supabase.from("photos").insert({
        event_id: id,
        image_url: url,
        storage_path: path,
        client_id: getClientId(),
        guest_name: guest.trim() || null,
      });
      if (error) throw error;
      celebrate();
      setSent(true);
      setFile(null); setGuest("");
      setTimeout(() => setSent(false), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
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

  if (sent) {
    return (
      <EventThemeScene theme={theme} className="min-h-screen relative flex flex-col items-center justify-center px-6 text-center">
        <Toaster richColors position="top-center" />
        <div className="grid h-24 w-24 place-items-center rounded-full bg-foreground text-background mb-6 animate-fade-up">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <h1 className="text-4xl font-display text-foreground animate-fade-up">Foi pro telão!</h1>
        <p className="mt-2 text-muted-foreground animate-fade-up">Sua foto está rodando no telão agora.</p>
        <Button className="mt-8" onClick={() => setSent(false)}>Enviar outra foto</Button>
      </EventThemeScene>
    );
  }

  return (
    <EventThemeScene theme={theme} className="min-h-screen relative pb-12">
      <Toaster richColors position="top-center" />
      <header className="px-5 py-8 max-w-md mx-auto text-center flex flex-col items-center">
        <div className="story-ring-square mb-3">
          <img src={logoAsset.url} alt="Os Bão" className="h-20 w-20 rounded-2xl bg-white block" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-brand-gradient">InstaBão</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1.5">{eventName || "Evento"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Mande uma foto pro telão</p>
      </header>

      <main className="px-5 max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="p-4 rounded-3xl border border-border shadow-sm">
            <input
              ref={inputRef} type="file" accept="image/*"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className="relative rounded-2xl overflow-hidden bg-muted">
                <img src={preview} alt="prévia" className="w-full h-auto max-h-[70vh] object-contain mx-auto" />
              </div>
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()}
                className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-border bg-gradient-to-br from-pink-50/60 via-orange-50/60 to-amber-50/60 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-transform">
                <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg shadow-orange-200">
                  <Camera className="h-8 w-8 text-white" />
                </div>
                <span className="text-2xl font-extrabold tracking-tight text-foreground">Tirar foto</span>
                <span className="text-xs text-muted-foreground">ou escolher da galeria</span>
              </button>
            )}
            {preview && (
              <div className="flex gap-2 mt-3">
                <Button type="button" variant="outline" size="sm" className="flex-1 rounded-full"
                  onClick={async () => { if (file) setFile(await rotateImage(file, 270)); }}
                  disabled={sending}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Girar
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1 rounded-full"
                  onClick={async () => { if (file) setFile(await rotateImage(file, 90)); }}
                  disabled={sending}>
                  <RotateCw className="h-4 w-4 mr-1" /> Girar
                </Button>
                <Button type="button" variant="ghost" size="sm" className="flex-1 rounded-full"
                  onClick={() => inputRef.current?.click()} disabled={sending}>
                  Trocar
                </Button>
              </div>
            )}

          </Card>

          <div>
            <Label htmlFor="guest" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Seu nome (opcional)</Label>
            <Input id="guest" value={guest} onChange={e => setGuest(e.target.value)} placeholder="Ex: Maria" maxLength={40}
              className="mt-2 rounded-xl bg-muted/60 border-border" />
          </div>

          <Button type="submit" size="lg"
            className="w-full text-base rounded-xl bg-brand-gradient text-white font-bold py-6 shadow-lg shadow-orange-200/80 hover:scale-[1.01] active:scale-[0.98] transition-transform border-0"
            disabled={sending || !file}>
            <Upload className="h-5 w-5 mr-2" />
            {sending ? (progress || "Enviando…") : "Enviar pro telão"}
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-2">
            <Link to="/" className="underline">← Voltar</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
