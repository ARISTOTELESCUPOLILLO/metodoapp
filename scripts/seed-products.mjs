// Popula a coluna `products` (produtos/serviços) para as contas de teste,
// usada como semente concreta da Sugestão (Informação-chave).
// Requer que a migration 20260612000002_add-products-brand-kits.sql já
// tenha sido aplicada (coluna `products` existente em brand_kits).
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tjjfkngpqnurhcjsccbk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqamZrbmdwcW51cmhjanNjY2JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzkxMjczMSwiZXhwIjoyMDkzNDg4NzMxfQ.Sels1NCXdGIFWGA7BRn0BGy5DMlI7zwr4RV9x6o84Oo';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEEDS = [
  {
    user_id: 'd81baad4-9180-41e1-b3d6-13ef99f5cfc1', // FERRIMAQ
    products: ['Mesas para escritório', 'Cadeiras para escritório', 'Armários e arquivos', 'Poltronas para consultório', 'Cadeiras para auditório', 'Mesas e bancos para refeitório', 'Carteiras escolares'],
  },
  {
    user_id: 'c9a4339a-8ebc-4038-bc07-2dd4a3054700', // Barbosa Lubrificantes
    products: ['Óleos lubrificantes', 'Correias industriais', 'Mangueiras hidráulicas', 'Ferramentas manuais', 'Equipamentos de proteção individual (EPI)', 'Serviço de prensa de mangueiras'],
  },
  {
    user_id: '65d41a31-7bb6-4df8-b0bc-2310feb82630', // Pronto Vet
    products: ['Consultas veterinárias', 'Vacinas para cães e gatos', 'Banho e tosa', 'Exames laboratoriais', 'Cirurgias', 'Internação e observação'],
  },
  {
    user_id: '01baa1df-1aa5-442d-9b88-63e6d4951534', // Barbosa Lubrificantes
    products: ['Óleos lubrificantes', 'Correias industriais', 'Mangueiras hidráulicas', 'Ferramentas manuais', 'Equipamentos de proteção individual (EPI)'],
  },
  {
    user_id: '1c212762-c7af-4a49-8e0a-7e409cad39c2', // Pronto Vet
    products: ['Consultas veterinárias', 'Ração para cães e gatos', 'Remédios e medicamentos veterinários', 'Acessórios para pets', 'Vacinas', 'Banho e tosa'],
  },
];

for (const { user_id, products } of SEEDS) {
  const { data, error } = await supabase
    .from('brand_kits')
    .update({ products })
    .eq('user_id', user_id)
    .select('company_name, products');
  if (error) { console.error(`ERRO (${user_id}):`, error.message); continue; }
  console.log(`✓ ${data?.[0]?.company_name}:`, data?.[0]?.products);
}
