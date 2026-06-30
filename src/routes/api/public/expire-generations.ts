import { createFileRoute } from "@tanstack/react-router";
import { expireGenerations } from "@/repository/generations.repo";

export const Route = createFileRoute("/api/public/expire-generations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || secret !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const removed = await expireGenerations();
          return Response.json({ removed });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
