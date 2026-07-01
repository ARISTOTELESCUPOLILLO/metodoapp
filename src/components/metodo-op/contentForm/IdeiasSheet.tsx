// Painel lateral "Ideias de Assuntos" do formulário de conteúdo — extraído
// de ContentForm.tsx (PLANO_V2 Fase 9.1). JSX movido 1:1, sem mudança de
// comportamento.
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { IDEIAS_ASSUNTOS } from "@/data/ideiasAssuntos";
import type { Segment } from "../../../types";

interface Props {
  segment: Segment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IdeiasSheet({ segment, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader style={{ marginBottom: 20 }}>
          <SheetTitle style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            Ideias de Assuntos
            <span
              style={{
                background: "#eff6ff",
                color: "#1e40af",
                border: "1px solid #bfdbfe",
                borderRadius: 6,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {segment === "SERVIÇOS" ? "Serviços" : segment === "VAREJO" ? "Varejo" : "Marca"}
            </span>
          </SheetTitle>
        </SheetHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {IDEIAS_ASSUNTOS[segment].map((cat) => (
            <div key={cat.titulo}>
              <div style={{ marginBottom: 6 }}>
                <strong style={{ fontSize: 14, color: "#0f172a" }}>{cat.titulo}</strong>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  ({cat.subtitulo})
                </div>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                {cat.itens.map((item, i) => (
                  <li key={i} style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                    {item}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 20, borderBottom: "1px solid #f1f5f9" }} />
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
