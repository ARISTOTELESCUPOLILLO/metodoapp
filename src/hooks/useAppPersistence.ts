// Persistência de estado do app raiz (localStorage/sessionStorage escopados
// por usuário) — extraído de MetodoOpApp.tsx (PLANO_V2 Fase 9.1).
// Efeitos movidos 1:1, sem mudança de comportamento.
import { useEffect, useRef } from "react";
import type { SlotInfo } from "./useProfile";
import type { Modo } from "../data/appDefaults";
import { savePostUnico } from "../data/appDefaults";
import type {
  MethodOpResult,
  MoodCode,
  PostUnicoFormData,
  PostUnicoVisualSelection,
} from "../types";
import type { PostUnicoCaption } from "../services/postUnico";
import { lsRemove, lsSetRaw, lsSetQuotaSafe, ssGet, ssSet } from "../lib/storage/store";
import {
  MODO_KEY,
  MOOD_KEY,
  RESULT_KEY,
  PU_IMG_KEY,
  PU_CAPTION_KEY,
  PU_STARTED_KEY,
  PU_VISUAL_KEY,
  MODO_INIT_KEY,
} from "../lib/storage/keys";

export function useAppPersistence(params: {
  modo: Modo;
  setModo: (m: Modo) => void;
  mood: MoodCode | null;
  result: MethodOpResult | undefined;
  postUnico: PostUnicoFormData;
  postUnicoImg: string | undefined;
  caption: PostUnicoCaption | undefined;
  postUnicoStarted: boolean;
  visualSelection: PostUnicoVisualSelection;
  effectiveUserId: string | null;
  slots: SlotInfo[];
}) {
  const {
    modo,
    setModo,
    mood,
    result,
    postUnico,
    postUnicoImg,
    caption,
    postUnicoStarted,
    visualSelection,
    effectiveUserId,
    slots,
  } = params;

  // Guarda contra gravação pré-restauração: no commit em que effectiveUserId
  // chega (login/reload/troca de impersonação), `postUnico` ainda é o estado
  // anterior (default ou do usuário anterior) — gravar aqui sobrescreveria o
  // form salvo do novo usuário com dados obsoletos. Hoje o restore
  // (useUserDataRestore) roda antes deste efeito por ordem de hooks no
  // MetodoOpApp, mas o guard remove essa dependência frágil de ordem.
  const puSaveUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveUserId) return;
    if (puSaveUserRef.current !== effectiveUserId) {
      puSaveUserRef.current = effectiveUserId;
      return;
    }
    savePostUnico(postUnico, effectiveUserId);
  }, [postUnico, effectiveUserId]);

  useEffect(() => {
    lsSetRaw(MODO_KEY, modo);
  }, [modo]);

  useEffect(() => {
    if (mood) lsSetRaw(MOOD_KEY, mood);
  }, [mood]);

  // Auto-seleciona modo pelo plano1 ao logar — uma vez por login nesta aba.
  useEffect(() => {
    if (!effectiveUserId || !slots.length) return;
    const key = `${MODO_INIT_KEY}:${effectiveUserId}`;
    if (ssGet(key) === "1") return;
    ssSet(key, "1");
    const plano1 = slots.find((s) => s.key === "plano1");
    if (!plano1) return;
    if (/^PU/i.test(plano1.plan.codigo)) setModo("postUnico");
    else setModo("metodo");
  }, [effectiveUserId, slots]);

  // Persistência do conteúdo gerado por usuário
  useEffect(() => {
    if (!effectiveUserId) return;
    if (result === undefined) lsRemove(RESULT_KEY, effectiveUserId);
    else lsSetQuotaSafe(RESULT_KEY, JSON.stringify(result), effectiveUserId);
  }, [result, effectiveUserId]);

  useEffect(() => {
    if (!effectiveUserId) return;
    if (postUnicoImg === undefined) lsRemove(PU_IMG_KEY, effectiveUserId);
    else lsSetQuotaSafe(PU_IMG_KEY, JSON.stringify(postUnicoImg), effectiveUserId);
  }, [postUnicoImg, effectiveUserId]);

  useEffect(() => {
    if (!effectiveUserId) return;
    if (caption === undefined) lsRemove(PU_CAPTION_KEY, effectiveUserId);
    else lsSetQuotaSafe(PU_CAPTION_KEY, JSON.stringify(caption), effectiveUserId);
  }, [caption, effectiveUserId]);

  useEffect(() => {
    if (!effectiveUserId) return;
    lsSetQuotaSafe(PU_STARTED_KEY, postUnicoStarted ? "true" : "false", effectiveUserId);
  }, [postUnicoStarted, effectiveUserId]);

  useEffect(() => {
    if (!effectiveUserId) return;
    lsSetQuotaSafe(PU_VISUAL_KEY, JSON.stringify(visualSelection), effectiveUserId);
  }, [visualSelection, effectiveUserId]);
}
