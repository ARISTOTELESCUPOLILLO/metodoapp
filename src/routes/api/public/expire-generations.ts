import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/expire-generations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || secret !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: expired, error } = await supabaseAdmin
          .from("user_generations")
          .select("id, pdf_path, video_path")
          .lt("expires_at", new Date().toISOString());
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        let removed = 0;
        for (const gen of expired || []) {
          const { data: assets } = await supabaseAdmin
            .from("user_assets")
            .select("storage_path")
            .eq("generation_id", gen.id);
          const paths = (assets || []).map((a) => a.storage_path);
          if (gen.pdf_path) paths.push(gen.pdf_path);
          if (gen.video_path) paths.push(gen.video_path);
          if (paths.length) {
            await supabaseAdmin.storage.from("user-assets").remove(paths);
          }
          await supabaseAdmin.from("user_generations").delete().eq("id", gen.id);
          removed += 1;
        }
        return Response.json({ removed });
      },
    },
  },
});
