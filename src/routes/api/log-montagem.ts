import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/usage.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * DIÁRIO DA MONTAGEM DO FILME — o erro vem até nós, sem o usuário abrir console.
 *
 * ⚠ POR QUE EXISTE (11/09/2026): a montagem roda inteira no navegador e, quando
 * falha, o motivo real fica no log do FFmpeg — que só aparece no console do
 * usuário. O Ari não mexe em console, e disse isso com todas as letras. Pedir
 * F12 a quem não é de TI é transferir o meu problema para ele.
 *
 * Então o cliente manda para cá as últimas linhas do log e o grafo de filtros, e
 * eu leio direto no banco. Não debita nada, não gera nada, não bloqueia nada:
 * é só uma linha em usage_logs com evento "montagem_erro".
 *
 * Falha em silêncio de propósito — um diário que atrapalha o que veio diagnosticar
 * não serve para nada.
 */
export const Route = createFileRoute("/api/log-montagem")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) return Response.json({ ok: false });

          const body = await request.json();
          const payload = {
            onde: String(body.onde || "").slice(0, 40),
            mensagem: String(body.mensagem || "").slice(0, 600),
            // O log do FFmpeg é verboso; as últimas linhas são as que importam.
            log: (Array.isArray(body.log) ? body.log : [])
              .slice(-40)
              .map((l: unknown) => String(l).slice(0, 300)),
            filtros: String(body.filtros || "").slice(0, 4000),
            plano: String(body.plano || "").slice(0, 300),
          };

          await supabaseAdmin.from("usage_logs").insert({
            user_id: userId,
            evento: "montagem_erro",
            modulo: "reels",
            qtd_imagens: 0,
            qtd_renders: 0,
            qtd_geracoes: 0,
            payload,
          });
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: false });
        }
      },
    },
  },
});
