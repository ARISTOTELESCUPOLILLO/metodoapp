// Tipos compartilhados da aba Custos — extraído de CustosTab.tsx (Fase 9).
import type {
  CustosAllTimeLog,
  CustosLog,
  CustosPlan,
  CustosProfile,
  CustosSettings,
} from "@/lib/custos.functions";

export type Log = CustosLog;
export type AllTimeLog = CustosAllTimeLog;
export type Plan = CustosPlan;
export type Profile = CustosProfile;
export type AppSettings = CustosSettings;

export interface PlanRow {
  planId: string;
  codigo: string;
  nome: string;
  totalClientes: number;
  imgs: number;
  renders: number;
  geracoes: number;
  custoFalaiPrev: number;
  custoOpenaiPrev: number;
  custoRealUsd: number;
  projecaoUsd: number;
  precoMin: number;
  precoMed: number | null;
  precoMax: number;
  margemMin: number | null;
  margemMax: number | null;
}

export interface TestRow {
  id: string;
  nome: string;
  imgs: number;
  renders: number;
  geracoes: number;
  custoUsd: number;
}

export interface AdminRow {
  aid: string;
  email: string;
  imgs: number;
  renders: number;
  geracoes: number;
  custoUsd: number;
}
