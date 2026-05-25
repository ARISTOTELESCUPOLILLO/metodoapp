// Script de reset: zera usage_logs e contadores dos perfis via service role key.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tjjfkngpqnurhcjsccbk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqamZrbmdwcW51cmhjanNjY2JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzkxMjczMSwiZXhwIjoyMDkzNDg4NzMxfQ.Sels1NCXdGIFWGA7BRn0BGy5DMlI7zwr4RV9x6o84Oo';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('▶ Deletando usage_logs...');
  const { error: delErr, count } = await supabase
    .from('usage_logs')
    .delete({ count: 'exact' })
    .gte('created_at', '2000-01-01');
  if (delErr) { console.error('ERRO ao deletar logs:', delErr.message); process.exit(1); }
  console.log(`  ✓ ${count ?? '?'} logs deletados.`);

  console.log('▶ Zerando contadores nos perfis...');
  const { error: updErr } = await supabase
    .from('profiles')
    .update({
      plano1_imgs_usadas: 0,
      plano1_renders_usados: 0,
      plano1_geracoes_usadas: 0,
      plano2_imgs_usadas: 0,
      plano2_renders_usados: 0,
      plano2_geracoes_usadas: 0,
      bonus_imgs_usadas: 0,
      bonus_renders_usados: 0,
      bonus_geracoes_usadas: 0,
    })
    .gte('created_at', '2000-01-01');
  if (updErr) { console.error('ERRO ao zerar perfis:', updErr.message); process.exit(1); }
  console.log('  ✓ Contadores zerados em todos os perfis.');

  console.log('▶ Preenchendo nome do admin acupolillo1...');
  const { error: nameErr } = await supabase
    .from('profiles')
    .update({ nome: 'Aristoteles Cupolillo' })
    .eq('email', 'acupolillo1@gmail.com');
  if (nameErr) { console.error('ERRO ao atualizar nome:', nameErr.message); process.exit(1); }
  console.log('  ✓ Nome preenchido.');

  console.log('\n✅ Reset concluído com sucesso!');
}

main();
