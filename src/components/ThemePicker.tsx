import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { THEMES, getTheme } from "@/lib/themes";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export function ThemePicker({ eventId, value, onChanged }: {
  eventId: string;
  value: string | null | undefined;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState(value ?? "default");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCurrent(value ?? "default"); }, [value]);

  async function pick(key: string) {
    if (key === current) return;
    setSaving(true);
    const prev = current;
    setCurrent(key);
    const { error } = await supabase.from("events").update({ theme: key }).eq("id", eventId);
    setSaving(false);
    if (error) {
      setCurrent(prev);
      toast.error(error.message);
      return;
    }
    toast.success(`Tema: ${getTheme(key).label}`);
    onChanged();
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-xl text-foreground mb-1">Tema da festa</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Muda o visual da página de upload, do AfterFest e do telão.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => {
          const active = current === t.key;
          return (
            <button
              key={t.key}
              type="button"
              disabled={saving}
              onClick={() => pick(t.key)}
              className={`relative rounded-2xl p-3 text-left border-2 transition active:scale-[0.98] overflow-hidden ${
                active ? "border-foreground" : "border-border hover:border-foreground/40"
              }`}
              style={{ background: t.background, minHeight: 84 }}
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{ background: t.gradient }}
              />
              <div className="relative flex items-center gap-2">
                <span className="text-2xl">{t.emoji}</span>
                <span className="font-bold text-foreground drop-shadow-sm">{t.label}</span>
              </div>
              {active && (
                <span className="absolute top-1 right-2 text-[10px] font-bold uppercase tracking-widest text-foreground bg-white/80 rounded-full px-2 py-0.5">
                  Atual
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
