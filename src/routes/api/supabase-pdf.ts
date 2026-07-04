import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdFromRequest } from "@/lib/usage.server";

export const Route = createFileRoute("/api/supabase-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Rota autenticada — grava no bucket público via supabaseAdmin,
          // então upload anônimo não pode ser permitido.
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }

          const { companyName, pdfBase64, filename } = await request.json();
          if (!pdfBase64 || !filename) {
            return Response.json({ error: "pdfBase64 e filename obrigatórios" }, { status: 400 });
          }

          // Sanitiza o filename: sem separadores de caminho, allowlist estrita,
          // sempre .pdf — impede escrita/overwrite fora da pasta do usuário.
          const safeFilename = String(filename)
            .replace(/[/\\]/g, "")
            .replace(/[^a-zA-Z0-9-_.]/g, "_");
          if (!safeFilename || !safeFilename.toLowerCase().endsWith(".pdf")) {
            return Response.json({ error: "filename inválido" }, { status: 400 });
          }

          const bytes = Buffer.from(pdfBase64, "base64");
          // Namespace por usuário — evita colisão/overwrite entre usuários
          // com o mesmo companyName.
          const companySlug = String(companyName || "sem-marca").replace(/[^a-zA-Z0-9-_]/g, "_");
          const path = `${userId}/${companySlug}/${safeFilename}`;
          const { error } = await supabaseAdmin.storage
            .from("pdfs")
            .upload(path, bytes, { contentType: "application/pdf", upsert: true });
          if (error) return Response.json({ error: error.message }, { status: 500 });
          const { data } = supabaseAdmin.storage.from("pdfs").getPublicUrl(path);
          return Response.json({ url: data.publicUrl, path });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
