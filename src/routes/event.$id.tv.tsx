import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Maximize, Minimize } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeOverlay, PhotoFrame } from "@/components/EventTheme";
import { getTheme } from "@/lib/themes";

export const Route = createFileRoute("/event/$id/tv")({
  head: () => ({ meta: [{ title: "Telão · InstaBão" }] }),
  component: TVPage,
});

type Photo = { id: string; image_url: string; guest_name: string | null; created_at: string };
type Sponsor = { id: string; image_url: string };

const FADE_MS = 700;

type Slide =
  | { kind: "photo"; photo: Photo }
  | { kind: "sponsor"; sponsor: Sponsor };

function TVPage() {
  const { id } = Route.useParams();
  const [eventName, setEventName] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [theme, setTheme] = useState<string>("default");
  const timingRef = useRef({ photoMs: 5000, sponsorMs: 7000, perBlock: 5 });
  const [uploadUrl, setUploadUrl] = useState("");
  const photosRef = useRef<Photo[]>([]);
  const sponsorsRef = useRef<Sponsor[]>([]);
  const [, force] = useState(0);
  // Two-layer crossfade: keep two slides mounted and swap which one is visible.
  const [slideA, setSlideA] = useState<Slide | null>(null);
  const [slideB, setSlideB] = useState<Slide | null>(null);
  const [showA, setShowA] = useState(true);
  const idxRef = useRef({ photoIdx: 0, blockCount: 0, sponsorIdx: 0 });
  const freshQueueRef = useRef<Photo[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUploadUrl(`${window.location.origin}/event/${id}/upload`);
    }
  }, [id]);

  useEffect(() => {
    (async () => {
      const { data: ev } = await supabase.from("events").select("name,status,theme,photo_seconds,sponsor_seconds,photos_per_block").eq("id", id).single();
      if (ev) {
        setEventName(ev.name); setStatus(ev.status); setTheme(ev.theme ?? "default");
        timingRef.current = {
          photoMs: (ev.photo_seconds ?? 5) * 1000,
          sponsorMs: (ev.sponsor_seconds ?? 7) * 1000,
          perBlock: ev.photos_per_block ?? 5,
        };
      }
      const { data: ph } = await supabase
        .from("photos").select("*").eq("event_id", id).order("created_at", { ascending: false }).limit(500);
      const initial = (ph ?? []) as Photo[];
      photosRef.current = initial;
      seenIdsRef.current = new Set(initial.map(p => p.id));
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
          const newPhoto = payload.new as Photo;
          if (seenIdsRef.current.has(newPhoto.id)) return;
          seenIdsRef.current.add(newPhoto.id);
          // Append to end so the current playback index stays valid (no restart).
          photosRef.current = [...photosRef.current, newPhoto];
          // Queue it to be shown ASAP without aborting the current slide.
          freshQueueRef.current.push(newPhoto);
          force(x => x + 1);
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "sponsors", filter: `event_id=eq.${id}` },
        async () => {
          const { data } = await supabase.from("sponsors").select("*").eq("event_id", id).order("position");
          sponsorsRef.current = (data ?? []) as Sponsor[];
          force(x => x + 1);
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as { status?: string; theme?: string; photo_seconds?: number; sponsor_seconds?: number; photos_per_block?: number };
          if (row.status) setStatus(row.status);
          if (row.theme) setTheme(row.theme);
          timingRef.current = {
            photoMs: (row.photo_seconds ?? 5) * 1000,
            sponsorMs: (row.sponsor_seconds ?? 7) * 1000,
            perBlock: row.photos_per_block ?? 5,
          };
        })
      .subscribe();

    // Safety nets in case realtime drops: refetch event settings periodically
    // and whenever the tab regains focus. Keeps theme/timing/status in sync
    // even if the websocket is stale.
    async function refetchEvent() {
      const { data: ev } = await supabase
        .from("events")
        .select("status,theme,photo_seconds,sponsor_seconds,photos_per_block")
        .eq("id", id)
        .single();
      if (!ev) return;
      setStatus(ev.status);
      setTheme(ev.theme ?? "default");
      timingRef.current = {
        photoMs: (ev.photo_seconds ?? 5) * 1000,
        sponsorMs: (ev.sponsor_seconds ?? 7) * 1000,
        perBlock: ev.photos_per_block ?? 5,
      };
    }
    const poll = setInterval(refetchEvent, 20000);
    const onVis = () => { if (document.visibilityState === "visible") refetchEvent(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
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
      const { photoMs, sponsorMs, perBlock } = timingRef.current;

      // Brand-new uploads jump the queue so guests see their photo right away.
      if (freshQueueRef.current.length > 0) {
        const ph = freshQueueRef.current.shift()!;
        state.blockCount += 1;
        return { slide: { kind: "photo", photo: ph }, ms: photoMs };
      }

      if (status === "active" && state.blockCount >= perBlock && sponsors.length > 0) {
        const sp = sponsors[state.sponsorIdx % sponsors.length];
        state.sponsorIdx = (state.sponsorIdx + 1) % Math.max(sponsors.length, 1);
        state.blockCount = 0;
        return { slide: { kind: "sponsor", sponsor: sp }, ms: sponsorMs };
      }
      if (photos.length === 0) return { slide: null, ms: 2000 };
      const ph = photos[state.photoIdx % photos.length];
      state.photoIdx = (state.photoIdx + 1) % Math.max(photos.length, 1);
      state.blockCount += 1;
      return { slide: { kind: "photo", photo: ph }, ms: photoMs };
    }

    function commit(slide: Slide, ms: number) {
      if (cancelled) return;
      if (useA) setSlideA(slide); else setSlideB(slide);
      setShowA(useA);
      useA = !useA;
      timer = setTimeout(next, ms);
    }

    function next() {
      if (cancelled) return;
      const { slide, ms } = pick();
      if (slide === null) {
        timer = setTimeout(next, ms);
        return;
      }
      // Preload image first so we never flash the previous photo while the
      // new one is still downloading (browser keeps last frame until decoded).
      const url = slide.kind === "photo" ? slide.photo.image_url : slide.sponsor.image_url;
      const img = new Image();
      let done = false;
      const finish = () => { if (done || cancelled) return; done = true; commit(slide, ms); };
      img.onload = finish;
      img.onerror = finish;
      img.src = url;
      if (img.complete) finish();
      // Safety: don't wait forever on a slow image.
      timer = setTimeout(finish, 4000);
    }

    next();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [status]);

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  const hasContent = photosRef.current.length > 0 || slideA || slideB;

  const t = getTheme(theme);

  return (
    <div
      className="fixed inset-0 text-white overflow-hidden select-none"
      style={{ background: t.backgroundDark }}
      onClick={goFullscreen}
    >
      <SlideLayer slide={slideA} visible={showA} theme={theme} />
      <SlideLayer slide={slideB} visible={!showA} theme={theme} />


      {/* Themed particles + top strip overlay (above photos, no clicks) */}
      <ThemeOverlay theme={theme} />

      {!hasContent && (
        <div className="absolute inset-0 grid place-items-center text-white text-center px-8 z-10">
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

function SlideLayer({ slide, visible, theme }: { slide: Slide | null; visible: boolean; theme?: string }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: visible && slide ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease-in-out`,
      }}
    >
      {slide?.kind === "photo" && (
        <PhotoFrame
          theme={theme}
          src={slide.photo.image_url}
          caption={slide.photo.guest_name}
        />
      )}
      {slide?.kind === "sponsor" && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white text-black p-16 gap-8">
          <img src={slide.sponsor.image_url} alt="patrocinador"
            className="max-w-[70%] max-h-[60vh] object-contain" />
          <p className="font-display text-3xl md:text-5xl text-black text-center">
            Quem faz a festa acontecer
          </p>
        </div>
      )}
    </div>
  );
}
