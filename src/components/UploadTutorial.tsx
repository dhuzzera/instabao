import { useEffect, useState } from "react";
import { Camera, Images, RotateCw, User, Upload, Heart, Tv, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
};

const STEPS: Step[] = [
  {
    icon: Camera,
    title: "Tire ou escolha fotos",
    text: "Toque em “Tirar fotos” pra abrir a câmera ou escolher da galeria.",
  },
  {
    icon: Images,
    title: "Manda até 8 de uma vez",
    text: "Adicione várias fotos no mesmo envio. Toque no + pra incluir mais.",
  },
  {
    icon: RotateCw,
    title: "Girar e remover",
    text: "Use as setinhas pra girar a foto e o X pra remover antes de enviar.",
  },
  {
    icon: User,
    title: "Seu nome (opcional)",
    text: "Coloque seu nome pra aparecer junto da foto no telão.",
  },
  {
    icon: Upload,
    title: "Enviar pro telão",
    text: "Ao enviar, suas fotos entram na fila e aparecem em segundos.",
  },
  {
    icon: Heart,
    title: "Curta no telão",
    text: "Quem abre o telão pode curtir as fotos — os corações aparecem ao vivo.",
  },
  {
    icon: Tv,
    title: "AfterFest",
    text: "Depois da festa, todas as fotos ficam salvas no AfterFest pra rever e baixar.",
  },
];

export function UploadTutorial({ eventId }: { eventId: string }) {
  const key = `instabao:tutorial:${eventId}`;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(key)) setOpen(true);
  }, [key]);

  function close() {
    try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
    setOpen(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else close();
  }

  if (!open) return null;
  const S = STEPS[step];
  const Icon = S.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={close}
          aria-label="Fechar tutorial"
          className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg shadow-orange-200 mb-4">
            <Icon className="h-8 w-8 text-white" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground">
            Passo {step + 1} de {STEPS.length}
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground mt-1">{S.title}</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{S.text}</p>
        </div>

        <div className="flex justify-center gap-1.5 mt-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-foreground" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>

        <div className="flex gap-2 mt-6">
          {!isLast && (
            <Button variant="ghost" onClick={close} className="flex-1">
              Pular
            </Button>
          )}
          <Button
            onClick={next}
            className="flex-1 bg-brand-gradient text-white font-bold border-0"
          >
            {isLast ? "Começar" : (<>Próximo <ChevronRight className="h-4 w-4 ml-1" /></>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
