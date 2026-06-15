import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { uploadEventFile } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Camera, Download, Tv, Trash2, Image as ImageIcon, ArrowLeft } from "lucide-react";

type EventRow = { id: string; name: string; event_date: string | null; status: string };
type Photo = { id: string; image_url: string; guest_name: string | null; created_at: string };
type Sponsor = { id: string; image_url: string; position: number };

export const Route = createFileRoute("/event/$id/admin")({
  head: () => ({ meta: [{ title: "Gerenciar · InstaBão" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { id } = Route.useParams();
  const [ev, setEv] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [uploadUrl, setUploadUrl] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  const sponsorInput = useRef<HTMLInputElement>(null);

  async function loadAll() {
    const [{ data: e }, { data: ph }, { data: sp }] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).single(),
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

  // Realtime photos
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

  async function addSponsor(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await uploadEventFile(id, f, "sponsor");
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
    const { error } = await supabase.from("photos").delete().eq("id", pid);
    if (error) toast.error(error.message); else loadAll();
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

  return (
    <div className="min-h-screen paper-noise pb-16">
      <Toaster richColors position="top-center" />
      <div className="h-4 bunting" />
      <header className="max-w-5xl mx-auto px-6 pt-8">
        <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Eventos
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
          <div className="min-w-0">
            <h1 className="text-4xl font-display text-foreground truncate">{ev?.name ?? "…"}</h1>
            <p className="text-sm text-muted-foreground">{ev?.event_date ?? "sem data"} · status: <b className="text-foreground">{ev?.status}</b></p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={toggleStatus}>
              {ev?.status === "active" ? "Finalizar evento" : "Reativar"}
            </Button>
            <Button asChild>
              <Link to="/event/$id/tv" params={{ id }} target="_blank">
                <Tv className="h-4 w-4 mr-2" /> Abrir telão
              </Link>
            </Button>
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
            <Button onClick={downloadQR} variant="secondary" className="w-full mt-3">
              <Download className="h-4 w-4 mr-2" /> Baixar QR
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/event/$id/upload" params={{ id }}>
                <Camera className="h-4 w-4 mr-2" /> Abrir página de upload
              </Link>
            </Button>
          </Card>

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
                  <img src={p.image_url} alt="" className="w-full h-full object-contain" />
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
