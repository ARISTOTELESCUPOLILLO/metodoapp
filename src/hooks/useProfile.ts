import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { computeCota, ZERO_COTA, type CotaPorTipo, type PlanoComExtras } from '@/core/personalizacaoMop';

export interface PlanInfo {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  base_estatico?: number;
  base_carrossel?: number;
  base_estatico_final?: number;
  base_reels?: number;
}

export interface SlotInfo {
  key: 'plano1' | 'plano2' | 'bonus';
  label: string;
  plan: PlanInfo;
  inicio: string | null;
  imgsUsadas: number;
  imgsLimite: number;
  rendersUsados: number;
  rendersLimite: number;
  geracoesUsadas: number;
  geracoesLimite: number;
}

export interface Profile {
  id: string;
  nome: string | null;
  email: string;
  client_code: string | null;
  status: 'ativo' | 'bloqueado';
  segmento: 'SERVIÇOS' | 'VAREJO' | 'MARCA' | null;
  ultimo_login: string | null;
  plano1_last_charged_at: string | null;
  plano2_last_charged_at: string | null;
  bonus_last_charged_at: string | null;
  plano1_id: string | null;
  plano1_inicio: string | null;
  plano1_imgs_usadas: number;
  plano1_imgs_limite: number;
  plano1_renders_usados: number;
  plano1_renders_limite: number;
  plano1_geracoes_usadas: number;
  plano1_geracoes_limite: number;
  plano2_id: string | null;
  plano2_inicio: string | null;
  plano2_imgs_usadas: number;
  plano2_imgs_limite: number;
  plano2_renders_usados: number;
  plano2_renders_limite: number;
  plano2_geracoes_usadas: number;
  plano2_geracoes_limite: number;
  bonus_id: string | null;
  bonus_inicio: string | null;
  bonus_imgs_usadas: number;
  bonus_imgs_limite: number;
  bonus_renders_usados: number;
  bonus_renders_limite: number;
  bonus_geracoes_usadas: number;
  bonus_geracoes_limite: number;
  extra_p1_estatico: number;
  extra_p1_carrossel: number;
  extra_p1_estatico_final: number;
  extra_p1_reels: number;
  extra_p2_estatico: number;
  extra_p2_carrossel: number;
  extra_p2_estatico_final: number;
  extra_p2_reels: number;
  extra_b_estatico: number;
  extra_b_carrossel: number;
  extra_b_estatico_final: number;
  extra_b_reels: number;
}

export function useProfile(targetUserId?: string | null) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [cotaPersonalizados, setCotaPersonalizados] = useState<CotaPorTipo>(ZERO_COTA);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSelfAdmin, setIsSelfAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null); setSlots([]); setIsAdmin(false); setIsSelfAdmin(false); setCotaPersonalizados(ZERO_COTA); setLoading(false);
      return;
    }
    setLoading(true);
    // Carrega sempre o role do usuário logado (para condicionar UI admin
    // — botão Admin, faixa de impersonação, etc.). O profile/slots/roles
    // efetivos podem ser de outro usuário quando o admin está impersonando.
    const effectiveId = targetUserId || user.id;
    const [{ data: prof }, { data: roles }, { data: selfRoles }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', effectiveId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', effectiveId),
      targetUserId
        ? supabase.from('user_roles').select('role').eq('user_id', user.id)
        : Promise.resolve({ data: null as any }),
    ]);
    const p = (prof as any) || null;
    setProfile(p);
    const effectiveIsAdmin = !!roles?.some((r: any) => r.role === 'admin');
    setIsAdmin(effectiveIsAdmin);
    setIsSelfAdmin(
      targetUserId
        ? !!selfRoles?.some((r: any) => r.role === 'admin')
        : effectiveIsAdmin
    );

    if (p) {
      const ids = [p.plano1_id, p.plano2_id, p.bonus_id].filter(Boolean) as string[];
      let plansMap: Record<string, PlanInfo> = {};
      if (ids.length) {
        const { data: pls } = await supabase
          .from('plans')
          .select('id,codigo,nome,tipo,base_estatico,base_carrossel,base_estatico_final,base_reels')
          .in('id', ids);
        plansMap = Object.fromEntries((pls || []).map((pl: any) => [pl.id, pl]));
      }
      const built: SlotInfo[] = [];
      const push = (key: SlotInfo['key'], label: string, planId: string | null, inicio: string | null,
                    iu: number, il: number, ru: number, rl: number, gu: number, gl: number) => {
        if (!planId || !plansMap[planId]) return;
        built.push({ key, label, plan: plansMap[planId], inicio,
          imgsUsadas: iu, imgsLimite: il, rendersUsados: ru, rendersLimite: rl,
          geracoesUsadas: gu, geracoesLimite: gl });
      };
      push('plano1', 'Plano 1', p.plano1_id, p.plano1_inicio,
        p.plano1_imgs_usadas, p.plano1_imgs_limite, p.plano1_renders_usados, p.plano1_renders_limite,
        p.plano1_geracoes_usadas ?? 0, p.plano1_geracoes_limite ?? 0);
      push('plano2', 'Plano 2', p.plano2_id, p.plano2_inicio,
        p.plano2_imgs_usadas, p.plano2_imgs_limite, p.plano2_renders_usados, p.plano2_renders_limite,
        p.plano2_geracoes_usadas ?? 0, p.plano2_geracoes_limite ?? 0);
      push('bonus', 'Bônus', p.bonus_id, p.bonus_inicio,
        p.bonus_imgs_usadas, p.bonus_imgs_limite, p.bonus_renders_usados, p.bonus_renders_limite,
        p.bonus_geracoes_usadas ?? 0, p.bonus_geracoes_limite ?? 0);
      setSlots(built);

      const entries: PlanoComExtras[] = [
        { plan: p.plano1_id ? plansMap[p.plano1_id] ?? null : null,
          extras: { estatico: p.extra_p1_estatico, carrossel: p.extra_p1_carrossel,
                    estatico_final: p.extra_p1_estatico_final, reels: p.extra_p1_reels } },
        { plan: p.plano2_id ? plansMap[p.plano2_id] ?? null : null,
          extras: { estatico: p.extra_p2_estatico, carrossel: p.extra_p2_carrossel,
                    estatico_final: p.extra_p2_estatico_final, reels: p.extra_p2_reels } },
        { plan: p.bonus_id ? plansMap[p.bonus_id] ?? null : null,
          extras: { estatico: p.extra_b_estatico, carrossel: p.extra_b_carrossel,
                    estatico_final: p.extra_b_estatico_final, reels: p.extra_b_reels } },
      ];
      setCotaPersonalizados(computeCota(entries));
    } else {
      setSlots([]);
      setCotaPersonalizados(ZERO_COTA);
    }
    setLoading(false);
  }, [user, targetUserId]);

  useEffect(() => { if (!authLoading) refresh(); }, [authLoading, refresh]);

  return { profile, slots, isAdmin, isSelfAdmin, cotaPersonalizados, loading: loading || authLoading, refresh };
}
