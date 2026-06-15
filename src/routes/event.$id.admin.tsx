import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { uploadEventFile } from "@/lib/upload";
import { getClientId } from "@/lib/client-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Download, Tv, Trash2, Image as ImageIcon, ArrowLeft, Sparkles, Copy, Check, Users, Clock, ImagePlus, Pencil } from "lucide-react";
import { ModeratorsPanel } from "@/components/ModeratorsPanel";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemePicker } from "@/components/ThemePicker";


type EventRow = { id: string; name: string; event_date: string | null; status: string; theme: string; photo_seconds: number; sponsor_seconds: number; photos_per_block: number; short_code: string | null };
type Photo = { id: string; image_url: string; guest_name: string | null; created_at: string };
type Sponsor = { id: string; image_url: string; position: number };

export const Route = createFileRoute("/event/$id/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  head: () => ({ meta: [{ title: "Gerenciar · InstaBão" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { id } = Route.useParams();
  const [ev, setEv] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [uploadUrl, setUploadUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const sponsorInput = useRef<HTMLInputElement>(null);

  async function loadAll() {
    const [{ data: e }, { data: ph }, { data: sp }] = await Promise.all([
      supabase.from("events").select("*,short_code").eq("id", id).single(),
      supabase.from("photos").select("*").eq("event_id", id).order("created_at", { ascending: false }),
      supabase.from("sponsors").select("*").eq("event_id", id).order("position"),
    ]);
    if (e) setEv(e as EventRow);
    setPhotos((ph ?? []) as Photo[]);
    setSponsors((sp ?? []) as Sponsor[]);
  }

  useEffect(() => {
    loadAll();
    if (typeof window !== "undefined") {
      setUploadUrl(`${window.location.origin}/event/${id}/upload`);
    }
  }, [id]);

  useEffect(() => {
    const ch = supabase.channel(`admin-${id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "photos", filter: `event_id=eq.${id}` },
        () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  function downloadQR() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `qr-${ev?.name ?? "evento"}.png`; a.click();
  }

  async function copyLink() {
    if (!uploadUrl) return;
    try {
      await navigator.clipboard.writeText(uploadUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não consegui copiar");
    }
  }

  async function addSponsor(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { url } = await uploadEventFile(id, f, "sponsor");
      const { error } = await supabase.from("sponsors").insert({
        event_id: id, image_url: url, position: sponsors.length,
      });
      if (error) throw error;
      toast.success("Patrocinador adicionado");
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      if (sponsorInput.current) sponsorInput.current.value = "";
    }
  }

  async function deletePhoto(pid: string) {
    if (!confirm("Apagar esta foto?")) return;
    // Ownership is enforced server-side: only the original uploader (same device/browser)
    // can delete a photo via this RPC. Admin moderation requires login (não implementado).
    const { data, error } = await supabase.rpc("delete_my_photo", {
      _photo_id: pid,
      _client_id: getClientId(),
    });
    if (error) { toast.error(error.message); return; }
    if (data === false) {
      toast.error("Apenas quem enviou esta foto pode apagá-la.");
      return;
    }
    loadAll();
  }
  async function deleteSponsor(sid: string) {
    if (!confirm("Remover patrocinador?")) return;
    const { error } = await supabase.from("sponsors").delete().eq("id", sid);
    if (error) toast.error(error.message); else loadAll();
  }
  async function toggleStatus() {
    if (!ev) return;
    const newStatus = ev.status === "active" ? "finished" : "active";
    const { error } = await supabase.from("events").update({ status: newStatus }).eq("id", id);
    if (error) toast.error(error.message); else loadAll();
  }

  // Storage estimate (free plan ~1GB, fotos comprimidas ~300KB)
  const STORAGE_LIMIT_MB = 1024;
  const AVG_PHOTO_KB = 300;
  const storage = useMemo(() => {
    const usedMB = (photos.length * AVG_PHOTO_KB) / 1024;
    const pct = Math.min(100, (usedMB / STORAGE_LIMIT_MB) * 100);
    const remainingPhotos = Math.max(0, Math.floor((STORAGE_LIMIT_MB * 1024 - photos.length * AVG_PHOTO_KB) / AVG_PHOTO_KB));
    let level: "ok" | "warn" | "danger" = "ok";
    if (pct >= 85) level = "danger";
    else if (pct >= 65) level = "warn";
    return { usedMB, pct, remainingPhotos, level };
  }, [photos.length]);

  const lastAlertRef = useRef<string>("");
  useEffect(() => {
    const key = `${id}:${storage.level}`;
    if (lastAlertRef.current === key) return;
    lastAlertRef.current = key;
    if (storage.level === "warn") {
      toast.warning(`Armazenamento em ${storage.pct.toFixed(0)}% — ~${storage.remainingPhotos} fotos restantes`);
    } else if (storage.level === "danger") {
      toast.error(`Armazenamento em ${storage.pct.toFixed(0)}%! Considere finalizar o evento em breve.`);
    }
  }, [storage.level, storage.pct, storage.remainingPhotos, id]);

  // Stats
  const stats = useMemo(() => {
    if (photos.length === 0) return null;
    const senders = new Set(photos.map(p => p.guest_name?.trim().toLowerCase() || "(anônimo)"));
    const times = photos.map(p => new Date(p.created_at).getTime());
    const first = Math.min(...times);
    const last = Math.max(...times);
    const spanH = Math.max((last - first) / 3_600_000, 1 / 60);
    const rate = photos.length / spanH;
    const byHour = new Map<number, number>();
    for (const p of photos) {
      const h = new Date(p.created_at).getHours();
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }
    let peakHour = -1, peakN = 0;
    for (const [h, n] of byHour) if (n > peakN) { peakN = n; peakHour = h; }
    const counts = new Map<string, number>();
    for (const p of photos) {
      const k = p.guest_name?.trim() || "Anônimo";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { senders: senders.size, ratePerHour: rate, peakHour, top };
  }, [photos]);

  return (
    <div className="min-h-screen paper-noise pb-16">
      <Toaster richColors position="top-center" />
      <header className="max-w-5xl mx-auto px-6 pt-8">
        <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Eventos
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-brand-gradient">Gerenciar</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground truncate mt-1">{ev?.name ?? "…"}</h1>
            <p className="text-sm text-muted-foreground">{ev?.event_date ?? "sem data"} · status: <b className="text-foreground">{ev?.status}</b></p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <EditEventDialog ev={ev} onSaved={loadAll} />
            <Button variant="outline" onClick={toggleStatus}>
              {ev?.status === "active" ? "Finalizar evento" : "Reativar"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/event/$id/afterfest" params={{ id }} target="_blank">
                <Sparkles className="h-4 w-4 mr-2" /> AfterFest
              </Link>
            </Button>
            <Button asChild>
              <Link to="/event/$id/tv" params={{ id }} target="_blank">
                <Tv className="h-4 w-4 mr-2" /> Abrir telão
              </Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>


      <main className="max-w-5xl mx-auto px-6 mt-8 grid gap-6 md:grid-cols-[360px_1fr]">
        <aside className="space-y-6">
          <Card className="p-5 border-2 border-foreground">
            <h2 className="font-display text-xl text-foreground mb-3">QR Code para convidados</h2>
            <div ref={qrRef} className="bg-white p-4 rounded-2xl grid place-items-center">
              {uploadUrl && <QRCodeCanvas value={uploadUrl} size={220} level="M" includeMargin />}
            </div>
            <p className="mt-3 text-xs text-muted-foreground break-all">{uploadUrl}</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button onClick={copyLink} variant="secondary">
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copiado!" : "Copiar link"}
              </Button>
              <Button onClick={downloadQR} variant="secondary">
                <Download className="h-4 w-4 mr-2" /> Baixar QR
              </Button>
            </div>
            <Button asChild variant="ghost" className="w-full mt-1">
              <Link to="/event/$id/upload" params={{ id }}>
                <Camera className="h-4 w-4 mr-2" /> Abrir página de upload
              </Link>
            </Button>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl text-foreground">Armazenamento</h2>
              <span className={
                storage.level === "danger" ? "text-xs font-bold text-destructive" :
                storage.level === "warn" ? "text-xs font-bold text-yellow-600" :
                "text-xs font-bold text-emerald-600"
              }>
                {storage.pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={
                  "h-full transition-all " +
                  (storage.level === "danger" ? "bg-destructive" :
                   storage.level === "warn" ? "bg-yellow-500" : "bg-emerald-500")
                }
                style={{ width: `${storage.pct}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>~{storage.usedMB.toFixed(1)} MB de {STORAGE_LIMIT_MB} MB</span>
              <span>~{storage.remainingPhotos.toLocaleString("pt-BR")} fotos restantes</span>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
              Estimativa baseada em ~{AVG_PHOTO_KB}KB/foto. Quando passar de 85%, finalize ou faça backup das fotos antes de continuar.
            </p>
          </Card>

          {stats && (
            <Card className="p-5">
              <h2 className="font-display text-xl text-foreground mb-3">Estatísticas</h2>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Fotos:</span>
                  <b className="text-foreground ml-auto">{photos.length}</b>
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Convidados ativos:</span>
                  <b className="text-foreground ml-auto">{stats.senders}</b>
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Fotos/hora:</span>
                  <b className="text-foreground ml-auto">{stats.ratePerHour.toFixed(1)}</b>
                </li>
                {stats.peakHour >= 0 && (
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Pico:</span>
                    <b className="text-foreground ml-auto">{String(stats.peakHour).padStart(2, "0")}h</b>
                  </li>
                )}
              </ul>
              {stats.top.length > 0 && (
                <>
                  <p className="mt-4 mb-2 text-xs uppercase tracking-widest text-muted-foreground">Top convidados</p>
                  <ol className="space-y-1 text-sm">
                    {stats.top.map(([name, n], i) => (
                      <li key={name + i} className="flex justify-between">
                        <span className="truncate">{i + 1}. {name}</span>
                        <b className="text-foreground">{n}</b>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </Card>
          )}

          <Card className="p-5">
            <h2 className="font-display text-xl text-foreground mb-3">Patrocinadores</h2>
            <input ref={sponsorInput} type="file" accept="image/*" className="hidden" onChange={addSponsor} />
            <Button onClick={() => sponsorInput.current?.click()} variant="outline" className="w-full">
              <ImageIcon className="h-4 w-4 mr-2" /> Adicionar logo
            </Button>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {sponsors.map(s => (
                <div key={s.id} className="relative group rounded-lg overflow-hidden bg-muted aspect-video">
                  <img src={s.image_url} alt="" className="w-full h-full object-contain p-2" />
                  <button onClick={() => deleteSponsor(s.id)}
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {sponsors.length === 0 && <p className="col-span-2 text-xs text-muted-foreground text-center py-4">Nenhum logo ainda</p>}
            </div>
          </Card>

          <SlideshowTimingCard ev={ev} onSaved={loadAll} />

          <ThemePicker eventId={id} value={ev?.theme} onChanged={loadAll} />

          <ModeratorsPanel />
        </aside>

        <section>
          <h2 className="font-display text-2xl text-foreground mb-3">Fotos recebidas ({photos.length})</h2>
          {photos.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-muted-foreground">Aguardando fotos dos convidados 📸</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map(p => (
                <div key={p.id} className="relative group rounded-xl overflow-hidden aspect-square bg-muted">
                  <img src={p.image_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain" />
                  {p.guest_name && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs p-2">
                      {p.guest_name}
                    </div>
                  )}
                  <button onClick={() => deletePhoto(p.id)}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function EditEventDialog({ ev, onSaved }: { ev: EventRow | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && ev) {
      setName(ev.name);
      setDate(ev.event_date ?? "");
    }
  }, [open, ev]);

  async function save() {
    if (!ev || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({ name: name.trim(), event_date: date || null })
      .eq("id", ev.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Evento atualizado");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!ev}>
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar evento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ev-name">Nome</Label>
            <Input id="ev-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ev-date">Data</Label>
            <Input id="ev-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SlideshowTimingCard({ ev, onSaved }: { ev: EventRow | null; onSaved: () => void }) {
  const [photoS, setPhotoS] = useState(5);
  const [sponsorS, setSponsorS] = useState(7);
  const [perBlock, setPerBlock] = useState(5);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (ev) {
      setPhotoS(ev.photo_seconds ?? 5);
      setSponsorS(ev.sponsor_seconds ?? 7);
      setPerBlock(ev.photos_per_block ?? 5);
      setDirty(false);
    }
  }, [ev?.id, ev?.photo_seconds, ev?.sponsor_seconds, ev?.photos_per_block]);

  async function save() {
    if (!ev) return;
    setSaving(true);
    const { error } = await supabase.from("events").update({
      photo_seconds: photoS,
      sponsor_seconds: sponsorS,
      photos_per_block: perBlock,
    }).eq("id", ev.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tempos atualizados");
    setDirty(false);
    onSaved();
  }

  function Row({ label, value, setValue, min, max, suffix }: { label: string; value: number; setValue: (n: number) => void; min: number; max: number; suffix: string }) {
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">{label}</span>
          <b className="text-foreground">{value} {suffix}</b>
        </div>
        <input type="range" min={min} max={max} step={1} value={value}
          onChange={e => { setValue(Number(e.target.value)); setDirty(true); }}
          className="w-full accent-foreground" disabled={!ev} />
      </div>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-xl text-foreground mb-3">Tempo do telão</h2>
      <div className="space-y-4">
        <Row label="Segundos por foto" value={photoS} setValue={setPhotoS} min={2} max={20} suffix="s" />
        <Row label="Segundos por patrocinador" value={sponsorS} setValue={setSponsorS} min={2} max={20} suffix="s" />
        <Row label="Fotos entre patrocinadores" value={perBlock} setValue={setPerBlock} min={1} max={30} suffix="fotos" />
      </div>
      <Button onClick={save} disabled={!dirty || saving || !ev} className="w-full mt-4">
        {saving ? "Salvando…" : "Salvar"}
      </Button>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">As mudanças aparecem no telão instantaneamente.</p>
    </Card>
  );
}


