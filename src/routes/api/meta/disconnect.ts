import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/usage.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/meta/disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: "Não autenticado" }, { status: 401 });

        const { error } = await supabaseAdmin
          .from("meta_connections")
          .delete()
          .eq("user_id", userId);

        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true });
      },
    },
  },
});
