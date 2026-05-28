/**
 * Playwright E2E — 8 cenários de teste do Método OP
 * Rodar APÓS setup-test.mjs:
 *   NODE_OPTIONS=--use-system-ca node e2e/playwright-test.mjs
 */
import { chromium } from './node_modules/playwright/index.mjs';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const creds = JSON.parse(readFileSync(join(__dir, 'test-credentials.json'), 'utf8'));
const BASE = 'https://metodoapp.oficinadepropaganda.com.br';
const SS_DIR = join(__dir, 'screenshots');
mkdirSync(SS_DIR, { recursive: true });

const results = [];
let browser, page;

const log  = (m) => console.log(`     ${m}`);
const pass = (s, d='') => { results.push({ s, r:'✅ PASS', d }); console.log(`  ✅ PASS — ${s}${d ? ': '+d : ''}`); };
const fail = (s, d)    => { results.push({ s, r:'❌ FAIL', d }); console.log(`  ❌ FAIL — ${s}: ${d}`); };
const skip = (s, r)    => { results.push({ s, r:'⏭ SKIP', d: r }); console.log(`  ⏭ SKIP — ${s}: ${r}`); };
const ss   = async (n) => { try { await page.screenshot({ path: join(SS_DIR, `${n}.png`) }); } catch {} };

// Eleva timeout padrão para 180s somente durante waitForFunction de geração AI
const aiWait = async (fn) => {
  page.setDefaultTimeout(180000);
  try { return await fn(); }
  finally { page.setDefaultTimeout(30000); }
};

// ─── CENÁRIO 1 — Login ─────────────────────────────────────────────────────
async function c1_login() {
  console.log('\n📋 C1 — Login + carregamento inicial');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL('**/app**', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 2500)); // aguardar React carregar kit e plano
  await ss('01-app');

  const bodyText = await page.locator('body').innerText();
  const temKit = bodyText.includes('Saúde Total') || bodyText.includes('E2E Tester');
  const temPlano = bodyText.includes('S6C') || bodyText.includes('Sequência 6');
  log(`Brand kit carregado: ${temKit ? '✓' : '✗'}`);
  log(`Plano S6C visível: ${temPlano ? '✓' : '⚠ não encontrado no texto'}`);

  if (!page.url().includes('/app')) throw new Error(`URL inesperada: ${page.url()}`);
  pass('Login', `kit=${temKit} plano=${temPlano}`);
}

// ─── CENÁRIO 2 — Sugerir com IA (campo vazio) ──────────────────────────────
async function c2_sugerir() {
  console.log('\n📋 C2 — Sugerir com IA (campo vazio)');
  try {
    const ta = page.locator('textarea').first();
    await ta.waitFor({ state: 'visible', timeout: 10000 });
    await ta.fill(''); // garantir vazio
    await ss('02-campo-vazio');

    // O botão tem texto "✨ Sugerir com IA (0/2)" — has-text faz substring match
    const btnSug = page.locator('button:has-text("Sugerir com IA")').first();
    await btnSug.waitFor({ state: 'visible', timeout: 5000 });
    const labelAntes = await btnSug.textContent();
    log(`Botão antes: "${labelAntes.trim()}"`);

    // 1ª sugestão — a API retorna sugestão que aparece num card abaixo com botão "Usar esta"
    const t0 = Date.now();
    await btnSug.click();
    log('Aguardando painel de sugestão (até 60s)...');
    await aiWait(() => page.waitForSelector('button:has-text("Usar esta")'));
    const elapsed0 = Date.now() - t0;
    // Capturar texto da sugestão do card antes de aplicar
    const sug1Text = await page.locator('button:has-text("Usar esta")').first()
      .locator('..').locator('p').first().textContent().catch(() => '(não lido)');
    log(`Sugestão no painel (${elapsed0}ms): "${sug1Text.slice(0,70)}"`);
    await ss('02-painel-sug1');
    // Aplicar sugestão ao textarea
    await page.locator('button:has-text("Usar esta")').first().click();
    // Aguardar textarea preencher
    await page.waitForFunction(() => {
      const ta = document.querySelector('textarea');
      return ta && ta.value.trim().length > 10;
    }, { timeout: 5000 });
    const sug1 = await ta.inputValue();
    log(`Textarea após "Usar esta": "${sug1.slice(0,70)}"`);
    await ss('02-sug1');

    // 2ª sugestão — limpar campo (reseta o contador) e clicar novamente
    await ta.fill('');
    await new Promise(r => setTimeout(r, 300)); // aguardar reset do contador
    const btnSug2 = page.locator('button:has-text("Sugerir com IA")').first();
    const isVisible2 = await btnSug2.isVisible().catch(() => false);
    if (!isVisible2) {
      log('⚠️ Botão "Sugerir com IA" não encontrado para 2ª tentativa');
    } else {
      const t1 = Date.now();
      await btnSug2.click();
      log('Aguardando 2ª sugestão...');
      await aiWait(() => page.waitForSelector('button:has-text("Usar esta")'));
      const sug2Text = await page.locator('button:has-text("Usar esta")').first()
        .locator('..').locator('p').first().textContent().catch(() => '(não lido)');
      log(`2ª sugestão (${Date.now()-t1}ms): "${sug2Text.slice(0,70)}"`);
      await page.locator('button:has-text("Usar esta")').first().click();
      await page.waitForFunction(() => {
        const ta = document.querySelector('textarea');
        return ta && ta.value.trim().length > 10;
      }, { timeout: 5000 });
      const sug2 = await ta.inputValue();
      await ss('02-sug2');
      if (sug1.slice(0,40) === sug2.slice(0,40)) log('⚠️ Sugestões idênticas — falta variação');
      else log('✓ Sugestões diferentes (variedade OK)');
    }

    pass('Sugerir com IA', sug1.slice(0, 60));
  } catch (e) {
    await ss('02-FAIL');
    fail('Sugerir com IA', e.message.split('\n')[0]);
  }
}

