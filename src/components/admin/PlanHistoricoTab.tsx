import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loadPlanHistorico } from "@/lib/planHistory.functions";
import { useIsMobile } from "@/hooks/use-mobile";
import { PlanHistoricoTable } from "./planHistorico/PlanHistoricoTable";
import { PlanHistoricoMobileList } from "./planHistorico/PlanHistoricoMobileList";
import { LIMIT, type PurchaseRow } from "./planHistorico/types";

export function PlanHistoricoTab() {
  const loadFn = useServerFn(loadPlanHistorico);
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const load = useCallback(
    async (off = 0, q = search) => {
      setLoading(true);
      try {
        const res = await loadFn({ data: { search: q || undefined, offset: off, limit: LIMIT } });
        setRows(res.rows as PurchaseRow[]);
        setTotal(res.total);
        setOffset(off);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [loadFn, search],
  );

  useEffect(() => {
    load(0, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem; `load` muda com `search`
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(0, search);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Histórico de planos</h3>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
            {total} ciclo{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
          </p>
        </div>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 6 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente…"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 13,
              width: 200,
            }}
          />
          <button
            type="submit"
            style={{
              background: "#123a63",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Buscar
          </button>
        </form>
      </div>

      {loading ? (
        <p style={{ color: "#64748b", fontSize: 13 }}>Carregando…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 13 }}>
          Nenhum ciclo registrado ainda. Os ciclos são criados automaticamente ao renovar ou remover
          um plano.
        </p>
      ) : (
        <>
          {isMobile ? (
            <PlanHistoricoMobileList rows={rows} openId={openId} onToggle={setOpenId} />
          ) : (
            <PlanHistoricoTable rows={rows} />
          )}

          {totalPages > 1 && (
            <div
              style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}
            >
              <button
                onClick={() => load(offset - LIMIT)}
                disabled={offset === 0}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontSize: 13,
                  cursor: offset === 0 ? "not-allowed" : "pointer",
                  opacity: offset === 0 ? 0.5 : 1,
                }}
              >
                ← Anterior
              </button>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => load(offset + LIMIT)}
                disabled={offset + LIMIT >= total}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontSize: 13,
                  cursor: offset + LIMIT >= total ? "not-allowed" : "pointer",
                  opacity: offset + LIMIT >= total ? 0.5 : 1,
                }}
              >
                Próximo →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
