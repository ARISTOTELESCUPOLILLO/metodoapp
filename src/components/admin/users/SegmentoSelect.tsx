// Extraído de UsersTab.tsx (Fase 9).
export function SegmentoSelect({
  value,
  onChange,
}: {
  value: "SERVIÇOS" | "VAREJO" | "MARCA" | null;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "4px 6px",
        borderRadius: 4,
        border: "1px solid #cbd5e1",
        fontSize: 12,
        maxWidth: 130,
      }}
    >
      <option value="">— vazio —</option>
      <option value="SERVIÇOS">SERVIÇOS</option>
      <option value="VAREJO">VAREJO</option>
      <option value="MARCA">MARCA</option>
    </select>
  );
}
