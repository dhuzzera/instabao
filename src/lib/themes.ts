// Registry of visual themes that can be applied to an event.
// Each theme drives: background gradient, accent ring, optional particles
// and optional top strip. Keep keys stable — they're stored in events.theme.

export type ParticleKind =
  | "none"
  | "snow"
  | "embers"
  | "bats"
  | "confetti"
  | "eggs"
  | "petals"
  | "fireworks";

export type TopStrip = "none" | "bandeirinhas" | "lights" | "garland";

export type EventTheme = {
  key: string;
  label: string;
  emoji: string;
  // CSS background applied to the page (works on light backdrops)
  background: string;
  // CSS background used on dark surfaces (telão)
  backgroundDark: string;
  // Accent color (CSS color), used for ring + buttons highlight
  accent: string;
  // Gradient used for ring/buttons (CSS image)
  gradient: string;
  particles: ParticleKind;
  topStrip: TopStrip;
};

export const THEMES: EventTheme[] = [
  {
    key: "default",
    label: "Padrão",
    emoji: "✨",
    background:
      "radial-gradient(at 8% 0%, oklch(0.95 0.08 30 / 0.45) 0px, transparent 55%), radial-gradient(at 95% 10%, oklch(0.92 0.1 340 / 0.4) 0px, transparent 50%), radial-gradient(at 50% 100%, oklch(0.93 0.09 280 / 0.35) 0px, transparent 55%)",
    backgroundDark: "#000",
    accent: "#ee2a7b",
    gradient:
      "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)",
    particles: "none",
    topStrip: "none",
  },
  {
    key: "junina",
    label: "Festa Junina",
    emoji: "🔥",
    background:
      "radial-gradient(at 10% 0%, #fde68a 0px, transparent 50%), radial-gradient(at 90% 5%, #fca5a5 0px, transparent 45%), radial-gradient(at 50% 100%, #fdba74 0px, transparent 55%), linear-gradient(180deg, #fff7ed 0%, #fff1e6 100%)",
    backgroundDark:
      "radial-gradient(at 50% 100%, #7c2d12 0%, #1a0a04 70%)",
    accent: "#dc2626",
    gradient: "linear-gradient(135deg, #facc15 0%, #f97316 50%, #dc2626 100%)",
    particles: "embers",
    topStrip: "bandeirinhas",
  },
  {
    key: "halloween",
    label: "Halloween",
    emoji: "🎃",
    background:
      "radial-gradient(at 20% 0%, #4c1d95 0px, transparent 55%), radial-gradient(at 80% 10%, #ea580c 0px, transparent 45%), linear-gradient(180deg, #1c1033 0%, #0b0518 100%)",
    backgroundDark:
      "radial-gradient(at 50% 0%, #4c1d95 0%, #0b0518 70%)",
    accent: "#f97316",
    gradient: "linear-gradient(135deg, #f97316 0%, #a855f7 100%)",
    particles: "bats",
    topStrip: "none",
  },
  {
    key: "natal",
    label: "Natal",
    emoji: "🎄",
    background:
      "radial-gradient(at 10% 0%, #14532d 0px, transparent 55%), radial-gradient(at 95% 10%, #b91c1c 0px, transparent 45%), linear-gradient(180deg, #062420 0%, #0a1a14 100%)",
    backgroundDark:
      "radial-gradient(at 50% 0%, #14532d 0%, #050a08 70%)",
    accent: "#dc2626",
    gradient: "linear-gradient(135deg, #16a34a 0%, #facc15 50%, #dc2626 100%)",
    particles: "snow",
    topStrip: "lights",
  },
  {
    key: "pascoa",
    label: "Páscoa",
    emoji: "🐰",
    background:
      "radial-gradient(at 10% 0%, #fbcfe8 0px, transparent 55%), radial-gradient(at 90% 10%, #ddd6fe 0px, transparent 50%), radial-gradient(at 50% 100%, #bbf7d0 0px, transparent 55%), #fef9f5",
    backgroundDark:
      "radial-gradient(at 50% 100%, #831843 0%, #1a0810 70%)",
    accent: "#ec4899",
    gradient: "linear-gradient(135deg, #f9a8d4 0%, #c4b5fd 50%, #6ee7b7 100%)",
    particles: "eggs",
    topStrip: "garland",
  },
  {
    key: "aniversario",
    label: "Aniversário",
    emoji: "🎉",
    background:
      "radial-gradient(at 5% 0%, #fde68a 0px, transparent 50%), radial-gradient(at 95% 0%, #f9a8d4 0px, transparent 50%), radial-gradient(at 50% 100%, #a5b4fc 0px, transparent 55%), #fff",
    backgroundDark:
      "radial-gradient(at 50% 0%, #4338ca 0%, #0a0a23 70%)",
    accent: "#ec4899",
    gradient: "linear-gradient(135deg, #fde047 0%, #ec4899 50%, #6366f1 100%)",
    particles: "confetti",
    topStrip: "garland",
  },
  {
    key: "casamento",
    label: "Casamento",
    emoji: "💍",
    background:
      "radial-gradient(at 10% 0%, #fef3c7 0px, transparent 55%), radial-gradient(at 90% 10%, #fae8ff 0px, transparent 50%), linear-gradient(180deg, #fffaf0 0%, #fdf6ed 100%)",
    backgroundDark:
      "radial-gradient(at 50% 0%, #3b2f1e 0%, #0a0805 70%)",
    accent: "#c9a84c",
    gradient: "linear-gradient(135deg, #fef3c7 0%, #c9a84c 100%)",
    particles: "petals",
    topStrip: "none",
  },
  {
    key: "ano-novo",
    label: "Ano Novo",
    emoji: "🎆",
    background:
      "radial-gradient(at 15% 0%, #ca8a04 0px, transparent 55%), radial-gradient(at 85% 10%, #facc15 0px, transparent 45%), linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)",
    backgroundDark:
      "radial-gradient(at 50% 0%, #ca8a04 0%, #050505 70%)",
    accent: "#facc15",
    gradient: "linear-gradient(135deg, #fde047 0%, #ca8a04 100%)",
    particles: "fireworks",
    topStrip: "none",
  },
];

export function getTheme(key?: string | null): EventTheme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
