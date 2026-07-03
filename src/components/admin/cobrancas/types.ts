// Tipos da aba Cobranças — extraído de CobrancasTab.tsx (Fase 9).
import type { CycleInfo } from "@/lib/cycle";

export interface Row {
  id: string;
  nome: string | null;
  email: string;
  client_code: string | null;
  plano1_id: string | null;
  plano1_inicio: string | null;
  plano1_last_charged_at: string | null;
  plano1_contrato_fim: string | null;
  plano1_meses_contrato: number | null;
  plano2_id: string | null;
  plano2_inicio: string | null;
  plano2_last_charged_at: string | null;
  plano2_contrato_fim: string | null;
  plano2_meses_contrato: number | null;
  bonus_id: string | null;
  bonus_inicio: string | null;
  bonus_last_charged_at: string | null;
  bonus_contrato_fim: string | null;
  bonus_meses_contrato: number | null;
}

export interface Plan {
  id: string;
  codigo: string;
}

export type SlotKey = "plano1" | "plano2" | "bonus";

export interface Item {
  user: Row;
  slot: SlotKey;
  label: "P1" | "P2" | "B";
  planCodigo: string;
  inicio: string;
  lastChargedAt: string | null;
  cycle: CycleInfo;
}

export interface VencimentoItem {
  user: Row;
  slot: SlotKey;
  label: "P1" | "P2" | "B";
  planCodigo: string;
  contratoFim: string;
  mesesContrato: number;
  cycle: CycleInfo;
}
