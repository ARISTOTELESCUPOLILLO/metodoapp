import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/usage.server";
import { META_VERSION, resolveMetaDestino } from "@/lib/meta.server";
import { META_DESTINOS } from "@/lib/metaAllowlist";

// Diagnóstico dos ativos que o System User da BM enxerga: toda Página
// compartilhada com a BM da OPropaganda e a conta Instagram Business ligada a
// cada uma. É daqui que saem os dois IDs necessários para cadastrar um cliente
// novo em metaAllowlist.ts — sem isso, o cliente não publica (por desenho).
//
// Só quem já publica pode abrir: a rota expõe a carteira de ativos da BM.

interface PaginaGraph {
  id: string;
  name?: string;
  instagram_business_account?: { id: string; username?: string };
}

export const Route = createFileRoute("/api/meta/debug-accounts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: "Não autenticado" }, { status: 401 });
        if (!resolveMetaDestino(request))
          return Response.json({ error: "Acesso não autorizado" }, { status: 403 });

        const token = process.env.META_ACCESS_TOKEN;
        if (!token)
          return Response.json({ error: "META_ACCESS_TOKEN não configurado" }, { status: 403 });

        try {
          // /me/accounts devolve as Páginas alcançáveis pelo token, já com a
          // conta Instagram vinculada a cada uma — que é o par que precisamos.
          const res = await fetch(
            `https://graph.facebook.com/${META_VERSION}/me/accounts` +
              `?fields=id,name,instagram_business_account{id,username}` +
              `&limit=100&access_token=${token}`,
          );
          const body = (await res.json()) as {
            data?: PaginaGraph[];
            error?: { message: string; type?: string; code?: number };
          };

          if (body.error) {
            return Response.json(
              { erro: body.error.message, dica: "O token pode não ser de System User da BM." },
              { status: 502 },
            );
          }

          const jaCadastrados = new Set(Object.values(META_DESTINOS).map((d) => d.pageId));

          const paginas = (body.data || []).map((p) => ({
            nomeDaPagina: p.name || null,
            pageId: p.id,
            igUserId: p.instagram_business_account?.id || null,
            igUsername: p.instagram_business_account?.username || null,
            // Sem Instagram vinculado a Página, a API da Meta não publica no
            // Instagram — só no Facebook. Vale sinalizar antes de prometer.
            publicaNoInstagram: !!p.instagram_business_account?.id,
            jaCadastrado: jaCadastrados.has(p.id),
          }));

          return Response.json({
            total: paginas.length,
            paginas,
            comoUsar:
              "Copie pageId e igUserId da conta desejada para META_DESTINOS em src/lib/metaAllowlist.ts.",
          });
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
