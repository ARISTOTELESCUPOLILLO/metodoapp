// Aplica uma migration SQL diretamente no Supabase via Management API
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const SQL_FILE = process.argv[2];
if (!SQL_FILE) { console.error('Usage: node apply-migration.mjs <file.sql>'); process.exit(1); }

const sql = readFileSync(resolve(__dirname, '..', SQL_FILE), 'utf8');
const projectRef = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase expõe execução de SQL via a função pg_advisory_lock-like no dashboard,
// mas a forma mais direta é chamar via o endpoint do Supabase Admin.
// Usamos o endpoint interno que o dashboard usa: /pg/query
const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

// Como fallback, tenta via rpc direto com service role
const fallbackUrl = `${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`;

async function tryDirect() {
  const r = await fetch(fallbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRole,
      'Authorization': `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({ sql }),
  });
  const text = await r.text();
  if (r.ok) { console.log('OK via RPC:', text); return true; }
  console.log('RPC fallback failed:', r.status, text);
  return false;
}

tryDirect().then(ok => {
  if (!ok) {
    console.log('\nNão foi possível aplicar via API automática.');
    console.log('Execute manualmente no Supabase SQL Editor:');
    console.log('---');
    console.log(sql);
    console.log('---');
  }
});
