import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfirm } from "@/hooks/useConfirm";
import { useServerFn } from "@tanstack/react-start";
import { migrateImageKitFor } from "@/lib/imageKit.functions";
import {
  loadInvitesData,
  createInvite,
  setInviteStatus,
  deleteInvite,
} from "@/lib/invites.functions";
import { InviteForm, type Segment } from "./invites/InviteForm";
import { InvitesListSection } from "./invites/InvitesListSection";
import type { DirectProfile, Invite, Plan, ProfileSlots, TestProfile } from "./invites/types";

export function InvitesTab() {
  const isMobile = useIsMobile();
  const { confirm, dialog } = useConfirm();
  const loadInvitesDataFn = useServerFn(loadInvitesData);
  const createInviteFn = useServerFn(createInvite);
  const setInviteStatusFn = useServerFn(setInviteStatus);
  const deleteInviteFn = useServerFn(deleteInvite);
  const migrateKitFn = useServerFn(migrateImageKitFor);

  const [rows, setRows] = useState<Invite[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [testProfiles, setTestProfiles] = useState<TestProfile[]>([]);
  const [profByEmail, setProfByEmail] = useState<Record<string, ProfileSlots>>({});
  const [directProfs, setDirectProfs] = useState<DirectProfile[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState<Segment>("");
  const [plano1Id, setPlano1Id] = useState("");
  const [plano2Id, setPlano2Id] = useState("");
  const [bonusId, setBonusId] = useState("");
  const [sourceTestProfileId, setSourceTestProfileId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [migrating, setMigrating] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadInvitesDataFn({ data: undefined });
    setRows(data.rows);
    setPlans(data.plans);
    setTestProfiles(data.testProfiles);
    setProfByEmail(data.profByEmail);
    setDirectProfs(data.directProfs);
    setLoading(false);
  }, [loadInvitesDataFn]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = nome.trim();
    if (!cleanEmail.includes("@")) {
      setMsg("E-mail inválido.");
      return;
    }
    if (!cleanNome) {
      setMsg("Informe o nome do cliente.");
      return;
    }
    if (!segment) {
      setMsg("Escolha o segmento do cliente.");
      return;
    }
    setBusy(true);
    try {
      await createInviteFn({
        data: {
          nome: cleanNome,
          email: cleanEmail,
          segment,
          plano1Id: plano1Id || null,
          plano2Id: plano2Id || null,
          bonusId: bonusId || null,
          sourceTestProfileId: sourceTestProfileId || null,
        },
      });
      setNome("");
      setEmail("");
      setSegment("");
      setPlano1Id("");
      setPlano2Id("");
      setBonusId("");
      setSourceTestProfileId("");
      setMsg(`Convite criado. Envie o link de cadastro para ${cleanEmail}.`);
      load();
    } catch (e2) {
      setMsg(`Erro: ${e2 instanceof Error ? e2.message : String(e2)}`);
    }
    setBusy(false);
  }

  async function migrateKit(r: Invite) {
    if (!r.source_test_profile_id) return;
    if (
      !(await confirm(
        `Copiar o Kit Imagem do perfil de teste para ${r.nome || r.email}?\n\nOs arquivos do kit serão copiados para a conta do cliente.`,
      ))
    )
      return;
    setMigrating(r.id);
    setMsg(null);
    try {
      const result = await migrateKitFn({
        data: { inviteId: r.id, sourceProfileId: r.source_test_profile_id },
      });
      const { copied } = result;
      const imgPart = copied.imageKitFound
        ? `${copied.avatar ? "1 avatar" : "sem avatar"}, ${copied.cenarios} cenário(s), ${copied.produtos} produto(s)`
        : "sem Kit Imagem no teste";
      const kitMarca = copied.brandKit
        ? ", kit de marca ✓"
        : copied.brandKitFound
          ? ", kit de marca encontrado mas falhou ao copiar — tente novamente"
          : ", kit de marca não encontrado no perfil de teste (salve o kit no teste antes de migrar)";
      setMsg(`Kit migrado: ${imgPart}${kitMarca}.`);
      load();
    } catch (e: unknown) {
      setMsg(`Erro na migração: ${e instanceof Error ? e.message : String(e)}`);
    }
    setMigrating(null);
  }

  async function setStatus(r: Invite, status: string) {
    if (
      !(await confirm(`${status === "revogado" ? "Revogar" : "Reativar"} convite de ${r.email}?`))
    )
      return;
    await setInviteStatusFn({ data: { inviteId: r.id, status } });
    load();
  }
  async function remove(r: Invite) {
    if (
      !(await confirm(
        `Excluir convite de ${r.email}?\n(Se já se cadastrou, exclua-o também na aba Usuários.)`,
      ))
    )
      return;
    await deleteInviteFn({ data: { inviteId: r.id } });
    load();
  }
  function copyLink(r: Invite) {
    const url = `${window.location.origin}/signup`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(`Link copiado! Envie para ${r.email}.`),
      () => prompt("Copie o link:", url),
    );
  }

  const filtered = rows.filter((r) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (r.email || "").toLowerCase().includes(s) || (r.nome || "").toLowerCase().includes(s);
  });

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {dialog}
      <InviteForm
        isMobile={isMobile}
        plans={plans}
        testProfiles={testProfiles}
        nome={nome}
        email={email}
        segment={segment}
        plano1Id={plano1Id}
        plano2Id={plano2Id}
        bonusId={bonusId}
        sourceTestProfileId={sourceTestProfileId}
        busy={busy}
        msg={msg}
        onNomeChange={setNome}
        onEmailChange={setEmail}
        onSegmentChange={setSegment}
        onPlano1Change={setPlano1Id}
        onPlano2Change={setPlano2Id}
        onBonusChange={setBonusId}
        onSourceTestProfileChange={setSourceTestProfileId}
        onSubmit={invite}
      />
      <InvitesListSection
        isMobile={isMobile}
        loading={loading}
        search={search}
        filtered={filtered}
        directProfs={directProfs}
        plans={plans}
        profByEmail={profByEmail}
        testProfiles={testProfiles}
        migrating={migrating}
        onSearchChange={setSearch}
        onCopyLink={copyLink}
        onSetStatus={setStatus}
        onRemove={remove}
        onMigrateKit={migrateKit}
      />
    </div>
  );
}
