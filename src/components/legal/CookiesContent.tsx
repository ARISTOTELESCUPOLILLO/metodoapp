// Texto da Política de Cookies.
//
// Extraído de `routes/index.tsx` sem uma vírgula alterada: o mesmo componente alimenta o
// modal da landing page e a rota /cookies, para os dois nunca divergirem. Antes disso o
// texto só existia dentro do modal, e por isso não havia URL própria para linkar.
//
// `onReviewPreferences` é responsabilidade de quem monta: na landing page reabre o banner;
// na rota /cookies limpa a decisão e volta para a home, onde o banner vive.

import { LegalH3 } from "./LegalH3";

const EMAIL = "contato@oficinadepropaganda.com.br";

export function CookiesContent({ onReviewPreferences }: { onReviewPreferences: () => void }) {
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
