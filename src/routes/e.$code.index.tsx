import { createFileRoute, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { UploadPage } from "./event.$id.upload";

export const Route = createFileRoute("/e/$code/")({
  head: () => ({ meta: [{ title: "Enviar foto · InstaBão" }] }),
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("events")
      .select("id")
      .eq("short_code", params.code)
      .maybeSingle();
    if (!data) throw notFound();
    return { id: data.id as string };
  },
  component: ShortUploadPage,
  notFoundComponent: () => <div className="p-6 text-center">Evento não encontrado.</div>,
  errorComponent: () => <div className="p-6 text-center">Erro ao carregar o evento.</div>,
});

function ShortUploadPage() {
  const { id } = Route.useLoaderData();
  return <UploadPage eventId={id} />;
}