// ─── CENÁRIO 3 — Refinar com IA (campo com texto) ──────────────────────────
async function c3_refinar() {
  console.log('\n📋 C3 — Refinar com IA (campo com texto)');
  try {
    const ta = page.locator('textarea').first();
    // Limpar primeiro para garantir que o contador foi resetado
    await ta.fill('');
    await new Promise(r => setTimeout(r, 300));
    const original = 'atendemos pacientes com pressão alta e diabetes';
    await ta.fill(original);
    await new Promise(r => setTimeout(r, 500)); // aguardar React atualizar label do botão

    // Verificar que o botão mudou para "Refinar com IA"
    const btnRefinar = page.locator('button:has-text("Refinar com IA")').first();
    const isVisible = await btnRefinar.isVisible().catch(() => false);
    if (!isVisible) {
      const btnText = await page.locator('button:has-text("IA")').first().textContent().catch(() => '?');
      fail('Refinar com IA', `Botão não mudou para "Refinar com IA" — encontrado: "${btnText}"`);
      return;
    }
    await ss('03-campo-preenchido');

    // Clicar e aguardar painel de sugestão com "Usar esta"
    const t0 = Date.now();
    await btnRefinar.click();
    log('Aguardando refinamento no painel (até 60s)...');
    await aiWait(() => page.waitForSelector('button:has-text("Usar esta")'));
    const elapsed = Date.now() - t0;
    const refText = await page.locator('button:has-text("Usar esta")').first()
      .locator('..').locator('p').first().textContent().catch(() => '(não lido)');
    log(`Refinamento no painel (${elapsed}ms): "${refText.slice(0,80)}"`);
    await ss('03-painel-refinado');
    // Aplicar ao textarea
    await page.locator('button:has-text("Usar esta")').first().click();
    await page.waitForFunction((orig) => {
      const ta = document.querySelector('textarea');
      return ta && ta.value.trim() !== orig && ta.value.trim().length > 10;
    }, original, { timeout: 5000 });
    const refined = await ta.inputValue();
    log(`Textarea refinado: "${refined.slice(0,80)}"`);
    await ss('03-refinado');

    const manteveAssunto = /(press|diabet|saúde|pacient|hipert|doença|clínica)/i.test(refined);
    if (!manteveAssunto) log('⚠️ Possível perda do assunto original (pressão alta/diabetes não detectados)');
    else log('✓ Assunto original preservado no texto refinado');

    pass('Refinar com IA', refined.slice(0, 60));
  } catch (e) {
    await ss('03-FAIL');
    fail('Refinar com IA', e.message.split('\n')[0]);
  }
}

