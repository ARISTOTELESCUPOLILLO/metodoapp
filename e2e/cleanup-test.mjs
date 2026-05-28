/**
 * Cleanup: apaga o usuário de teste E2E e todos os seus dados.
 * Rodar: NODE_OPTIONS=--use-system-ca node e2e/cleanup-test.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const credsPath = join(__dir, 'test-credentials.json');

if (!existsSync(credsPath)) {
  console.log('ℹ️ test-credentials.json não encontrado — nada a limpar.');
  process.exit(0);
}

const envPath = join(__dir, '..', '.env');
const env = readFileSync(envPath, 'utf8');
const get = (key) => env.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim().replace(/['"]/g, '') ?? '';

const admin = createClient(get('SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { userId, email } = JSON.parse(readFileSync(credsPath, 'utf8'));
console.log(`🗑️ Limpando usuário de teste: ${email} (${userId})`);

// Apagar assets do storage bucket
const { data: objs } = await admin.storage.from('user-assets').list(userId, { limit: 200 });
if (objs?.length) {
  const paths = objs.map(o => `${userId}/${o.name}`);
  // Listar subpastas (cada geração é uma pasta)
  for (const obj of objs) {
    const { data: sub } = await admin.storage.from('user-assets').list(`${userId}/${obj.name}`, { limit: 50 });
    if (sub?.length) {
      const subPaths = sub.map(s => `${userId}/${obj.name}/${s.name}`);
      await admin.storage.from('user-assets').remove(subPaths);
    }
  }
  await admin.storage.from('user-assets').remove(paths).catch(() => {});
  console.log(`✅ Storage limpo (${objs.length} itens)`);
}

// Apagar brand kits
await admin.from('brand_kits').delete().eq('user_id', userId);
console.log('✅ Brand kits removidos');

// Apagar gerações (cascateia user_assets via FK)
await admin.from('user_generations').delete().eq('user_id', userId);
console.log('✅ Gerações removidas');

// Apagar auth user (cascateia profile por FK)
const { error: delErr } = await admin.auth.admin.deleteUser(userId);
if (delErr) {
  console.error('❌ Falha ao deletar auth user:', delErr.message);
} else {
  console.log('✅ Auth user deletado');
}

// Remover arquivo de credenciais
unlinkSync(credsPath);
console.log('✅ test-credentials.json removido');
console.log('\n🏁 Cleanup completo.');
