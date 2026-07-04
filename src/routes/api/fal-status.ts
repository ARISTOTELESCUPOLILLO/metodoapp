import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/usage.server";

// URL real da fila do fal.ai — statusUrl/responseUrl devolvidos pelo submit
// sempre começam com esse host. Validar contra ele fecha SSRF (impede que a
// FAL_KEY seja enviada a um servidor arbitrário via query string).
const FAL_QUEUE = "https://queue.fal.run";

// Proxy de status para jobs assíncronos do fal.ai (Kling AI Avatar v2).
// Frontend chama a cada 5s até receber status:'done' ou status:'failed'.
export const Route = createFileRoute("/api/fal-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          // Rota autenticada — evita uso anônimo do proxy (que carrega a FAL_KEY).
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json({ status: "failed", error: "Não autenticado" }, { status: 401 });
          }

          const url = new URL(request.url);
          const statusUrl = url.searchParams.get("statusUrl");
          const responseUrl = url.searchParams.get("responseUrl");

          if (!statusUrl || !responseUrl) {
            return Response.json(
              { error: "statusUrl e responseUrl obrigatórios" },
              { status: 400 },
            );
          }

          // Anti-SSRF: só aceita URLs da fila oficial do fal.ai.
          if (!statusUrl.startsWith(FAL_QUEUE) || !responseUrl.startsWith(FAL_QUEUE)) {
            return Response.json({ status: "failed", error: "URL inválida" }, { status: 400 });
          }

          const falKey = process.env.FAL_KEY;
          if (!falKey) {
            return Response.json({ error: "FAL_KEY não configurada" }, { status: 500 });
          }

          // Consulta o status do job no fal.ai (chamada rápida, < 1s).
          const pollRes = await fetch(statusUrl, {
            headers: { Authorization: `Key ${falKey}` },
          });
          const pollText = await pollRes.text();
          if (!pollRes.ok) {
            console.error("[fal-status] poll error", pollRes.status, pollText.slice(0, 300));
            return Response.json({
              status: "failed",
              error: `Erro ao verificar status: ${pollText.slice(0, 200)}`,
            });
          }

          let pj: { status?: string };
          try {
            pj = JSON.parse(pollText);
          } catch {
            pj = {};
          }

          const jobStatus = pj.status;
          console.log("[fal-status] status=%s", jobStatus);

          if (jobStatus === "FAILED" || jobStatus === "ERROR") {
            return Response.json({
              status: "failed",
              error: "Geração de vídeo falhou na fila do fal.ai.",
            });
          }

          if (jobStatus !== "COMPLETED") {
            // IN_QUEUE ou IN_PROGRESS — frontend continua polling.
            return Response.json({ status: "processing" });
          }

          // COMPLETED — busca o resultado.
          const finalRes = await fetch(responseUrl, {
            headers: { Authorization: `Key ${falKey}` },
          });
          const finalText = await finalRes.text();
          if (!finalRes.ok) {
            console.error("[fal-status] result error", finalRes.status, finalText.slice(0, 300));
            return Response.json({
              status: "failed",
              error: `Erro ao buscar resultado: ${finalText.slice(0, 200)}`,
            });
          }

          const result = JSON.parse(finalText) as { video?: { url?: string } };
          const videoUrl = result?.video?.url;
          if (!videoUrl) {
            console.error("[fal-status] video URL ausente", finalText.slice(0, 300));
            return Response.json({
              status: "failed",
              error: "Geração concluída mas sem URL de vídeo. Tente novamente.",
            });
          }

          return Response.json({ status: "done", videoUrl });
        } catch (e) {
          console.error("[fal-status] unexpected error", (e as Error).message);
          return Response.json({ status: "failed", error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
