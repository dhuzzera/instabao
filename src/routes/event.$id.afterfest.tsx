import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download, Share2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import logoAsset from "@/assets/logo-osbao.png.asset.json";

export const Route = createFileRoute("/event/$id/afterfest")({
  head: () => ({ meta: [{ title: "AfterFest · InstaBão" }] }),
  component: AfterFestPage,
});

type Photo = { id: string; image_url: string; guest_name: string | null; created_at: string };
type EventRow = { id: string; name: string; event_date: string | null; status: string };

function AfterFestPage() {
  const { id } = Route.useParams();
  const [ev, setEv] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: ph }] = await Promise.all([
        supabase.from("events").select("*").eq("id", id).single(),
        supabase.from("photos").select("*").eq("event_id", id).order("created_at", { ascending: false }),
      ]);
      if (e) setEv(e as EventRow);
      setPhotos((ph ?? []) as Photo[]);
    })();
  }, [id]);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => {
    setLightboxIdx(i => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);
  const next = useCallback(() => {
    setLightboxIdx(i => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, close, prev, next]);

  const lightbox = lightboxIdx !== null ? photos[lightboxIdx] : null;

  async function share(p: Photo) {
    const url = p.image_url;
    const shareData = {
      title: ev?.name ?? "InstaBão",
      text: `Foto do ${ev?.name ?? "evento"} no InstaBão`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="min-h-screen paper-noise pb-20">
      <Toaster richColors position="top-center" />
      <div className="h-4 bunting" />
      <header className="max-w-6xl mx-auto px-6 pt-8">
        <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Eventos
        </Link>
        <div className="flex items-center gap-4 mt-4">
          <img src={logoAsset.url} alt="InstaBão" className="h-16 w-16 rounded-2xl" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AfterFest</p>
            <h1 className="text-4xl md:text-5xl font-display text-foreground truncate">
              {ev?.name ?? "…"}
            </h1>
            {ev?.event_date && <p className="text-sm text-muted-foreground">{ev.event_date}</p>}
          </div>
        </div>
        <p className="mt-6 text-muted-foreground max-w-2xl">
          {photos.length} {photos.length === 1 ? "memória" : "memórias"} da galera. Reviva, baixe e compartilhe.
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-10">
        {photos.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Nenhuma foto registrada neste evento.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setLightboxIdx(i)}
                className="group relative aspect-square bg-muted rounded-xl overflow-hidden border-2 border-foreground/10 hover:border-foreground transition"
              >
                <img
                  src={p.image_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                {p.guest_name && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs p-2 text-left font-display text-base">
                    {p.guest_name}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/95 z-50 grid place-items-center p-4"
          onClick={close}
        >
          <button
            onClick={(e) => { e.stopPropagation(); close(); }}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 md:left-6 text-white/70 hover:text-white p-3 rounded-full bg-white/5 hover:bg-white/15"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 md:right-6 text-white/70 hover:text-white p-3 rounded-full bg-white/5 hover:bg-white/15"
                aria-label="Próxima"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.image_url} alt="" className="w-full max-h-[80vh] object-contain" />
            {lightbox.guest_name && (
              <p className="text-center text-white font-display text-3xl mt-4">{lightbox.guest_name}</p>
            )}
            <div className="flex justify-center gap-3 mt-4">
              <a
                href={lightbox.image_url}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full font-medium hover:bg-white/90"
              >
                <Download className="h-4 w-4" /> Baixar
              </a>
              <button
                onClick={() => share(lightbox)}
                className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full hover:bg-white/20"
              >
                <Share2 className="h-4 w-4" /> Compartilhar
              </button>
            </div>
            {photos.length > 1 && lightboxIdx !== null && (
              <p className="text-center text-white/40 text-xs mt-3">
                {lightboxIdx + 1} / {photos.length}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