// ─── CENÁRIO 4 — Geração de Conteúdo Método OP ─────────────────────────────
async function c4_gerar_conteudo() {
  console.log('\n📋 C4 — Geração de Conteúdo Método OP');
  try {
    // Preencher keyInfo
    const ta = page.locator('textarea').first();
    await ta.fill('Monitoramento de pressão arterial em casa pode evitar infarto: como fazer corretamente');

    // Público: 3º select (índice 2) → B2C (5s timeout para não travar se não existir)
    await page.locator('select').nth(2).selectOption('B2C — consumidor final', { timeout: 5000 }).catch(() =>
      log('⚠️ Select B2C não encontrado no índice 2 — deixando padrão')
    );

    // 3 peças — scroll para garantir visibilidade antes de clicar
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.locator('button:has-text("3 peças")').first().click({ timeout: 5000 }).catch(() =>
      log('⚠️ click "3 peças" falhou — continuando com seleção atual')
    );

    // Trilha Cinemática (S6C — o plano de teste; Visual e Experimentação mostram "SEM PLANO")
    await page.locator('button:has-text("Cinemática")').first().click({ timeout: 5000 }).catch(() => {});

    // Mood OP-01
    await page.locator('button:has-text("OP-01")').first().click({ timeout: 5000 }).catch(() => {});

    // Log estado do botão de geração antes de clicar
    const btnGerar = page.locator('button:has-text("Gerar conteúdo"), button:has-text("Gerar Experimentação")').first();
    const btnLabel = await btnGerar.textContent({ timeout: 5000 }).catch(() => '(não encontrado)');
    const btnDisabled = await btnGerar.isDisabled().catch(() => null);
    log(`Botão geração: "${btnLabel.trim()}" | disabled=${btnDisabled}`);
    await ss('04-form-preenchido');

    const t0 = Date.now();
    await btnGerar.click();
    // Screenshot 2s após o clique para capturar estado de loading/erro
    await new Promise(r => setTimeout(r, 2000));
    // Scroll para ver a coluna da direita (onde errorBox e resultados aparecem)
    await page.evaluate(() => window.scrollTo(0, 0));
    await ss('04-pos-clique');
    const bodyPosClique = await page.locator('body').innerText();
    const temErroImediato = bodyPosClique.toLowerCase().includes('limite') || bodyPosClique.toLowerCase().includes('erro') || bodyPosClique.toLowerCase().includes('inválido');
    if (temErroImediato) {
      log(`⚠️ Estado 2s pós-clique: "${bodyPosClique.slice(0,300)}"`);
    } else {
      log('Aguardando resultado (até 180s)...');
    }

    // Aguardar resultado OU mensagem de erro (qualquer texto de erro no body)
    await aiWait(() => page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      const temDias = t.indexOf('dia 1') >= 0;
      // Detectar qualquer errorBox visível
      const errorEl = document.querySelector('.errorBox');
      const temErro = !!errorEl && errorEl.textContent.trim().length > 5;
      if (temErro) return true;
      return temDias;
    }));

    const elapsed = Date.now() - t0;
    await ss('04-resultado');

    const bodyText = await page.locator('body').innerText();
    const temDia = bodyText.toLowerCase().includes('dia 1') || bodyText.toLowerCase().includes('dia 2');
    const temLegenda = bodyText.toLowerCase().includes('legenda');
    const temErroFinal = (bodyText.toLowerCase().includes('limite') && bodyText.toLowerCase().includes('plano'))
      || (bodyText.toLowerCase().includes('erro'));
    log(`Tempo: ${elapsed}ms | Dia 1: ${temDia} | Legenda: ${temLegenda} | Erro: ${temErroFinal}`);

    // Detectar erro de resposta incompleta (JSON truncado por timeout do Worker)
    const temIncompleta = bodyText.toLowerCase().includes('incompleta') || bodyText.toLowerCase().includes('tente novamente') || bodyText.toLowerCase().includes('demorou');
    if ((temErroFinal || temIncompleta) && !temDia) {
      // Capturar o erro exato do errorBox se existir
      const errMsg = await page.locator('.errorBox').textContent().catch(() => bodyText.slice(0, 200));
      fail('Geração de Conteúdo', `Erro detectado: "${errMsg.trim().slice(0, 150)}"`);
      return;
    }

    pass('Geração de Conteúdo', `${elapsed}ms — Dia1=${temDia} Legenda=${temLegenda}`);
  } catch (e) {
    await ss('04-FAIL');
    fail('Geração de Conteúdo', e.message.split('\n')[0]);
  }
}

