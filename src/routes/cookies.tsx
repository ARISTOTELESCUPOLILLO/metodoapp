import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Cookie, Mail } from "lucide-react";
import { lsRemoveRaw } from "@/lib/storage/store";
import { COOKIE_CONSENT_KEY } from "@/lib/storage/keys";
import { CookiesContent } from "@/components/legal/CookiesContent";
import logoOp from "@/assets/lp-logo-op.png";

const EMAIL = "contato@oficinadepropaganda.com.br";
const LAST_UPDATE = "14/05/2026";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Política de Cookies — Método OP" },
      {
        name: "description",
        content:
          "Como o Método OP usa cookies e tecnologias similares, e como gerenciar suas preferências.",
      },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  const navigate = useNavigate();

  // O banner de consentimento mora na landing page, então revisar as preferências aqui
  // significa apagar a decisão salva e voltar para lá — mesma semântica do `reopenBanner`
  // da home, que também limpa a chave para o banner reaparecer.
  const revisarPreferencias = () => {
    lsRemoveRaw(COOKIE_CONSENT_KEY);
    void navigate({ to: "/" });
  };

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
          <Cookie size={22} className="text-[#f5a623] shrink-0" />
          <h1 className="text-2xl md:text-3xl font-bold">Política de Cookies</h1>
        </div>
        <p className="text-xs text-white/40 mb-10">Última atualização: {LAST_UPDATE}</p>

        <div className="text-[15px] leading-relaxed text-white/80 space-y-4">
          <CookiesContent onReviewPreferences={revisarPreferencias} />
        </div>

        {/* CTA de contato */}
        <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Mail size={20} className="text-[#f5a623] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Dúvidas sobre cookies?</p>
            <p className="text-sm text-white/60 mt-0.5">
              Entre em contato pelo e-mail{" "}
              <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
                {EMAIL}
              </a>
              .
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
