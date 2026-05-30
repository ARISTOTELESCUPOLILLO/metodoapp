import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, ShieldCheck, Mail } from 'lucide-react';
import logoOp from '@/assets/lp-logo-op.png';

const EMAIL = 'contato@oficinadepropaganda.com.br';
const LAST_UPDATE = '14/05/2026';

export const Route = createFileRoute('/privacidade')({
  head: () => ({
    meta: [
      { title: 'Política de Privacidade — Método OP' },
      { name: 'description', content: 'Como a Oficina de Propaganda trata os dados pessoais dos usuários do Método OP, em conformidade com a LGPD.' },
    ],
  }),
  component: PrivacidadePage,
});

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-white font-bold text-lg mt-8 first:mt-0">{children}</h3>;
}

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#070e1d] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#070e1d] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <Link to="/">
            <img src={logoOp} alt="Método OP" className="h-8 w-auto" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={15} /> Início
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-3xl mx-auto px-5 py-12 md:py-16">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck size={22} className="text-[#f5a623] shrink-0" />
          <h1 className="text-2xl md:text-3xl font-bold">Política de Privacidade</h1>
        </div>
        <p className="text-xs text-white/40 mb-10">Última atualização: {LAST_UPDATE}</p>

        <div className="text-[15px] leading-relaxed text-white/80 space-y-4">
          <p>
            Esta Política descreve como a <strong>Oficina de Propaganda</strong> (CNPJ
            03.834.539/0001-34), responsável pelo aplicativo <strong>Método OP</strong>, trata os
            dados pessoais coletados, em conformidade com a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018 — LGPD).
          </p>

          <H3>1. Quem somos</H3>
          <p>
            Oficina de Propaganda · CNPJ 03.834.539/0001-34. Contato:{' '}
            <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">{EMAIL}</a>
            {' '}· WhatsApp +55 66 99988-1627.
          </p>

          <H3>2. Dados que coletamos</H3>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Cadastro:</strong> nome, e-mail, empresa, telefone.</li>
            <li><strong>Uso do app:</strong> peças geradas, preferências de marca e configurações.</li>
            <li><strong>Técnicos:</strong> endereço IP, identificador de navegador e cookies.</li>
          </ul>

          <H3>3. Finalidades</H3>
          <p>
            Operar o aplicativo, autenticar acesso, gerar conteúdo personalizado, melhorar o
            serviço e cumprir obrigações legais e contratuais.
          </p>

          <H3>4. Base legal</H3>
          <p>
            Execução de contrato, consentimento, legítimo interesse e cumprimento de obrigação
            legal, conforme o caso.
          </p>

          <H3>5. Compartilhamento</H3>
          <p>
            Compartilhamos dados apenas com provedores de infraestrutura em nuvem e provedores
            de inteligência artificial usados para gerar conteúdo, sempre sob contrato e
            estritamente para viabilizar o serviço. <strong>Nunca vendemos seus dados.</strong>
          </p>

          <H3>6. Armazenamento e segurança</H3>
          <p>
            Os dados ficam em servidores em nuvem com criptografia em trânsito (HTTPS) e
            controles de acesso. Aplicamos boas práticas de segurança para reduzir riscos.
          </p>

          <H3>7. Retenção</H3>
          <p>
            Mantemos os dados enquanto a conta estiver ativa e por até 24 meses após o
            encerramento, salvo obrigação legal de prazo distinto.
          </p>

          <H3>8. Direitos do titular</H3>
          <p>
            Você pode solicitar acesso, correção, portabilidade, exclusão, revogação de
            consentimento e oposição ao tratamento. Faça o pedido por e-mail para{' '}
            <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">{EMAIL}</a>.
          </p>

          <H3>9. Cookies</H3>
          <p>
            Usamos cookies necessários, funcionais e (com seu consentimento) analíticos.
            Detalhes na nossa{' '}
            <Link to="/privacidade" className="text-[#f5a623] hover:underline font-semibold">
              Política de Privacidade
            </Link>
            . Você pode gerenciar suas preferências a qualquer momento pelo banner de
            consentimento ou pelas configurações do navegador.
          </p>

          <H3>10. Atualizações</H3>
          <p>
            Esta política pode ser atualizada periodicamente. Mudanças relevantes serão
            comunicadas no aplicativo.
          </p>

          <H3>11. Encarregado (DPO)</H3>
          <p>
            Contato do encarregado pelo tratamento de dados:{' '}
            <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">{EMAIL}</a>.
          </p>
        </div>

        {/* CTA de contato */}
        <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Mail size={20} className="text-[#f5a623] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Dúvidas sobre seus dados?</p>
            <p className="text-sm text-white/60 mt-0.5">
              Entre em contato pelo e-mail{' '}
              <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">{EMAIL}</a>.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/30">
        <div className="max-w-3xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Oficina de Propaganda · CNPJ 03.834.539/0001-34</span>
          <div className="flex items-center gap-4">
            <Link to="/termos" className="hover:text-white/60 transition-colors">Termos de Serviço</Link>
            <Link to="/privacidade" className="hover:text-white/60 transition-colors">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