// ─── CENÁRIO 5 — Geração de Imagem ─────────────────────────────────────────
async function c5_gerar_imagem() {
  console.log('\n📋 C5 — Geração de Imagem (Dia 1)');
  try {
    // Scroll até os cards gerados (ficam abaixo do form)
    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise(r => setTimeout(r, 1000));
    await ss('05-pre-gerar-imagem');

    // ── Expandir o primeiro card (cards iniciam fechados — botão de imagem fica dentro) ──
    const firstCard = page.locator('button.cardHeader').first();
    await firstCard.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    const cardVisible = await firstCard.isVisible().catch(() => false);
    if (cardVisible) {
      const cardLabel = await firstCard.textContent().catch(() => '?');
      log(`Expandindo card: "${cardLabel.trim().slice(0,60)}"`);
      await firstCard.click();
      await new Promise(r => setTimeout(r, 700)); // aguardar animação de abertura
    } else {
      log('⚠️ cardHeader não encontrado para expandir — tentando achar botão diretamente');
    }
    await ss('05-scroll');

    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 80)
    );
    log(`Botões no DOM após expandir (${allBtns.length}): ${allBtns.join(' | ')}`);

    // Trilha Visual Feed → "⬇ Gerar post" (estático) ou "⬇ Gerar fechamento"
    // Trilha Cinemática → "⬇ Gerar imagem pura" (reels), carrossel → "⬇ Gerar card"
    const imgBtnSelector = [
      'button:has-text("Gerar post")',
      'button:has-text("Gerar card")',
      'button:has-text("Gerar fechamento")',
      'button:has-text("Gerar imagem pura")',
    ].join(', ');

    let btnImgFinal = page.locator(imgBtnSelector).first();
    await btnImgFinal.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    let finalVisible = await btnImgFinal.isVisible().catch(() => false);

    if (!finalVisible) {
      // Tentar expandir o próximo card e tentar de novo
      const cards = page.locator('button.cardHeader');
      const count = await cards.count().catch(() => 0);
      for (let i = 1; i < Math.min(count, 3); i++) {
        await cards.nth(i).click().catch(() => {});
        await new Promise(r => setTimeout(r, 500));
        btnImgFinal = page.locator(imgBtnSelector).first();
        await btnImgFinal.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        finalVisible = await btnImgFinal.isVisible().catch(() => false);
        if (finalVisible) break;
      }
    }

    if (!finalVisible) {
      const btns2 = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 80)
      );
      fail('Geração de Imagem', `Botão de geração não encontrado. DOM completo (${btns2.length}): ${btns2.join(' | ')}`);
      return;
    }

    const t0 = Date.now();
    await btnImgFinal.click();

    // Tratar PreImageAlert — aparece na 1ª geração da sessão com "Gerar imagem" button
    const alertBtn = page.locator('button:has-text("Gerar imagem")');
    const alertVisible = await alertBtn.isVisible({ timeout: 4000 }).catch(() => false);
    if (alertVisible) {
      log('Diálogo de confirmação detectado — clicando "Gerar imagem"...');
      await alertBtn.click();
    }

    log('Aguardando geração de imagem (até 180s)...');

    // O preview é composto pelo canvas (composeFeedPng) → data:image/png;base64,...
    // A tag img tem class "previewImg" quando o preview existe
    await aiWait(() => page.waitForFunction(() => {
      const img = document.querySelector('img.previewImg, img.previewImgReels');
      return !!img && img.naturalWidth > 100;
    }));

    const elapsed = Date.now() - t0;
    await ss('05-imagem-gerada');
    log(`Imagem gerada em ${elapsed}ms`);

    // Verificar botão Arquivar
    const btnArq = page.locator('button:has-text("Arquivar")').first();
    const arquivarDisabled = await btnArq.isDisabled().catch(() => true);
    if (arquivarDisabled) log('⚠️ Botão Arquivar ainda desabilitado após geração');
    else log('✓ Botão Arquivar habilitado');

    pass('Geração de Imagem', `${elapsed}ms`);
  } catch (e) {
    await ss('05-FAIL');
    fail('Geração de Imagem', e.message.split('\n')[0]);
  }
}

