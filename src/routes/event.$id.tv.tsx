import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { EventThemeScene } from "@/components/EventTheme";

export const Route = createFileRoute("/event/$id/tv")({
  head: () => ({ meta: [{ title: "Telão · InstaBão" }] }),
  component: TVPage,
});

type Photo = { id: string; image_url: string; guest_name: string | null; created_at: string };
type Sponsor = { id: string; image_url: string };

const PHOTO_MS = 5000;
const SPONSOR_MS = 7000;
const PHOTOS_PER_BLOCK = 5;
const FADE_MS = 700;

type Slide =
  | { kind: "photo"; photo: Photo }
  | { kind: "sponsor"; sponsor: Sponsor };

function TVPage() {
  const { id } = Route.useParams();
  const [eventName, setEventName] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [theme, setTheme] = useState<string>("default");
  const [uploadUrl, setUploadUrl] = useState("");
  const photosRef = useRef<Photo[]>([]);
  const sponsorsRef = useRef<Sponsor[]>([]);
  const [, force] = useState(0);
  // Two-layer crossfade: keep two slides mounted and swap which one is visible.
  const [slideA, setSlideA] = useState<Slide | null>(null);
  const [slideB, setSlideB] = useState<Slide | null>(null);
  const [showA, setShowA] = useState(true);
  const idxRef = useRef({ photoIdx: 0, blockCount: 0, sponsorIdx: 0 });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUploadUrl(`${window.location.origin}/event/${id}/upload`);
    }
  }, [id]);

  useEffect(() => {
    (async () => {
      const { data: ev } = await supabase.from("events").select("name,status,theme").eq("id", id).single();
      if (ev) { setEventName(ev.name); setStatus(ev.status); setTheme(ev.theme ?? "default"); }
      const { data: ph } = await supabase
        .from("photos").select("*").eq("event_id", id).order("created_at", { ascending: false }).limit(500);
      photosRef.current = (ph ?? []) as Photo[];
      const { data: sp } = await supabase
        .from("sponsors").select("*").eq("event_id", id).order("position");
      sponsorsRef.current = (sp ?? []) as Sponsor[];
      force(x => x + 1);
    })();
  }, [id]);

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

  // Loop scheduler with crossfade
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let useA = false; // we'll set the *other* layer then flip showA

    function pick(): { slide: Slide | null; ms: number } {
      const photos = photosRef.current;
      const sponsors = sponsorsRef.current;
      const state = idxRef.current;

      if (status === "active" && state.blockCount >= PHOTOS_PER_BLOCK && sponsors.length > 0) {
        const sp = sponsors[state.sponsorIdx % sponsors.length];
        state.sponsorIdx = (state.sponsorIdx + 1) % Math.max(sponsors.length, 1);
        state.blockCount = 0;
        return { slide: { kind: "sponsor", sponsor: sp }, ms: SPONSOR_MS };
      }
      if (photos.length === 0) return { slide: null, ms: 2000 };
      const ph = photos[state.photoIdx % photos.length];
      state.photoIdx = (state.photoIdx + 1) % Math.max(photos.length, 1);
      state.blockCount += 1;
      return { slide: { kind: "photo", photo: ph }, ms: PHOTO_MS };
    }

    function next() {
      if (cancelled) return;
      const { slide, ms } = pick();
      if (slide === null) {
        timer = setTimeout(next, ms);
        return;
      }
      // Load into hidden layer, then flip
      if (useA) setSlideA(slide); else setSlideB(slide);
      setShowA(useA);
      useA = !useA;
      timer = setTimeout(next, ms);
    }

    next();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [status]);

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  const hasContent = photosRef.current.length > 0 || slideA || slideB;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none" onClick={goFullscreen}>
      <SlideLayer slide={slideA} visible={showA} />
      <SlideLayer slide={slideB} visible={!showA} />

      {/* Themed particles + top strip overlay (above photos, no clicks) */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <EventThemeScene theme={theme} dark className="absolute inset-0 bg-transparent" >
          <div />
        </EventThemeScene>
      </div>

      {!hasContent && (
        <div className="absolute inset-0 grid place-items-center text-white text-center px-8 z-10">
          <EventThemeScene theme={theme} dark className="absolute inset-0">
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <p className="font-display text-6xl md:text-8xl mb-4">InstaBão</p>
                <p className="text-2xl md:text-3xl opacity-90 mb-8">Esperando as primeiras fotos…</p>
                {uploadUrl && (
                  <div className="inline-flex flex-col items-center gap-3 bg-white text-black p-6 rounded-3xl">
                    <QRCodeCanvas value={uploadUrl} size={220} level="M" includeMargin />
                    <p className="font-display text-2xl">Aponte a câmera</p>
                    <p className="text-xs uppercase tracking-widest opacity-70">manda sua foto</p>
                  </div>
                )}
              </div>
            </div>
          </EventThemeScene>
        </div>
      )}


      {eventName && (
        <div className="absolute top-8 left-8 bg-black/40 backdrop-blur px-5 py-2 rounded-full">
          <p className="font-display text-2xl">{eventName}</p>
        </div>
      )}

      {/* Persistent QR in corner once photos are flowing */}
      {hasContent && uploadUrl && (
        <div className="absolute top-8 right-8 bg-white text-black p-2 rounded-xl flex items-center gap-3 pr-4">
          <QRCodeCanvas value={uploadUrl} size={72} level="M" />
          <div className="text-left leading-tight">
            <p className="font-display text-xl">Manda a sua</p>
            <p className="text-[10px] uppercase tracking-widest opacity-70">aponte a câmera</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-6 text-xs opacity-60">
        InstaBão · {status === "finished" ? "memórias" : "ao vivo"}
      </div>
    </div>
  );
}

function SlideLayer({ slide, visible }: { slide: Slide | null; visible: boolean }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: visible && slide ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease-in-out`,
      }}
    >
      {slide?.kind === "photo" && (
        <>
          <img src={slide.photo.image_url} alt=""
            className="w-full h-full object-contain bg-black" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/30" />
          {slide.photo.guest_name && (
            <div className="absolute bottom-16 left-0 right-0 text-center px-12">
              <p className="font-display text-5xl md:text-7xl drop-shadow-2xl text-white">
                {slide.photo.guest_name}
              </p>
            </div>
          )}
        </>
      )}
      {slide?.kind === "sponsor" && (
        <div className="w-full h-full grid place-items-center bg-white text-black p-16 relative">
          <img src={slide.sponsor.image_url} alt="patrocinador"
            className="max-w-[80%] max-h-[70%] object-contain" />
          <p className="absolute bottom-16 font-display text-3xl md:text-5xl text-black">
            Quem faz a festa acontecer
          </p>
        </div>
      )}
    </div>
  );
}
