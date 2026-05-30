import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';

const META_VERSION = 'v21.0';

export const Route = createFileRoute('/api/meta/debug-accounts')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });

        const devToken = process.env.META_ACCESS_TOKEN;
        if (!devToken) return Response.json({ error: 'META_ACCESS_TOKEN não configurado' }, { status: 403 });

        try {
          // 1. Verifica o token
          const meRes = await fetch(`https://graph.facebook.com/${META_VERSION}/me?fields=id,name&access_token=${devToken}`);
          const me = await meRes.json() as { id?: string; name?: string; error?: { message: string } };

          // 2. Lista páginas via /me/accounts (User Token)
          const pagesRes = await fetch(`https://graph.facebook.com/${META_VERSION}/me/accounts?access_token=${devToken}`);
          const pagesData = await pagesRes.json() as { data?: Array<{ id: string; name: string; access_token: string }>; error?: { message: string } };
          let pages = pagesData.data || [];
          let tokenType = 'USER_TOKEN';

          if (pages.length === 0) {
            // Verifica se o token é um Page Token direto (não perfil pessoal)
            // Perfis pessoais retornam erro "(#100) nonexisting field" ao consultar instagram_business_account
            const pageCheckRes = await fetch(`https://graph.facebook.com/${META_VERSION}/me?fields=id,name,instagram_business_account&access_token=${devToken}`);
            const pageCheck = await pageCheckRes.json() as { id?: string; name?: string; instagram_business_account?: { id: string }; error?: { code?: number; message: string } };

            const isPersonalProfile = pageCheck.error?.message?.includes('nonexisting field') || pageCheck.error?.code === 100;

            if (isPersonalProfile || !pageCheck.id) {
              return Response.json({
                tokenUser: { id: me.id, name: me.name, tokenError: null },
                tokenType: 'USER_TOKEN_SEM_PAGINAS',
                pagesCount: 0,
                pagesError: 'Nenhuma Página do Facebook encontrada para este token. Gere um User Token com pages_show_list e selecione a Página correta, depois copie o Page Access Token da Página.',
                pages: [],
              });
            }

            // Token é de uma Página válida
            pages = [{ id: pageCheck.id, name: pageCheck.name || '', access_token: devToken }];
            tokenType = 'PAGE_TOKEN_DIRETO';
          }

          // 3. Para cada página, verifica instagram_business_account
          const pageDetails = await Promise.all(pages.map(async (page) => {
            const igRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${page.id}?fields=instagram_business_account,name&access_token=${page.access_token}`);
            const igData = await igRes.json() as { instagram_business_account?: { id: string }; name?: string; error?: { message: string } };

            // Avisa se o nome da "página" bate com o nome pessoal do dono do token
            const looksPersonal = me.name && page.name === me.name;
            const personalWarning = looksPersonal
              ? `Este token parece ser de perfil pessoal, não de Página. Use o Page Access Token da Página OPropaganda.`
              : null;

            return {
              pageId: page.id,
              pageName: page.name,
              hasInstagram: !!igData.instagram_business_account?.id,
              igUserId: igData.instagram_business_account?.id || null,
              igError: igData.error?.message || null,
              warning: personalWarning,
            };
          }));

          return Response.json({
            tokenUser: { id: me.id, name: me.name, tokenError: me.error?.message || null },
            tokenType,
            pagesCount: pages.length,
            pagesError: pagesData.error?.message || null,
            pages: pageDetails,
          });
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
