import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  MessageCircle,
  Mail,
  Clock,
  ArrowRight,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Smartphone,
  AtSign,
  ChevronDown,
  HelpCircle,
  X,
  Cookie,
  ShieldCheck,
} from "lucide-react";
import heroDesktop from "@/assets/lp-hero-desktop.png";
import heroMobile from "@/assets/lp-hero-mobile.png";
import logoOp from "@/assets/lp-logo-op.png";

const WHATSAPP_URL = "https://wa.me/5566999881627";
const EMAIL = "contato@oficinadepropaganda.com.br";
const HORARIO = "Seg–Sex · 8h–18h";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Método OP — Comunicação digital com direção" },
      {
        name: "description",
        content:
          "O Método OP organiza a produção de conteúdo da sua empresa com estratégia, imagens, textos e direção em um só fluxo. Mais organização, menos improviso.",
      },
      { property: "og:title", content: "Método OP — Comunicação digital com direção" },
      {
        property: "og:description",
        content:
          "Transforme sua presença digital em uma comunicação com direção. Conteúdos, imagens e estratégia em um só app.",
      },
    ],
  }),
  component: LandingPage,
});

type LegalKey = "privacy" | "cookies" | null;

function LandingPage() {
  const [legalOpen, setLegalOpen] = useState<LegalKey>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  // Mostra o banner apenas se ainda não houver decisão salva.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mop.cookie-consent");
      if (!saved) setBannerVisible(true);
    } catch {
      setBannerVisible(true);
    }
  }, []);

  const decideCookies = (status: "all" | "necessary") => {
    try {
      localStorage.setItem(
        "mop.cookie-consent",
        JSON.stringify({ status, ts: new Date().toISOString() }),
      );
    } catch {
      /* ignore */
    }
    setBannerVisible(false);
  };

  const reopenBanner = () => {
    try {
      localStorage.removeItem("mop.cookie-consent");
    } catch {
      /* ignore */
    }
    setLegalOpen(null);
    setBannerVisible(true);
  };

  return (
    <div className="min-h-screen bg-[#0a1326] text-white antialiased">
      <Header />
      <Hero />
      <Diferenciais />
      <FAQ />
      <ChamadaFinal />
      <Footer onOpenLegal={setLegalOpen} />

      <LegalDialog
        open={legalOpen === "privacy"}
        onClose={() => setLegalOpen(null)}
        title="Política de Privacidade"
        icon={<ShieldCheck size={20} />}
      >
        <PrivacyContent onOpenCookies={() => setLegalOpen("cookies")} />
      </LegalDialog>

      <LegalDialog
        open={legalOpen === "cookies"}
        onClose={() => setLegalOpen(null)}
        title="Política de Cookies"
        icon={<Cookie size={20} />}
      >
        <CookiesContent onReviewPreferences={reopenBanner} />
      </LegalDialog>

      {bannerVisible && (
        <CookieBanner
          onAcceptAll={() => decideCookies("all")}
          onOnlyNecessary={() => decideCookies("necessary")}
          onLearnMore={() => setLegalOpen("cookies")}
        />
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0a1326]/80 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoOp} alt="Método OP" className="h-9 md:h-11 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/80">
          <a href="#topo" className="hover:text-white transition-colors">
            Home
          </a>
          <a href="#diferenciais" className="hover:text-white transition-colors">
            Como funciona
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            FAQ
          </a>
          <Link to="/login" className="hover:text-white transition-colors">
            Login
          </Link>
        </nav>

        <div className="hidden lg:flex items-center gap-4 text-xs text-white/60">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white"
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
          <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-1.5 hover:text-white">
            <Mail size={14} /> Email
          </a>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} /> {HORARIO}
          </span>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <a
            href="#faq"
            className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
          >
            FAQ
          </a>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden">
      {/* Desktop e mobile são imagens distintas — trocadas via CSS, sem JS, sem flash. */}
      <div className="relative w-full">
        <img
          src={heroDesktop}
          alt="Método OP — comunicação digital com direção"
          className="w-full h-auto block select-none hidden md:block"
          draggable={false}
        />
        <img
          src={heroMobile}
          alt="Método OP — comunicação digital com direção"
          className="w-full h-auto block select-none md:hidden"
          draggable={false}
        />
        {/* Sombra suave na base pra emendar com o conteúdo abaixo */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 md:h-40 bg-gradient-to-b from-transparent to-[#0a1326]" />
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 -mt-2 md:-mt-10 pb-16 md:pb-24 relative z-10">
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-white">
            Transforme sua presença digital em uma{" "}
            <span className="text-[#f5a623]">comunicação com direção.</span>
          </h1>
          <p className="mt-5 md:mt-7 text-base md:text-lg text-white/75 max-w-3xl mx-auto leading-relaxed">
            O Método OP organiza a produção de conteúdo para empresas através de soluções textuais e
            visuais alinhadas ao marketing digital, ajudando marcas a criarem presença com mais
            clareza, estratégia e consistência.
          </p>

          <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[#f5a623] text-[#0a1326] font-bold text-sm md:text-base shadow-[0_10px_30px_-10px_rgba(245,166,35,0.6)] hover:bg-[#ffb838] transition-all hover:-translate-y-0.5"
            >
              <MessageCircle size={18} />
              Falar no WhatsApp
            </a>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-white/20 text-white font-semibold text-sm md:text-base hover:bg-white/5 transition-colors"
            >
              Login
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const DIFERENCIAIS = [
  {
    icon: Sparkles,
    titulo: "Comunicação Estratégica",
    texto: "Conteúdos organizados conforme intenção, momento e direcionamento da marca.",
  },
  {
    icon: ImageIcon,
    titulo: "Produção Visual",
    texto: "Imagens alinhadas à identidade visual e à presença digital da empresa.",
  },
  {
    icon: FileText,
    titulo: "Conteúdo Estruturado",
    texto: "Textos, títulos e legendas preparados para publicação.",
  },
  {
    icon: Smartphone,
    titulo: "Uso Simplificado",
    texto: "Acesso pelo celular ou computador com aprendizado rápido e operação prática.",
  },
];

function Diferenciais() {
  return (
    <section id="diferenciais" className="relative py-20 md:py-28 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-[#f5a623] mb-4">
            O método
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
            Estratégia, conteúdo e direção em um só fluxo.
          </h2>
        </div>

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {DIFERENCIAIS.map(({ icon: Icon, titulo, texto }) => (
            <div
              key={titulo}
              className="group relative p-6 md:p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#f5a623]/40 hover:bg-white/[0.05] transition-all"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#f5a623]/10 border border-[#f5a623]/30 text-[#f5a623] mb-5">
                <Icon size={22} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{titulo}</h3>
              <p className="text-sm text-white/65 leading-relaxed">{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChamadaFinal() {
  return (
    <section className="relative py-20 md:py-28 border-t border-white/5">
      {/* halo radial sutil pra marcar a seção sem virar gradiente carnavalesco */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background: "radial-gradient(circle at 50% 30%, rgba(245,166,35,0.10), transparent 55%)",
        }}
      />
      <div className="relative max-w-4xl mx-auto px-5 md:px-8 text-center">
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Mais organização.
          <br />
          <span className="text-[#f5a623]">Menos improviso.</span>
        </h2>
        <p className="mt-6 md:mt-8 text-base md:text-lg text-white/75 max-w-2xl mx-auto leading-relaxed">
          O Método OP ajuda empresas a manterem sua presença digital ativa sem transformar a criação
          de conteúdo em um desgaste diário.
        </p>
        <div className="mt-10">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#f5a623] text-[#0a1326] font-bold text-base shadow-[0_15px_40px_-10px_rgba(245,166,35,0.55)] hover:bg-[#ffb838] transition-all hover:-translate-y-0.5"
          >
            Conhecer o Método OP
            <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "O que é o Método OP?",
    a: "Um aplicativo com soluções textuais e de produção de imagem feito para pequenas empresas manterem presença digital ativa nas redes sociais sem gastar muito tempo com criação e produção de conteúdo.",
  },
  {
    q: "O que o aplicativo entrega pronto para publicar?",
    a: "Imagem com título, texto e legenda — tudo alinhado ao processo criativo do marketing digital, considerando público-alvo, marca, produtos, serviços e estratégia.",
  },
  {
    q: "Por que preciso conhecer o método antes de usar?",
    a: "Porque o app trabalha com trilhas de comunicação estratégica. Entender como o processo funciona é o que permite extrair o melhor resultado de cada peça gerada.",
  },
  {
    q: "Como funciona a estrutura do app?",
    a: "O Método OP sugere trilhas de produção textual e visual com base no direcionamento da marca e no momento da comunicação, garantindo que cada conteúdo tenha intenção clara.",
  },
  {
    q: "Como funciona a contratação e o primeiro acesso?",
    a: "Na contratação, definimos junto com o empresário a melhor trilha para o seu caso. Depois disso, o acesso é liberado para as configurações iniciais e geração de conteúdo.",
  },
  {
    q: "Preciso de conhecimento técnico para usar?",
    a: "Não. O aprendizado é rápido e o uso é prático tanto no celular quanto no desktop.",
  },
  {
    q: "Como começo?",
    a: "Basta falar com a equipe pelo WhatsApp para alinhar a trilha ideal e liberar seu acesso.",
    cta: true,
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative py-20 md:py-28 border-t border-white/5 scroll-mt-24">
      <div className="max-w-4xl mx-auto px-5 md:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#f5a623] mb-4">
            <HelpCircle size={14} /> Perguntas frequentes
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
            Esclareça antes de começar.
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden transition-colors hover:border-white/20"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-5 md:px-6 py-4 md:py-5 text-left"
                >
                  <span className="text-base md:text-lg font-semibold text-white">{item.q}</span>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-[#f5a623] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 md:px-6 pb-5 md:pb-6 text-sm md:text-base text-white/70 leading-relaxed">
                      {item.a}
                      {item.cta && (
                        <div className="mt-4">
                          <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#f5a623] text-[#0a1326] font-bold text-sm hover:bg-[#ffb838] transition-colors"
                          >
                            <MessageCircle size={16} /> Falar no WhatsApp
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer({ onOpenLegal }: { onOpenLegal: (k: "privacy" | "cookies") => void }) {
  return (
    <footer className="border-t border-white/5 bg-[#070e1d]">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          <div>
            <img src={logoOp} alt="Método OP" className="h-12 w-auto mb-4" />
            <p className="text-sm text-white/55 leading-relaxed">Oficina de Propaganda</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50 mb-4">
              Contato
            </h4>
            <ul className="space-y-2.5 text-sm text-white/75">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:text-[#f5a623]"
                >
                  <MessageCircle size={14} /> +55 66 99988-1627
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${EMAIL}`}
                  className="inline-flex items-center gap-2 hover:text-[#f5a623]"
                >
                  <Mail size={14} /> {EMAIL}
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/opropagandabr"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:text-[#f5a623]"
                >
                  <AtSign size={14} /> @opropagandabr
                </a>
              </li>
              <li className="inline-flex items-center gap-2 text-white/55">
                <Clock size={14} /> {HORARIO}
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50 mb-4">
              Acesso
            </h4>
            <ul className="space-y-2.5 text-sm text-white/75">
              <li>
                <Link to="/login" className="hover:text-[#f5a623]">
                  Login
                </Link>
              </li>
              <li>
                <Link to="/termos" className="hover:text-[#f5a623]">
                  Termos de Serviço
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="hover:text-[#f5a623]">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/exclusao-de-dados" className="hover:text-[#f5a623]">
                  Exclusão de Dados
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal("cookies")}
                  className="text-left hover:text-[#f5a623]"
                >
                  Política de Cookies
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 text-xs text-white/40 text-center">
          © {new Date().getFullYear()} Oficina de Propaganda · CNPJ: 03.834.539/0001-34 · Todos os
          direitos reservados.
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modal genérico para textos legais (Privacidade / Cookies)
// ─────────────────────────────────────────────────────────────────
const LAST_UPDATE = "14/05/2026";

function LegalDialog({
  open,
  onClose,
  title,
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-[#0f1a33] border border-white/10 shadow-2xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 text-[#f5a623]">
            {icon}
            <h2 id="legal-title" className="text-lg md:text-xl font-bold text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-6 text-sm md:text-[15px] leading-relaxed text-white/80 space-y-5 legal-prose">
          {children}
        </div>

        <footer className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 text-xs text-white/50">
          <span>Última atualização: {LAST_UPDATE}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-sm font-semibold text-white transition-colors"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}

function LegalH3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-white font-bold text-base md:text-lg mt-4 first:mt-0">{children}</h3>;
}

function PrivacyContent({ onOpenCookies }: { onOpenCookies: () => void }) {
  return (
    <>
      <p>
        Esta Política descreve como a <strong>Oficina de Propaganda</strong> (CNPJ
        03.834.539/0001-34), responsável pelo aplicativo <strong>Método OP</strong>, trata os dados
        pessoais coletados, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018
        — LGPD).
      </p>

      <LegalH3>1. Quem somos</LegalH3>
      <p>
        Oficina de Propaganda · CNPJ 03.834.539/0001-34. Contato:{" "}
        <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
          {EMAIL}
        </a>{" "}
        · WhatsApp +55 66 99988-1627.
      </p>

      <LegalH3>2. Dados que coletamos</LegalH3>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong>Cadastro:</strong> nome, e-mail, empresa, telefone.
        </li>
        <li>
          <strong>Uso do app:</strong> peças geradas, preferências de marca e configurações.
        </li>
        <li>
          <strong>Técnicos:</strong> endereço IP, identificador de navegador e cookies.
        </li>
      </ul>

      <LegalH3>3. Finalidades</LegalH3>
      <p>
        Operar o aplicativo, autenticar acesso, gerar conteúdo personalizado, melhorar o serviço e
        cumprir obrigações legais e contratuais.
      </p>

      <LegalH3>4. Base legal</LegalH3>
      <p>
        Execução de contrato, consentimento, legítimo interesse e cumprimento de obrigação legal,
        conforme o caso.
      </p>

      <LegalH3>5. Compartilhamento</LegalH3>
      <p>
        Compartilhamos dados apenas com provedores de infraestrutura em nuvem e provedores de
        inteligência artificial usados para gerar conteúdo, sempre sob contrato e estritamente para
        viabilizar o serviço. <strong>Nunca vendemos seus dados.</strong>
      </p>

      <LegalH3>6. Armazenamento e segurança</LegalH3>
      <p>
        Os dados ficam em servidores em nuvem com criptografia em trânsito (HTTPS) e controles de
        acesso. Aplicamos boas práticas de segurança para reduzir riscos.
      </p>

      <LegalH3>7. Retenção</LegalH3>
      <p>
        Mantemos os dados enquanto a conta estiver ativa e por até 24 meses após o encerramento,
        salvo obrigação legal de prazo distinto.
      </p>

      <LegalH3>8. Direitos do titular</LegalH3>
      <p>
        Você pode solicitar acesso, correção, portabilidade, exclusão, revogação de consentimento e
        oposição ao tratamento. Faça o pedido por e-mail para{" "}
        <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
          {EMAIL}
        </a>
        .
      </p>

      <LegalH3>9. Cookies</LegalH3>
      <p>
        Usamos cookies necessários, funcionais e (com seu consentimento) analíticos. Detalhes na
        nossa{" "}
        <button
          type="button"
          onClick={onOpenCookies}
          className="text-[#f5a623] hover:underline font-semibold"
        >
          Política de Cookies
        </button>
        .
      </p>

      <LegalH3>10. Atualizações</LegalH3>
      <p>
        Esta política pode ser atualizada periodicamente. Mudanças relevantes serão comunicadas no
        aplicativo.
      </p>

      <LegalH3>11. Encarregado (DPO)</LegalH3>
      <p>
        Contato do encarregado pelo tratamento de dados:{" "}
        <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
          {EMAIL}
        </a>
        .
      </p>
    </>
  );
}

function CookiesContent({ onReviewPreferences }: { onReviewPreferences: () => void }) {
  return (
    <>
      <p>
        Esta Política explica como o <strong>Método OP</strong> usa cookies e tecnologias similares
        para fazer o aplicativo funcionar e melhorar sua experiência.
      </p>

      <LegalH3>1. O que são cookies</LegalH3>
      <p>
        Cookies são pequenos arquivos armazenados no seu navegador que permitem reconhecer seu
        acesso, lembrar preferências e medir o uso do serviço.
      </p>

      <LegalH3>2. Tipos de cookies que usamos</LegalH3>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong>Necessários</strong> (sempre ativos): essenciais para a sessão de login e o
          funcionamento da interface.
        </li>
        <li>
          <strong>Funcionais:</strong> lembram a marca e o kit visual em uso, evitando
          reconfiguração a cada acesso.
        </li>
        <li>
          <strong>Analíticos</strong> (opcionais, só com consentimento): métricas agregadas de uso
          para ajudar a evoluir o produto.
        </li>
      </ul>

      <LegalH3>3. Como gerenciar</LegalH3>
      <p>
        Use os botões "Aceitar todos" ou "Apenas necessários" no banner de consentimento. Você
        também pode limpar cookies pelas configurações do seu navegador a qualquer momento.
      </p>
      <div>
        <button
          type="button"
          onClick={onReviewPreferences}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f5a623] text-[#0a1326] text-sm font-bold hover:bg-[#ffb838] transition-colors"
        >
          Revisar minhas preferências
        </button>
      </div>

      <LegalH3>4. Terceiros</LegalH3>
      <p>
        Provedores de infraestrutura em nuvem podem definir cookies estritamente necessários ao
        funcionamento do serviço.
      </p>

      <LegalH3>5. Atualizações e contato</LegalH3>
      <p>
        Esta política pode ser atualizada. Dúvidas:{" "}
        <a href={`mailto:${EMAIL}`} className="text-[#f5a623] hover:underline">
          {EMAIL}
        </a>
        .
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Banner de consentimento de cookies
// ─────────────────────────────────────────────────────────────────
function CookieBanner({
  onAcceptAll,
  onOnlyNecessary,
  onLearnMore,
}: {
  onAcceptAll: () => void;
  onOnlyNecessary: () => void;
  onLearnMore: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Consentimento de cookies"
      className="fixed z-50 inset-x-0 bottom-0 md:inset-x-auto md:right-5 md:bottom-5 md:max-w-[440px]"
    >
      <div className="m-3 md:m-0 rounded-2xl bg-[#0f1a33] border border-white/15 shadow-2xl p-5 md:p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-[#f5a623]/10 border border-[#f5a623]/30 text-[#f5a623] flex items-center justify-center">
            <Cookie size={18} />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-white mb-1">Cookies neste site</h3>
            <p className="text-xs md:text-sm text-white/70 leading-relaxed">
              Usamos cookies para fazer o app funcionar e melhorar sua experiência. Você pode
              aceitar todos ou só os necessários.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onAcceptAll}
            className="flex-1 px-4 py-2.5 rounded-full bg-[#f5a623] text-[#0a1326] text-sm font-bold hover:bg-[#ffb838] transition-colors"
          >
            Aceitar todos
          </button>
          <button
            type="button"
            onClick={onOnlyNecessary}
            className="flex-1 px-4 py-2.5 rounded-full border border-white/25 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Apenas necessários
          </button>
        </div>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onLearnMore}
            className="text-xs text-white/55 hover:text-[#f5a623] underline underline-offset-2"
          >
            Saber mais na Política de Cookies
          </button>
        </div>
      </div>
    </div>
  );
}
