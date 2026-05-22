import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/supabase-pdf')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { companyName, pdfBase64, filename } = await request.json();
          if (!pdfBase64 || !filename) {
            return Response.json({ error: 'pdfBase64 e filename obrigatórios' }, { status: 400 });
          }
          const bytes = Buffer.from(pdfBase64, 'base64');
          const path = `${(companyName || 'sem-marca').replace(/[^a-zA-Z0-9-_]/g, '_')}/${filename}`;
          const { error } = await supabaseAdmin.storage
            .from('pdfs')
            .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
          if (error) return Response.json({ error: error.message }, { status: 500 });
          const { data } = supabaseAdmin.storage.from('pdfs').getPublicUrl(path);
          return Response.json({ url: data.publicUrl, path });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
