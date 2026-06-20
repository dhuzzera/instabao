import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClientId } from "@/lib/client-id";
import { ArrowLeft, Download, Share2, ChevronLeft, ChevronRight, X, Heart, CheckCircle2, Circle, Search } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import logoAsset from "@/assets/logo-osbao.png.asset.json";
import { EventThemeScene } from "@/components/EventTheme";

export const Route = createFileRoute("/event/$id/afterfest")({
  head: () => ({ meta: [{ title: "AfterFest · InstaBão" }] }),
  component: AfterFestRoute,
});

function AfterFestRoute() {
  const { id } = Route.useParams();
  return <AfterFestPage eventId={id} />;
}

type Photo = { id: string; image_url: string; guest_name: string | null; created_at: string };
type EventRow = { id: string; name: string; event_date: string | null; status: string; theme: string };
type LikeRow = { photo_id: string };

export function AfterFestPage({ eventId: id }: { eventId: string }) {

  const [ev, setEv] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [query, setQuery] = useState("");
  const clientId = useMemo(() => getClientId(), []);

  const filteredPhotos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return photos;
    return photos.filter(p => (p.guest_name ?? "").toLowerCase().includes(q));
  }, [photos, query]);

  function formatDateTime(iso: string) {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  }

  function toggleSelect(photoId: string) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(photoId)) n.delete(photoId); else n.add(photoId);
      return n;
    });
  }

  async function downloadSelected() {
    const toDownload = photos.filter(p => selected.has(p.id));
    if (toDownload.length === 0 || downloading) return;
    setDownloading(true);
    const tId = toast.loading(`Preparando ${toDownload.length} fotos...`);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let done = 0;
      const { watermarkFromUrl } = await import("@/lib/watermark");
      await Promise.all(toDownload.map(async (p, i) => {
        try {
          const blob = await watermarkFromUrl(p.image_url, { eventName: ev?.name });
          const namePart = p.guest_name ? p.guest_name.replace(/[^a-z0-9]+/gi, "_").slice(0, 30) : "foto";
          zip.file(`${String(i + 1).padStart(3, "0")}_${namePart}.jpg`, blob);
        } catch {}
        done++;
        toast.loading(`Baixando ${done}/${toDownload.length}...`, { id: tId });
      }));
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url; a.download = `fotos-${ev?.name?.replace(/[^a-z0-9]+/gi, "_") ?? "evento"}.zip`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Download pronto!", { id: tId });
      setSelectMode(false);
      setSelected(new Set());
    } catch (e: any) {
      toast.error("Erro ao baixar", { id: tId, description: e?.message });
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: ph }] = await Promise.all([
        supabase.from("events").select("*").eq("id", id).single(),
        supabase.from("photos").select("id,event_id,image_url,storage_path,guest_name,created_at").eq("event_id", id).order("created_at", { ascending: false }),
      ]);
      if (e) setEv(e as EventRow);
      const photosList = (ph ?? []) as Photo[];
      setPhotos(photosList);

      if (photosList.length > 0) {
        const ids = photosList.map(p => p.id);
        const [{ data: likes }, { data: mineIds }] = await Promise.all([
          supabase.from("photo_likes").select("photo_id").in("photo_id", ids),
          supabase.rpc("my_liked_photo_ids", { _event_id: id, _client_id: clientId }),
        ]);
        const counts: Record<string, number> = {};
        for (const l of (likes ?? []) as { photo_id: string }[]) {
          counts[l.photo_id] = (counts[l.photo_id] ?? 0) + 1;
        }
        setLikeCounts(counts);
        setMyLikes(new Set(((mineIds ?? []) as string[])));
      }
    })();
  }, [id, clientId]);

  // Realtime new likes
  useEffect(() => {
    const ch = supabase.channel(`afterfest-likes-${id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "photo_likes" },
        async (payload) => {
          const row = (payload.new ?? payload.old) as LikeRow | undefined;
          if (!row) return;
          // Only react to photos in this event
          if (!photos.some(p => p.id === row.photo_id)) return;
          setLikeCounts(prev => {
            const delta = payload.eventType === "INSERT" ? 1 : -1;
            return { ...prev, [row.photo_id]: Math.max(0, (prev[row.photo_id] ?? 0) + delta) };
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, photos]);

  async function toggleLike(photoId: string) {
    const liked = myLikes.has(photoId);
    // Optimistic
    setMyLikes(prev => {
      const n = new Set(prev);
      if (liked) n.delete(photoId); else n.add(photoId);
      return n;
    });
    setLikeCounts(prev => ({ ...prev, [photoId]: Math.max(0, (prev[photoId] ?? 0) + (liked ? -1 : 1)) }));
    try {
      if (liked) {
        await supabase.rpc("delete_my_like", { _photo_id: photoId, _client_id: clientId });
      } else {
        await supabase.from("photo_likes").insert({ photo_id: photoId, client_id: clientId });
      }
    } catch {
      // Revert on error
      setMyLikes(prev => {
        const n = new Set(prev);
        if (liked) n.add(photoId); else n.delete(photoId);
        return n;
      });
    }
  }

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => {
    setLightboxIdx(i => (i === null ? null : (i - 1 + filteredPhotos.length) % filteredPhotos.length));
  }, [filteredPhotos.length]);
  const next = useCallback(() => {
    setLightboxIdx(i => (i === null ? null : (i + 1) % filteredPhotos.length));
  }, [filteredPhotos.length]);

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

  const lightbox = lightboxIdx !== null ? filteredPhotos[lightboxIdx] : null;

  async function share(p: Photo) {
    const url = p.image_url;
    const shareData = {
      title: ev?.name ?? "InstaBão",
      text: `Foto do ${ev?.name ?? "evento"} no InstaBão`,
      url,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(url); toast.success("Link copiado!"); }
    } catch { /* user cancelled */ }
  }

  return (
    <EventThemeScene theme={ev?.theme} className="min-h-screen relative pb-20">
      <Toaster richColors position="top-center" />
      <header className="max-w-6xl mx-auto px-6 pt-8">
        <Link to="/event/$id/upload" params={{ id }} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Enviar foto
        </Link>
        <div className="flex items-center gap-4 mt-4">
          <div className="story-ring-square shrink-0">
            <img src={logoAsset.url} alt="InstaBão" className="h-16 w-16 rounded-2xl bg-white block" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-brand-gradient">AfterFest</p>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground truncate mt-1">
              {ev?.name ?? "…"}
            </h1>
            {ev?.event_date && <p className="text-sm text-muted-foreground">{ev.event_date}</p>}
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-muted-foreground">
            {photos.length} {photos.length === 1 ? "memória" : "memórias"} da galera. Curta, baixe e compartilhe.
          </p>
          {photos.length > 0 && (
            <div className="flex items-center gap-2">
              {selectMode ? (
                <>
                  <button
                    onClick={() => { setSelectMode(false); setSelected(new Set()); }}
                    className="text-sm px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setSelected(new Set(filteredPhotos.map(p => p.id)))}
                    className="text-sm px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-foreground"
                  >
                    Todas
                  </button>
                  <button
                    onClick={downloadSelected}
                    disabled={selected.size === 0 || downloading}
                    className="text-sm inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-foreground text-background font-semibold disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {downloading ? "Baixando..." : `Baixar ${selected.size > 0 ? `(${selected.size})` : ""}`}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectMode(true)}
                  className="text-sm inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-foreground"
                >
                  <Download className="h-4 w-4" /> Selecionar para baixar
                </button>
              )}
            </div>
          )}
        </div>
        {photos.length > 0 && (
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full sm:max-w-sm pl-9 pr-3 py-2 rounded-full bg-white/10 text-foreground placeholder:text-muted-foreground text-sm border border-white/10 focus:outline-none focus:border-foreground/30"
            />
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-10">
        {photos.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Nenhuma foto registrada neste evento.
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Nenhuma foto encontrada para "{query}".
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredPhotos.map((p, i) => {
              const count = likeCounts[p.id] ?? 0;
              const liked = myLikes.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`group relative aspect-square bg-muted rounded-xl overflow-hidden border-2 transition ${
                    selectMode && selected.has(p.id)
                      ? "border-foreground ring-4 ring-foreground/30"
                      : "border-foreground/10 hover:border-foreground"
                  }`}
                  style={{ animationDelay: `${Math.min(i, 20) * 40}ms`, animationFillMode: "forwards" }}
                >
                  <button
                    onClick={() => selectMode ? toggleSelect(p.id) : setLightboxIdx(i)}
                    className="absolute inset-0 w-full h-full"
                    aria-label={selectMode ? "Selecionar foto" : "Abrir foto"}
                  >
                    <img
                      src={p.image_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  </button>
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white p-2 text-left pr-12">
                    {p.guest_name && (
                      <div className="font-display text-base leading-tight truncate">{p.guest_name}</div>
                    )}
                    <div className="text-[10px] text-white/70 mt-0.5">{formatDateTime(p.created_at)}</div>
                  </div>
                  <button
                    onClick={() => toggleLike(p.id)}
                    className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur transition active:scale-90 ${
                      liked ? "bg-rose-500 text-white" : "bg-white/85 text-foreground hover:bg-white"
                    }`}
                    aria-label={liked ? "Descurtir" : "Curtir"}
                  >
                    <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
                    {count > 0 && <span>{count}</span>}
                  </button>
                  {selectMode && (
                    <div className="pointer-events-none absolute top-2 left-2">
                      {selected.has(p.id) ? (
                        <CheckCircle2 className="h-7 w-7 text-foreground fill-background" />
                      ) : (
                        <Circle className="h-7 w-7 text-white drop-shadow" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
          <div className="relative max-w-5xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img src={lightbox.image_url} alt="" className="max-w-full max-h-[75vh] w-auto h-auto object-contain" />
            {lightbox.guest_name && (
              <p className="text-center text-white font-display text-3xl mt-4">{lightbox.guest_name}</p>
            )}
            <p className="text-center text-white/50 text-xs mt-1">{formatDateTime(lightbox.created_at)}</p>
            <div className="flex justify-center gap-3 mt-4 flex-wrap">
              <button
                onClick={() => toggleLike(lightbox.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium transition ${
                  myLikes.has(lightbox.id) ? "bg-rose-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <Heart className={`h-4 w-4 ${myLikes.has(lightbox.id) ? "fill-current" : ""}`} />
                {likeCounts[lightbox.id] ?? 0}
              </button>
              <button
                onClick={async () => {
                  const tId = toast.loading("Preparando foto...");
                  try {
                    const { watermarkFromUrl } = await import("@/lib/watermark");
                    const blob = await watermarkFromUrl(lightbox.image_url, { eventName: ev?.name });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    const namePart = lightbox.guest_name ? lightbox.guest_name.replace(/[^a-z0-9]+/gi, "_").slice(0, 30) : "foto";
                    a.href = url; a.download = `${namePart}.jpg`; a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Baixado!", { id: tId });
                  } catch (e: any) {
                    toast.error("Erro ao baixar", { id: tId, description: e?.message });
                  }
                }}
                className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full font-medium hover:bg-white/90"
              >
                <Download className="h-4 w-4" /> Baixar
              </button>
              <button
                onClick={() => share(lightbox)}
                className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full hover:bg-white/20"
              >
                <Share2 className="h-4 w-4" /> Compartilhar
              </button>
            </div>
            {filteredPhotos.length > 1 && lightboxIdx !== null && (
              <p className="text-center text-white/40 text-xs mt-3">
                {lightboxIdx + 1} / {filteredPhotos.length}
              </p>
            )}
          </div>
        </div>
      )}
    </EventThemeScene>
  );
}
