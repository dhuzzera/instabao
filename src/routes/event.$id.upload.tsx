import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadEventFile } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Camera, CheckCircle2, Upload } from "lucide-react";
import logoAsset from "@/assets/logo-osbao.png.asset.json";

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
  const [guest, setGuest] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("events").select("name").eq("id", id).single()
      .then(({ data }) => { if (data) setEventName(data.name); });
  }, [id]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Tire ou escolha uma foto"); return; }
    setSending(true);
    try {
      const url = await uploadEventFile(id, file, "photo");
      const { error } = await supabase.from("photos").insert({
        event_id: id, image_url: url, guest_name: guest.trim() || null,
      });
      if (error) throw error;
      setSent(true);
      setFile(null); setGuest("");
      setTimeout(() => setSent(false), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 paper-noise text-center">
        <Toaster richColors position="top-center" />
        <div className="grid h-24 w-24 place-items-center rounded-full bg-foreground text-background mb-6 animate-fade-up">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <h1 className="text-4xl font-display text-foreground animate-fade-up">Foi pro telão!</h1>
        <p className="mt-2 text-muted-foreground animate-fade-up">Sua foto está rodando no telão agora.</p>
        <Button className="mt-8" onClick={() => setSent(false)}>Enviar outra foto</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen paper-noise pb-12">
      <Toaster richColors position="top-center" />
      <div className="h-4 bunting" />
      <header className="px-5 py-6 max-w-md mx-auto text-center flex flex-col items-center">
        <img src={logoAsset.url} alt="Os Bão" className="h-20 w-20 rounded-2xl mb-2" />
        <p className="text-xs uppercase tracking-widest text-foreground font-bold">InstaBão</p>
        <h1 className="text-3xl font-display text-foreground mt-1">{eventName || "Evento"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Mande uma foto pro telão</p>
      </header>

      <main className="px-5 max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="p-4">
            <input
              ref={inputRef} type="file" accept="image/*" capture="environment"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className="relative rounded-2xl overflow-hidden bg-muted">
                <img src={preview} alt="prévia" className="w-full h-auto max-h-[70vh] object-contain mx-auto" />
              </div>
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()}
                className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-foreground/40 bg-muted flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform">
                <Camera className="h-16 w-16 text-foreground" />
                <span className="font-display text-2xl text-foreground">Tirar foto</span>
                <span className="text-xs text-muted-foreground">ou escolher da galeria</span>
              </button>
            )}
            {preview && (
              <Button type="button" variant="ghost" size="sm" className="w-full mt-2"
                onClick={() => inputRef.current?.click()}>
                Trocar foto
              </Button>
            )}
          </Card>

          <div>
            <Label htmlFor="guest">Seu nome (opcional)</Label>
            <Input id="guest" value={guest} onChange={e => setGuest(e.target.value)} placeholder="Ex: Maria" maxLength={40} />
          </div>

          <Button type="submit" size="lg" className="w-full text-lg" disabled={sending || !file}>
            <Upload className="h-5 w-5 mr-2" />
            {sending ? "Enviando…" : "Enviar pro telão"}
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-2">
            <Link to="/" className="underline">← Voltar</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