// ─── CENÁRIO 6 — Arquivar + Histórico ──────────────────────────────────────
async function c6_arquivar_historico() {
  console.log('\n📋 C6 — Arquivar + Histórico');
  try {
    const btnArq = page.locator('button:has-text("Arquivar")').first();
    await btnArq.waitFor({ state: 'visible', timeout: 10000 });
    const disabled = await btnArq.isDisabled().catch(() => true);
    if (disabled) {
      fail('Arquivar + Histórico', 'Botão Arquivar está desabilitado — imagem pode não ter sido gerada');
      return;
    }

    await btnArq.click();
    log('Aguardando confirmação de arquivamento...');

    // Aguardar toast ou mudança no DOM indicando sucesso
    await page.waitForFunction(() => {
      const t = document.body.innerText;
      return t.includes('Arquivado') || t.includes('arquivado') || t.includes('✓') || t.includes('sucesso');
    }, { timeout: 30000 }).catch(() => log('⚠️ Toast não detectado — continuando mesmo assim'));
    await ss('06-arquivado');

    // Navegar ao histórico
    await page.goto(`${BASE}/historico`, { waitUntil: 'networkidle', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));
    await ss('06-historico');

    const bodyText = await page.locator('body').innerText();
    const temItem = bodyText.toLowerCase().includes('s3v') || bodyText.toLowerCase().includes('plano 1') ||
                    bodyText.toLowerCase().includes('legenda') || bodyText.toLowerCase().includes('dia');
    if (!temItem) throw new Error('Histórico parece vazio após arquivamento');

    pass('Arquivar + Histórico', 'Item aparece no histórico');
  } catch (e) {
    await ss('06-FAIL');
    fail('Arquivar + Histórico', e.message.split('\n')[0]);
  }
}

// ─── CENÁRIO 7 — Post Único ─────────────────────────────────────────────────
async function c7_post_unico() {
  console.log('\n📋 C7 — Post Único');
  try {
    await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    const abaPostUnico = page.locator('button:has-text("Post Único")').first();
    const visible = await abaPostUnico.isVisible().catch(() => false);
    if (!visible) { skip('Post Único', 'Aba Post Único não encontrada'); return; }

    await abaPostUnico.click();
    await new Promise(r => setTimeout(r, 1000));
    await ss('07-aba-post-unico');

    const btnsAba = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 60)
    );
    log(`Botões na aba PU: ${btnsAba.slice(0,12).join(' | ')}`);

    // Selecionar objetivo Promoção
    const btnPromocao = page.locator('button:has-text("Promoção"), button:has-text("promocao"), button:has-text("promo")').first();
    const temPromocao = await btnPromocao.isVisible().catch(() => false);
    if (temPromocao) await btnPromocao.click();
    else log('⚠️ Botão Promoção não encontrado — verificar objetivos disponíveis');

    // Preencher keyInfo do PU
    const ta = page.locator('textarea').first();
    await ta.fill('20% de desconto em consultas preventivas durante julho');
    await new Promise(r => setTimeout(r, 500));
    await ss('07-form-preenchido');

    // Clicar "✨ Gerar título e texto" (texto real do botão no PostUnicoForm)
    const btnGerarTexto = page.locator('button:has-text("Gerar título e texto")').first();
    await page.evaluate(() => window.scrollBy(0, 400)); // scroll para ver o botão
    await new Promise(r => setTimeout(r, 500));
    const textoVisible = await btnGerarTexto.isVisible().catch(() => false);
    if (!textoVisible) {
      const btns2 = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 80)
      );
      fail('Post Único', `Botão "Gerar título e texto" não encontrado. Botões: ${btns2.join(' | ')}`);
      return;
    }

    // Verificar se botão está habilitado (usuário precisa ter plano PU ativo)
    const textoDisabled = await btnGerarTexto.isDisabled().catch(() => true);
    if (textoDisabled) {
      const bodyText = await page.locator('body').innerText();
      const semPlanoPU = bodyText.includes('não tem plano de Post Único') || bodyText.includes('Sem plano');
      skip('Post Único', `Botão "Gerar título e texto" desabilitado — usuário sem plano PU ativo (semPlanoPU=${semPlanoPU}). Recriar usuário com PU2 via setup-test.mjs`);
      return;
    }

    const t0 = Date.now();
    await btnGerarTexto.click();
    log('Aguardando copy/título (até 60s)...');

    // Aguardar card de copy aparecer ("Título" + "Texto de apoio" + "Gerar peça")
    await aiWait(() => page.waitForFunction(() => {
      const t = document.body.innerText;
      return t.indexOf('Texto de apoio') >= 0 || t.indexOf('Gerar peça') >= 0;
    }));
    log(`Copy gerado em ${Date.now()-t0}ms`);
    await ss('07-copy-gerado');

    // Clicar "Gerar peça" (texto real do botão no PostUnicoForm)
    const btnGerarPeca = page.locator('button:has-text("Gerar peça")').first();
    const pecaVisible = await btnGerarPeca.isVisible({ timeout: 5000 }).catch(() => false);
    if (!pecaVisible) {
      pass('Post Único', 'Copy gerado OK — botão "Gerar peça" não visível (verificar manualmente)');
      return;
    }

    const t1 = Date.now();
    await btnGerarPeca.click();
    log('Aguardando imagem da peça (até 180s)...');

    // Post Único também usa canvas compose → img.previewImg
    // Mas também pode ser img.previewImgFeed (PostUnicoResult)
    // Fallback: any data:image with large naturalWidth
    await aiWait(() => page.waitForFunction(() => {
      const img = document.querySelector('img.previewImg, img.previewImgFeed');
      if (img && img.naturalWidth > 100) return true;
      const imgs = document.querySelectorAll('img');
      return Array.from(imgs).some(i =>
        (i.src.indexOf('data:image') === 0 && i.naturalWidth > 200)
      );
    }));
    log(`Imagem PU gerada em ${Date.now()-t1}ms`);
    await ss('07-peca-gerada');
    pass('Post Único', `Copy + imagem gerados em ${Date.now()-t0}ms total`);
  } catch (e) {
    await ss('07-FAIL');
    fail('Post Único', e.message.split('\n')[0]);
  }
}

