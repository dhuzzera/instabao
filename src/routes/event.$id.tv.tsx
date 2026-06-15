import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/event/$id/tv")({
  head: () => ({ meta: [{ title: "Telão · InstaBão" }] }),
  component: TVPage,
});

type Photo = { id: string; image_url: string; guest_name: string | null; created_at: string };
type Sponsor = { id: string; image_url: string };

const PHOTO_MS = 5000;
const SPONSOR_MS = 7000;
const PHOTOS_PER_BLOCK = 5;

function TVPage() {
  const { id } = Route.useParams();
  const [eventName, setEventName] = useState("");
  const [status, setStatus] = useState<string>("active");
  const photosRef = useRef<Photo[]>([]);
  const sponsorsRef = useRef<Sponsor[]>([]);
  const [, force] = useState(0);
  const [current, setCurrent] = useState<{ kind: "photo"; photo: Photo } | { kind: "sponsor"; sponsor: Sponsor } | null>(null);
  const idxRef = useRef({ photoIdx: 0, blockCount: 0, sponsorIdx: 0 });

  // Fetch initial data
  useEffect(() => {
    (async () => {
      const { data: ev } = await supabase.from("events").select("name,status").eq("id", id).single();
      if (ev) { setEventName(ev.name); setStatus(ev.status); }
      const { data: ph } = await supabase
        .from("photos").select("*").eq("event_id", id).order("created_at", { ascending: false }).limit(500);
      photosRef.current = (ph ?? []) as Photo[];
      const { data: sp } = await supabase
        .from("sponsors").select("*").eq("event_id", id).order("position");
      sponsorsRef.current = (sp ?? []) as Sponsor[];
      force(x => x + 1);
    })();
  }, [id]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`tv-${id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "photos", filter: `event_id=eq.${id}` },
        (payload) => {
          photosRef.current = [payload.new as Photo, ...photosRef.current];
          force(x => x + 1);
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "sponsors", filter: `event_id=eq.${id}` },
        async () => {
          const { data } = await supabase.from("sponsors").select("*").eq("event_id", id).order("position");
          sponsorsRef.current = (data ?? []) as Sponsor[];
          force(x => x + 1);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  // Loop scheduler — uses refs so live updates don't reset the loop.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function next() {
      if (cancelled) return;
      const photos = photosRef.current;
      const sponsors = sponsorsRef.current;
      const state = idxRef.current;

      // Decide if we should show sponsor block (after PHOTOS_PER_BLOCK photos)
      if (state.blockCount >= PHOTOS_PER_BLOCK && sponsors.length > 0) {
        const sp = sponsors[state.sponsorIdx % sponsors.length];
        state.sponsorIdx = (state.sponsorIdx + 1) % Math.max(sponsors.length, 1);
        state.blockCount = 0;
        setCurrent({ kind: "sponsor", sponsor: sp });
        timer = setTimeout(next, SPONSOR_MS);
        return;
      }
      // Otherwise show photo
      if (photos.length === 0) {
        // Wait for photos
        setCurrent(null);
        timer = setTimeout(next, 2000);
        return;
      }
      const ph = photos[state.photoIdx % photos.length];
      state.photoIdx = (state.photoIdx + 1) % Math.max(photos.length, 1);
      state.blockCount += 1;
      setCurrent({ kind: "photo", photo: ph });
      timer = setTimeout(next, PHOTO_MS);
    }

    next();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  // Fullscreen helper
  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none" onClick={goFullscreen}>
      {/* Slide */}
      <div className="absolute inset-0">
        {current?.kind === "photo" && (
          <Slide key={current.photo.id}>
            <img src={current.photo.image_url} alt=""
              className="w-full h-full object-contain bg-black" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/30" />
            {current.photo.guest_name && (
              <div className="absolute bottom-16 left-0 right-0 text-center px-12">
                <p className="font-display text-5xl md:text-7xl drop-shadow-2xl text-white">
                  {current.photo.guest_name}
                </p>
              </div>
            )}
          </Slide>
        )}
        {current?.kind === "sponsor" && (
          <Slide key={current.sponsor.id}>
            <div className="w-full h-full grid place-items-center bg-white text-black p-16">
              <img src={current.sponsor.image_url} alt="patrocinador"
                className="max-w-[80%] max-h-[70%] object-contain" />
              <p className="absolute bottom-16 font-display text-3xl md:text-5xl text-black">
                Quem faz a festa acontecer
              </p>
            </div>
          </Slide>
        )}
        {!current && (
          <div className="w-full h-full grid place-items-center bg-black text-white text-center px-8">
            <div>
              <p className="font-display text-6xl md:text-8xl mb-4">InstaBão</p>
              <p className="text-2xl md:text-3xl opacity-90">Esperando as primeiras fotos…</p>
            </div>
          </div>
        )}
      </div>

      {/* Bunting top */}
      <div className="absolute top-0 left-0 right-0 h-6 bunting pointer-events-none" />

      {/* Event badge */}
      {eventName && (
        <div className="absolute top-8 left-8 bg-black/40 backdrop-blur px-5 py-2 rounded-full">
          <p className="font-display text-2xl">{eventName}</p>
        </div>
      )}
      <div className="absolute bottom-4 right-6 text-xs opacity-60">InstaBão · ao vivo</div>
    </div>
  );
}

function Slide({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div
      className="absolute inset-0 transition-opacity duration-500"
      style={{ opacity: mounted ? 1 : 0 }}
    >
      {children}
    </div>
  );
}
