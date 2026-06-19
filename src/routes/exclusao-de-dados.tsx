import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Trash2, Mail, CheckCircle } from "lucide-react";
import logoOp from "@/assets/lp-logo-op.png";

const EMAIL = "contato@oficinadepropaganda.com.br";
const LAST_UPDATE = "14/05/2026";

export const Route = createFileRoute("/exclusao-de-dados")({
  head: () => ({
    meta: [
      { title: "Exclusão de Dados — Método OP" },
      {
        name: "description",
        content:
          "Saiba como solicitar a exclusão dos seus dados pessoais do aplicativo Método OP, da Oficina de Propaganda.",
      },
    ],
  }),
  component: ExclusaoDadosPage,
});

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-white font-bold text-lg mt-8 first:mt-0">{children}</h3>;
}

function ExclusaoDadosPage() {
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
          <Trash2 size={22} className="text-[#f5a623] shrink-0" />
          <h1 className="text-2xl md:text-3xl font-bold">Exclusão de Dados</h1>
        </div>
        <p className="text-xs text-white/40 mb-10">Última atualização: {LAST_UPDATE}</p>

        <div className="text-[15px] leading-relaxed text-white/80 space-y-4">
          <p>
            A <strong>Oficina de Propaganda</strong> (CNPJ 03.834.539/0001-34), responsável pelo
            aplicativo <strong>Método OP</strong>, respeita o seu direito à exclusão de dados
            pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº
            13.709/2018) e com as políticas da Meta Platforms.
          </p>

          <H3>Quais dados coletamos</H3>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Nome e endereço de e-mail de cadastro.</li>
            <li>Dados da empresa (nome e atividade principal).</li>
            <li>Peças e conteúdos gerados dentro do aplicativo.</li>
            <li>Configurações de kit de marca (cores, fontes, logotipo).</li>
            <li>Dados técnicos de acesso (IP, identificador de sessão, cookies).</li>
          </ul>

          <H3>Como solicitar a exclusão</H3>
          <p>
            Envie um e-mail para{" "}
            <a
              href={`mailto:${EMAIL}?subject=Solicitação de exclusão de dados — Método OP`}
              className="text-[#f5a623] hover:underline"
            >
              {EMAIL}
            </a>{" "}
            com o assunto <strong>"Solicitação de exclusão de dados — Método OP"</strong> e inclua:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>O e-mail cadastrado na sua conta.</li>
            <li>O nome completo do titular da conta.</li>
            <li>Se desejar, o motivo da solicitação (opcional).</li>
          </ul>

          <H3>O que acontece após a solicitação</H3>
          <div className="space-y-3">
            {[
              { step: "1", text: "Confirmamos o recebimento da solicitação em até 2 dias úteis." },
              {
                step: "2",
                text: "Verificamos a identidade do solicitante para garantir a segurança da exclusão.",
              },
              {
                step: "3",
                text: "Excluímos ou anonimizamos todos os dados pessoais associados à conta em até 15 dias úteis.",
              },
              { step: "4", text: "Enviamos confirmação por e-mail ao término do processo." },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#f5a623]/15 border border-[#f5a623]/30 text-[#f5a623] text-xs font-bold flex items-center justify-center mt-0.5">
                  {step}
                </span>
                <p className="text-white/75">{text}</p>
              </div>
            ))}
          </div>

          <H3>Dados que podem ser retidos</H3>
          <p>
            Alguns dados podem ser mantidos por prazo adicional quando houver obrigação legal (ex.:
            registros fiscais e contábeis exigidos por lei) ou para defesa em processos judiciais ou
            administrativos em andamento. Nesses casos, informamos o motivo e o prazo de retenção na
            resposta à solicitação.
          </p>

          <H3>Exclusão de dados provenientes da Meta</H3>
          <p>
            Se você usou o login via Meta (Facebook/Instagram) para acessar o Método OP, o processo
            de exclusão acima remove todos os dados coletados por nosso aplicativo. Para revogar as
            permissões concedidas ao app na plataforma Meta, acesse:{" "}
            <a
              href="https://www.facebook.com/settings?tab=applications"
              target="_blank"
              rel="noreferrer"
              className="text-[#f5a623] hover:underline"
            >
              Configurações do Facebook → Aplicativos e Sites
            </a>
            .
          </p>

          <H3>Contato</H3>
          <p>
            Dúvidas sobre o tratamento ou exclusão dos seus dados:{" "}
            <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
              {EMAIL}
            </a>{" "}
            · WhatsApp +55 66 99988-1627 · Seg–Sex · 8h–18h.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 p-6 rounded-2xl bg-[#f5a623]/5 border border-[#f5a623]/20 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <CheckCircle size={22} className="text-[#f5a623] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Pronto para solicitar a exclusão?</p>
            <p className="text-sm text-white/60 mt-1">
              Envie um e-mail para{" "}
              <a
                href={`mailto:${EMAIL}?subject=Solicitação de exclusão de dados — Método OP`}
                className="text-[#f5a623] hover:underline font-semibold"
              >
                {EMAIL}
              </a>{" "}
              com o assunto <em>"Solicitação de exclusão de dados — Método OP"</em>.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link to="/privacidade" className="text-white/50 hover:text-[#f5a623] transition-colors">
            → Política de Privacidade
          </Link>
          <Link to="/termos" className="text-white/50 hover:text-[#f5a623] transition-colors">
            → Termos de Serviço
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="max-w-3xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <span>© {new Date().getFullYear()} Oficina de Propaganda · CNPJ 03.834.539/0001-34</span>
          <div className="flex items-center gap-4">
            <Link to="/termos" className="hover:text-white/60 transition-colors">
              Termos
            </Link>
            <Link to="/privacidade" className="hover:text-white/60 transition-colors">
              Privacidade
            </Link>
            <Link to="/exclusao-de-dados" className="hover:text-white/60 transition-colors">
              Exclusão de Dados
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