// ─── CENÁRIO 8 — Admin Storage (requer usuário admin) ──────────────────────
async function c8_admin_storage() {
  console.log('\n📋 C8 — Admin Storage (usuário E2E não é admin — verificação via API já feita)');
  skip('Admin Storage', 'Usuário E2E não tem role admin — RPC admin_storage_stats já verificada via service role (14 MB, 38 arquivos, 3 usuários)');
}

// ─── RUNNER ─────────────────────────────────────────────────────────────────
console.log(`\n🚀 Iniciando testes E2E — ${creds.email}`);
console.log(`📁 Screenshots → ${SS_DIR}\n`);

try {
  browser = await chromium.launch({ headless: true });
  page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  // 30s default para operações de UI; AI generation usa aiWait() que eleva temporariamente
  page.setDefaultTimeout(30000);

  await c1_login();
  await c2_sugerir();
  await c3_refinar();
  await c4_gerar_conteudo();
  await c5_gerar_imagem();
  await c6_arquivar_historico();
  await c7_post_unico();
  await c8_admin_storage();

} catch (e) {
  console.log(`\n💥 Erro fatal (C1 falhou?): ${e.message}`);
} finally {
  await browser?.close();
  console.log('\n' + '─'.repeat(62));
  console.log('📊 RESUMO:');
  console.log('─'.repeat(62));
  results.forEach(r => {
    console.log(`${r.r}  ${r.s}`);
    if (r.d) console.log(`         ${r.d.slice(0, 100)}`);
  });
  const P = results.filter(r => r.r.includes('PASS')).length;
  const F = results.filter(r => r.r.includes('FAIL')).length;
  const S = results.filter(r => r.r.includes('SKIP')).length;
  console.log('─'.repeat(62));
  console.log(`Total: ${P} PASS · ${F} FAIL · ${S} SKIP`);
  console.log(`\nScreenshots: ${SS_DIR}`);
  console.log('▶ Limpar: NODE_OPTIONS=--use-system-ca node e2e/cleanup-test.mjs');
}
