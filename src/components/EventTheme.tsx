import { useMemo, useState } from "react";
import { getTheme, type EventTheme, type ParticleKind, type TopStrip } from "@/lib/themes";

type Props = {
  theme?: string | null;
  dark?: boolean;
  children: React.ReactNode;
  className?: string;
};

// Wraps a page with themed backdrop + particles. Default theme = current look.
export function EventThemeScene({ theme, dark, children, className }: Props) {
  const t = getTheme(theme);
  const bg = dark ? t.backgroundDark : t.background;
  return (
    <div
      className={className ?? "min-h-screen relative"}
      style={{
        background: bg,
        ["--theme-accent" as string]: t.accent,
        ["--theme-gradient" as string]: t.gradient,
      }}
    >
      <TopStripView kind={t.topStrip} />
      <Particles kind={t.particles} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Transparent overlay: just strip + particles, no background.
// Use for layering on top of existing content (e.g. the TV slideshow).
export function ThemeOverlay({ theme }: { theme?: string | null }) {
  const t = getTheme(theme);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        ["--theme-accent" as string]: t.accent,
        ["--theme-gradient" as string]: t.gradient,
      }}
    >
      <TopStripView kind={t.topStrip} />
      <Particles kind={t.particles} />
    </div>
  );
}

function TopStripView({ kind }: { kind: TopStrip }) {
  if (kind === "none") return null;
  if (kind === "bandeirinhas") {
    return (
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-10 z-20 overflow-hidden">
        <svg
          className="w-full h-full"
          viewBox="0 0 800 40"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="6" x2="800" y2="6" stroke="#a16207" strokeWidth="1" />
          {Array.from({ length: 32 }).map((_, i) => {
            const x = (i * 800) / 32;
            const colors = ["#facc15", "#ef4444", "#22c55e", "#3b82f6", "#f97316", "#ec4899"];
            return (
              <polygon
                key={i}
                points={`${x},6 ${x + 12},6 ${x + 6},32`}
                fill={colors[i % colors.length]}
              />
            );
          })}
        </svg>
      </div>
    );
  }
  if (kind === "lights") {
    return (
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 z-20 flex justify-around items-start px-2">
        {Array.from({ length: 24 }).map((_, i) => {
          const colors = ["#ef4444", "#facc15", "#22c55e", "#3b82f6"];
          const c = colors[i % colors.length];
          return (
            <span
              key={i}
              className="block w-2 h-3 rounded-b-full animate-theme-twinkle"
              style={{
                backgroundColor: c,
                boxShadow: `0 0 10px ${c}, 0 0 18px ${c}`,
                animationDelay: `${(i % 6) * 0.25}s`,
              }}
            />
          );
        })}
      </div>
    );
  }
  if (kind === "garland") {
    return (
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-3 z-20"
        style={{ background: "var(--theme-gradient)" }}
      />
    );
  }
  return null;
}

