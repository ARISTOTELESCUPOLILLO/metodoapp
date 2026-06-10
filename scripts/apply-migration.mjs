// Aplica uma migration SQL diretamente no Supabase via Management API
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env manualmente (sem dependência de "dotenv")
const envPath = resolve(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = value;
}

const SQL_FILE = process.argv[2];
if (!SQL_FILE) { console.error('Usage: node apply-migration.mjs <file.sql>'); process.exit(1); }

const sql = readFileSync(resolve(__dirname, '..', SQL_FILE), 'utf8');
const projectRef = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fallback: tenta via rpc direto com service role
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
