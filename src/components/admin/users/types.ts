// Tipos compartilhados da aba Usuários — extraído de UsersTab.tsx (Fase 9).
import type { UsersListCosts, UsersListPlan, UsersListRow } from "@/lib/users.functions";

export type Row = UsersListRow;
export type Plan = UsersListPlan;
export type Costs = UsersListCosts;

export type SlotKey = "plano1" | "plano2" | "bonus";

export interface AssignModal {
  userId: string;
  userName: string;
  slot: SlotKey;
  originalPlanId: string | null;
  options: Plan[];
  selectedPlanId: string;
  dateVal: string;
  mesesContrato: number;
  resetCounters: boolean;
}

// Handlers de linha repassados a UserMobileCard/UserTableRow — todos já fazem
// a chamada de server function + reload; os componentes de linha só disparam.
export interface UserRowActions {
  onActAs: (r: Row) => void;
  onVerGeracoes: (r: Row) => void;
  onChangeNome: (userId: string, nome: string) => void;
  onChangePreco: (userId: string, slot: SlotKey, val: number | null) => void;
  onOpenAssignModal: (r: Row, slot: SlotKey, options: Plan[], forceReset?: boolean) => void;
  onRemoveSlot: (userId: string, slot: SlotKey) => void;
  onToggleStatus: (r: Row) => void;
  onToggleAdmin: (r: Row) => void;
  onChangeSegmento: (r: Row, seg: string) => void;
  onResetCounters: (r: Row) => void;
  onResetPassword: (r: Row) => void;
  onDeleteUser: (r: Row) => void;
  onToggleVoiceAvatar: (r: Row, slot: 1 | 2) => void;
}
