export default {
  async fetch(request, env) {
    try {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { image_url, caption, hashtags } = await request.json();

      if (!env.FB_PAGE_TOKEN) {
        return new Response(JSON.stringify({ error: 'FB_PAGE_TOKEN não configurado no Cloudflare' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const pageId = '144773495865295';
      const text = `${caption}\n\n${hashtags}`;

      const fbResponse = await fetch(`https://graph.facebook.com/v20.0/${pageId}/photos`, {
        method: 'POST',
        body: new URLSearchParams({
          access_token: env.FB_PAGE_TOKEN,
          url: image_url,
          // `message` e nao `caption`: no /photos o `caption` e ignorado e a
          // foto sai sem texto no feed.
          message: text,
          published: 'true'
        })
      });

      const result = await fbResponse.json();
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Erro no Worker',
        details: err.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
