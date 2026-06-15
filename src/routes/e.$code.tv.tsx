import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/e/$code/tv")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("events")
      .select("id")
      .eq("short_code", params.code)
      .single();
    if (!data) throw new Error("Evento não encontrado");
    throw redirect({ to: "/event/$id/tv", params: { id: data.id } });
  },
});
