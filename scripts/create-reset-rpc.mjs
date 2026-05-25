// Cria a função reset_all_usage no Supabase via Management API.
// Requer SUPABASE_ACCESS_TOKEN no ambiente.
const PROJECT_REF = 'tjjfkngpqnurhcjsccbk';
const token = process.env.SUPABASE_ACCESS_TOKEN;

const sql = `
CREATE OR REPLACE FUNCTION reset_all_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM usage_logs;
  UPDATE profiles SET
    plano1_imgs_usadas    = 0,
    plano1_renders_usados = 0,
    plano1_geracoes_usadas = 0,
    plano2_imgs_usadas    = 0,
    plano2_renders_usados = 0,
    plano2_geracoes_usadas = 0,
    bonus_imgs_usadas     = 0,
    bonus_renders_usados  = 0,
    bonus_geracoes_usadas = 0;
END;
$$;
`;

if (!token) {
  console.log('Para criar a RPC via API, execute:');
  console.log('  SUPABASE_ACCESS_TOKEN=<seu-token> node scripts/create-reset-rpc.mjs');
  console.log('\nOu cole o SQL abaixo no Supabase SQL Editor:');
  console.log(sql);
  process.exit(0);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const data = await res.json();
if (!res.ok) {
  console.error('Erro:', JSON.stringify(data));
  process.exit(1);
}
console.log('✓ Função reset_all_usage criada.');
