/**
 * Setup: cria usuário de teste E2E com plano S6C e brand kit pré-configurado.
 * Salva credenciais em e2e/test-credentials.json para uso no playwright-test.mjs
 * Rodar: NODE_OPTIONS=--use-system-ca node e2e/setup-test.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// Ler .env do projeto
const envPath = join(__dir, '..', '.env');
const env = readFileSync(envPath, 'utf8');
const get = (key) => env.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim().replace(/['"]/g, '') ?? '';

const SUPABASE_URL = get('SUPABASE_URL');
const SERVICE_KEY = get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas no .env');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = `teste-e2e-${Date.now()}@local.test`;
const PASSWORD = 'TesteOP2026!';

console.log('🔧 Iniciando setup do usuário E2E...');

// 1. Buscar plan_ids do S3C e PU4
// S3C (3 peças Cinemática) é preferido sobre S6C: gera em ~15s, dentro do limite de CPU do Worker
const { data: plan, error: planErr } = await admin.from('plans').select('id, nome, codigo').eq('codigo', 'S3C').maybeSingle();
if (planErr || !plan) {
  console.error('❌ Plano S3C não encontrado:', planErr?.message);
  process.exit(1);
}
console.log(`✅ Plano encontrado: ${plan.codigo} — ${plan.nome} (${plan.id})`);

const { data: puPlan } = await admin.from('plans').select('id, nome, codigo').eq('codigo', 'PU4').maybeSingle();
if (puPlan) console.log(`✅ Plano PU4 encontrado: ${puPlan.id}`);
else console.log('⚠️ Plano PU4 não encontrado — C7 (Post Único) será skippado no teste');

// 2. Criar auth user com senha conhecida
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { is_test: true, nome: 'E2E Tester' },
});
if (createErr || !created.user) {
  console.error('❌ Falha ao criar usuário:', createErr?.message);
  process.exit(1);
}
const userId = created.user.id;
console.log(`✅ Usuário criado: ${EMAIL} (${userId})`);

// Aguardar trigger handle_new_user criar o profile
await new Promise(r => setTimeout(r, 1500));

// 3. Atualizar profile com plano e segmento
const profileUpdate = {
  nome: 'E2E Tester',
  segmento: 'SERVIÇOS',
  plano1_id: plan.id,
  is_test: true,
};
if (puPlan) profileUpdate.plano2_id = puPlan.id;

const { error: updErr } = await admin.from('profiles').update(profileUpdate).eq('id', userId);
if (updErr) {
  console.error('❌ Falha ao atualizar profile:', updErr.message);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
  process.exit(1);
}
console.log(`✅ Profile atualizado — plano1=S6C${puPlan ? ' plano2=PU4' : ''} segmento=SERVIÇOS`);

// 4. Criar brand kit
const { error: kitErr } = await admin.from('brand_kits').insert({
  user_id: userId,
  company_name: 'Clínica Saúde Total',
  segment: 'SERVIÇOS',
  primary_color: '#0f213f',
  secondary_color: '#f4b000',
  accent_color: '#e5e7eb',
  font_pair: 'Montserrat',
  logo_has_name: false,
  logo_position: 'bottom-right',
  brand_voice: 'Direto e confiante',
  main_activity: 'Clínica médica com foco em saúde preventiva',
  updated_at: new Date().toISOString(),
});
if (kitErr) {
  console.error('❌ Falha ao criar brand kit:', kitErr.message);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
  process.exit(1);
}
console.log('✅ Brand kit criado: Clínica Saúde Total');

// 5. Salvar credenciais
const creds = { email: EMAIL, password: PASSWORD, userId, planId: plan.id };
writeFileSync(join(__dir, 'test-credentials.json'), JSON.stringify(creds, null, 2));
console.log('✅ Credenciais salvas em e2e/test-credentials.json');
console.log('\n📋 Resumo:');
console.log(`   Email:    ${EMAIL}`);
console.log(`   Senha:    ${PASSWORD}`);
console.log(`   UserId:   ${userId}`);
console.log(`   Plano:    S6C (${plan.id})`);
console.log('\n▶ Próximo: NODE_OPTIONS=--use-system-ca node e2e/playwright-test.mjs');
