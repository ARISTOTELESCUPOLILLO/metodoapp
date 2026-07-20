// Subtítulo dos textos legais (Privacidade / Cookies).
// Extraído de `routes/index.tsx` sem alteração de classes, para poder ser usado tanto
// pelo modal da landing page quanto pela rota /cookies.

export function LegalH3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-white font-bold text-base md:text-lg mt-4 first:mt-0">{children}</h3>;
}