function Particles({ kind }: { kind: ParticleKind }) {
  const items = useMemo(() => {
    if (kind === "none") return [];
    const n =
      kind === "snow" ? 50 :
      kind === "embers" ? 28 :
      kind === "bats" ? 14 :
      kind === "confetti" ? 40 :
      kind === "eggs" ? 18 :
      kind === "petals" ? 22 :
      kind === "fireworks" ? 14 : 0;
    return Array.from({ length: n }).map((_, i) => ({
      i,
      left: ((i * 53.7) % 100),
      delay: (i % 12) * 0.7,
      duration: 6 + ((i * 1.3) % 8),
      size: 10 + ((i * 7) % 18),
    }));
  }, [kind]);

  if (kind === "none") return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {items.map((p) => (
        <span
          key={p.i}
          className={particleClass(kind)}
          style={{
            left: `${p.left}%`,
            top: `-10%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            fontSize: `${p.size}px`,
          }}
        >
          {particleGlyph(kind, p.i)}
        </span>
      ))}
    </div>
  );
}

function particleClass(kind: ParticleKind) {
  switch (kind) {
    case "snow": return "absolute select-none text-white/90 animate-theme-fall";
    case "embers": return "absolute select-none animate-theme-rise";
    case "bats": return "absolute select-none text-black/80 dark:text-white/80 animate-theme-fly";
    case "confetti": return "absolute select-none animate-theme-fall";
    case "eggs": return "absolute select-none animate-theme-drift";
    case "petals": return "absolute select-none animate-theme-drift";
    case "fireworks": return "absolute select-none animate-theme-burst";
    default: return "";
  }
}

function particleGlyph(kind: ParticleKind, i: number) {
  switch (kind) {
    case "snow": return "❄";
    case "embers": return ["🔥", "✨", "🌟"][i % 3];
    case "bats": return "🦇";
    case "confetti": return ["🎉", "🎊", "✨", "🎈"][i % 4];
    case "eggs": return ["🥚", "🐰", "🌸"][i % 3];
    case "petals": return ["🌸", "🌷", "✨"][i % 3];
    case "fireworks": return ["🎆", "🎇", "✨"][i % 3];
    default: return null;
  }
}

export type { EventTheme };

// Decorative themed frame for photos on the TV slideshow.
// Adds a gradient ring + corner emoji decorations matching the theme.
const FRAME_CORNERS: Record<string, string[]> = {
  default: ["✨", "✨", "✨", "✨"],
  junina: ["🌽", "🔥", "🎶", "🌶️"],
  halloween: ["🎃", "👻", "🕷️", "🦇"],
  natal: ["🎄", "⭐", "🎁", "❄️"],
  pascoa: ["🐰", "🥚", "🌸", "🐣"],
  aniversario: ["🎂", "🎉", "🎈", "🎊"],
  casamento: ["💍", "💖", "🌹", "💐"],
  "ano-novo": ["🎆", "🥂", "🎇", "✨"],
};

export function PhotoFrame({
  theme,
  src,
  caption,
}: {
  theme?: string | null;
  src: string;
  caption?: string | null;
}) {
  const t = getTheme(theme);
  const corners = FRAME_CORNERS[t.key] ?? FRAME_CORNERS.default;
  const [ratio, setRatio] = useState<number | null>(null);

  // Frame fits image naturally regardless of aspect ratio (portrait, landscape,
  // panorama, square). aspect-ratio + max width/height lets the browser pick the
  // largest box that fits both constraints without distorting the image.
  const frameStyle: React.CSSProperties = ratio
    ? {
        aspectRatio: ratio,
        maxWidth: "calc(100vw - 3rem)",
        maxHeight: "calc(100vh - 3rem)",
        width: ratio >= 1 ? "calc(100vh - 3rem) * " + ratio : undefined,
        height: ratio < 1 ? "calc(100vw - 3rem) / " + (1 / ratio) : undefined,
      }
    : { width: "min(100%, 100vw - 3rem)", height: "min(100%, 100vh - 3rem)" };

  return (
    <div className="absolute inset-0 grid place-items-center p-4 md:p-6">
      <div className="relative" style={frameStyle}>
        <div
          className="relative w-full h-full rounded-3xl overflow-hidden"
          style={{
            padding: "8px",
            background: t.gradient,
            boxShadow: `0 0 60px ${t.accent}55, 0 0 0 2px ${t.accent}33 inset`,
          }}
        >
          <div className="relative w-full h-full rounded-[20px] overflow-hidden bg-black">
            <img
              src={src}
              alt=""
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setRatio(img.naturalWidth / img.naturalHeight);
                }
              }}
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/30 pointer-events-none" />
            {caption && (
              <div className="absolute bottom-6 left-0 right-0 text-center px-8">
                <p className="font-display text-4xl md:text-6xl drop-shadow-2xl text-white">
                  {caption}
                </p>
              </div>
            )}
          </div>
          {/* Corner decorations */}
          <span className="absolute -top-3 -left-3 text-5xl md:text-6xl drop-shadow-lg select-none rotate-[-15deg]">
            {corners[0]}
          </span>
          <span className="absolute -top-3 -right-3 text-5xl md:text-6xl drop-shadow-lg select-none rotate-[15deg]">
            {corners[1]}
          </span>
          <span className="absolute -bottom-3 -left-3 text-5xl md:text-6xl drop-shadow-lg select-none rotate-[15deg]">
            {corners[2]}
          </span>
          <span className="absolute -bottom-3 -right-3 text-5xl md:text-6xl drop-shadow-lg select-none rotate-[-15deg]">
            {corners[3]}
          </span>
        </div>
      </div>
    </div>
  );
}
