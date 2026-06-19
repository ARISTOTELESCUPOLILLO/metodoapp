import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import logoOp from "@/assets/lp-logo-op.png";

const EMAIL = "contato@oficinadepropaganda.com.br";
const LAST_UPDATE = "14/05/2026";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço — Método OP" },
      {
        name: "description",
        content: "Termos e condições de uso do aplicativo Método OP, da Oficina de Propaganda.",
      },
    ],
  }),
  component: TermosPage,
});

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-white font-bold text-lg mt-8 first:mt-0">{children}</h3>;
}

function TermosPage() {
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
          <FileText size={22} className="text-[#f5a623] shrink-0" />
          <h1 className="text-2xl md:text-3xl font-bold">Termos de Serviço</h1>
        </div>
        <p className="text-xs text-white/40 mb-10">Última atualização: {LAST_UPDATE}</p>

        <div className="text-[15px] leading-relaxed text-white/80 space-y-4">
          <p>
            Ao acessar ou usar o <strong>Método OP</strong>, você concorda com estes Termos de
            Serviço. Leia com atenção antes de usar o aplicativo.
          </p>

          <H3>1. Partes</H3>
          <p>
            <strong>Fornecedor:</strong> Oficina de Propaganda, CNPJ 03.834.539/0001-34, com sede em
            Mato Grosso, Brasil. Contato:{" "}
            <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
              {EMAIL}
            </a>{" "}
            · WhatsApp +55 66 99988-1627.
          </p>
          <p>
            <strong>Usuário:</strong> pessoa física ou jurídica que acessa o aplicativo Método OP
            mediante convite e ativação de plano.
          </p>

          <H3>2. Objeto</H3>
          <p>
            O Método OP é um aplicativo de apoio à produção de conteúdo digital, que oferece geração
            de textos, imagens e sequências estratégicas para comunicação de marcas no Instagram,
            com base em metodologia proprietária da Oficina de Propaganda.
          </p>

          <H3>3. Acesso e cadastro</H3>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>O acesso é restrito a usuários convidados e com plano ativo.</li>
            <li>O usuário é responsável pela confidencialidade de suas credenciais.</li>
            <li>Cada conta é pessoal e intransferível.</li>
            <li>O fornecedor pode revogar o acesso em caso de uso indevido.</li>
          </ul>

          <H3>4. Planos e limites de uso</H3>
          <p>
            O Método OP opera por planos com cotas de gerações de conteúdo e imagens definidas no
            momento da contratação. O não uso dentro do período de vigência não gera crédito,
            reembolso ou extensão automática. Cotas adicionais podem ser contratadas conforme
            disponibilidade.
          </p>

          <H3>5. Uso aceito</H3>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              O aplicativo deve ser usado exclusivamente para fins comerciais lícitos do negócio do
              usuário.
            </li>
            <li>O conteúdo gerado pode ser publicado nas redes sociais da marca do usuário.</li>
            <li>
              O usuário é responsável pela revisão e adequação do conteúdo gerado antes da
              publicação.
            </li>
          </ul>

          <H3>6. Uso proibido</H3>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Revenda, sublicenciamento ou compartilhamento de acesso com terceiros não autorizados.
            </li>
            <li>
              Uso para gerar conteúdo ilegal, difamatório, discriminatório ou que viole direitos de
              terceiros.
            </li>
            <li>Engenharia reversa, cópia ou extração da metodologia e dos prompts do sistema.</li>
            <li>Uso automatizado (bots, scripts) sem autorização expressa.</li>
          </ul>

          <H3>7. Propriedade intelectual</H3>
          <p>
            A metodologia, os prompts, os fluxos e a interface do Método OP são propriedade
            exclusiva da Oficina de Propaganda. O conteúdo gerado (textos e imagens) pertence ao
            usuário que o produziu, com plena responsabilidade pelo uso.
          </p>

          <H3>8. Disponibilidade e limitação de responsabilidade</H3>
          <p>
            O serviço é prestado em regime de "melhor esforço". O fornecedor não garante
            disponibilidade ininterrupta, nem é responsável por perdas decorrentes de falhas em
            serviços de terceiros (provedores de IA, infraestrutura em nuvem, redes sociais). O
            conteúdo gerado por inteligência artificial deve ser revisado pelo usuário antes do uso;
            o fornecedor não se responsabiliza por imprecisões ou inadequações.
          </p>

          <H3>9. Suspensão e cancelamento</H3>
          <p>
            O fornecedor pode suspender ou cancelar o acesso, sem aviso prévio, em caso de violação
            destes Termos. O usuário pode solicitar o encerramento da conta a qualquer momento pelo
            e-mail{" "}
            <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
              {EMAIL}
            </a>
            . Dados serão tratados conforme a{" "}
            <Link to="/privacidade" className="text-[#f5a623] hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>

          <H3>10. Alterações dos termos</H3>
          <p>
            Estes Termos podem ser atualizados a qualquer momento. O uso contínuo do serviço após
            notificação implica aceitação das novas condições.
          </p>

          <H3>11. Lei aplicável e foro</H3>
          <p>
            Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de
            Barra do Garças/MT para dirimir eventuais conflitos, ressalvada a opção pelo Juizado
            Especial competente.
          </p>

          <H3>12. Contato</H3>
          <p>
            Dúvidas ou reclamações:{" "}
            <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
              {EMAIL}
            </a>{" "}
            · WhatsApp +55 66 99988-1627 · Seg–Sex · 8h–18h.
          </p>
        </div>

        {/* CTA de contato */}
        <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Mail size={20} className="text-[#f5a623] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Dúvidas sobre os termos?</p>
            <p className="text-sm text-white/60 mt-0.5">
              Fale pelo e-mail{" "}
              <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
                {EMAIL}
              </a>{" "}
              ou pelo WhatsApp +55 66 99988-1627.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/30">
        <div className="max-w-3xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Oficina de Propaganda · CNPJ 03.834.539/0001-34</span>
          <div className="flex items-center gap-4">
            <Link to="/termos" className="hover:text-white/60 transition-colors">
              Termos de Serviço
            </Link>
            <Link to="/privacidade" className="hover:text-white/60 transition-colors">
              Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
