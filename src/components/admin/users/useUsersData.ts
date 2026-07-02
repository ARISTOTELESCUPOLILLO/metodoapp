// Hook de carregamento da aba Usuários — extraído de UsersTab.tsx (Fase 9.1).
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { loadUsersList } from "@/lib/users.functions";
import type { Costs, Plan, Row } from "./types";

export function useUsersData() {
  const loadUsersListFn = useServerFn(loadUsersList);

  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<Costs>({ imageRef: 0.08, video: 1.6, content: 0.013 });
  const [usdRate, setUsdRate] = useState(5.8);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const {
          rows: nextRows,
          plans: nextPlans,
          costs: nextCosts,
          usdRate: nextUsdRate,
        } = await loadUsersListFn({ data: undefined });
        setRows(nextRows);
        setPlans(nextPlans);
        setCosts(nextCosts);
        setUsdRate(nextUsdRate);
      } catch (e) {
        toast.error(`Erro ao carregar usuários: ${(e as Error).message}`);
      }
      setLoading(false);
    },
    [loadUsersListFn],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { rows, plans, loading, costs, usdRate, load };
}
