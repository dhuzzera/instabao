import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download } from "lucide-react";
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
  const [lightbox, setLightbox] = useState<Photo | null>(null);

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

  return (
    <div className="min-h-screen paper-noise pb-20">
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
          As memórias que vocês criaram. Reviva, baixe e compartilhe.
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-10">
        {photos.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Nenhuma foto registrada neste evento.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map(p => (
              <button
                key={p.id}
                onClick={() => setLightbox(p)}
                className="group relative aspect-square bg-muted rounded-xl overflow-hidden border-2 border-foreground/10 hover:border-foreground transition"
              >
                <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
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
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.image_url} alt="" className="w-full max-h-[85vh] object-contain" />
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
                onClick={() => setLightbox(null)}
                className="bg-white/10 text-white px-4 py-2 rounded-full hover:bg-white/20"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
