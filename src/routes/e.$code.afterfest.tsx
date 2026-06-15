import { createFileRoute, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AfterFestPage } from "./event.$id.afterfest";

export const Route = createFileRoute("/e/$code/afterfest")({
  head: () => ({ meta: [{ title: "AfterFest · InstaBão" }] }),
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("events")
      .select("id")
      .eq("short_code", params.code)
      .maybeSingle();
    if (!data) throw notFound();
    return { id: data.id as string };
  },
  component: ShortAfterFestPage,
  notFoundComponent: () => <div className="p-6 text-center">Evento não encontrado.</div>,
  errorComponent: () => <div className="p-6 text-center">Erro ao carregar o evento.</div>,
});

function ShortAfterFestPage() {
  const { id } = Route.useLoaderData();
  return <AfterFestPage eventId={id} />;
}
