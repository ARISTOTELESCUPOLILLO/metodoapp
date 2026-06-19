import type { SlotInfo } from "@/hooks/useProfile";
import type { Track } from "@/types";

export interface PlanAccess {
  hasAnyPlan: boolean;
  tracks: Record<Track, boolean>;
  /** Tamanhos liberados por trilha (ex.: { cinematica: [6,9], visual: [3], experimentacao: [3] }) */
  sizesByTrack: Record<Track, number[]>;
  hasPostUnico: boolean;
}

function parseSize(codigo: string): number | null {
  // S3C/S6C/S9C/S3V/S6V/S9V → captura o dígito
  const m = codigo.match(/^S(\d+)/i);
  return m ? Number(m[1]) : null;
}

function codigoToTrack(codigo: string): "cinematica" | "visual" | "exp" | "post" | null {
  if (/^S\d+C$/i.test(codigo)) return "cinematica";
  if (/^S\d+V$/i.test(codigo)) return "visual";
  if (/^EX\d+$/i.test(codigo)) return "exp";
  if (/^PU\d+$/i.test(codigo)) return "post";
  return null;
}

export function buildPlanAccess(slots: SlotInfo[], isAdmin: boolean): PlanAccess {
  const tracks: Record<Track, boolean> = {
    cinematica: false,
    visual: false,
    experimentacao: false,
  };
  const sizesByTrack: Record<Track, number[]> = { cinematica: [], visual: [], experimentacao: [] };
  let hasPostUnico = false;

  if (isAdmin) {
    return {
      hasAnyPlan: true,
      tracks: { cinematica: true, visual: true, experimentacao: true },
      sizesByTrack: { cinematica: [3, 6, 9], visual: [3, 6, 9], experimentacao: [3] },
      hasPostUnico: true,
    };
  }

  for (const s of slots) {
    const track = codigoToTrack(s.plan.codigo);
    const size = parseSize(s.plan.codigo);
    if (track === "cinematica" && size) {
      tracks.cinematica = true;
      if (!sizesByTrack.cinematica.includes(size)) sizesByTrack.cinematica.push(size);
    } else if (track === "visual" && size) {
      tracks.visual = true;
      if (!sizesByTrack.visual.includes(size)) sizesByTrack.visual.push(size);
    } else if (track === "exp") {
      tracks.experimentacao = true;
      if (!sizesByTrack.experimentacao.includes(3)) sizesByTrack.experimentacao.push(3);
    } else if (track === "post") {
      hasPostUnico = true;
    }
  }
  sizesByTrack.cinematica.sort((a, b) => a - b);
  sizesByTrack.visual.sort((a, b) => a - b);

  return {
    hasAnyPlan: slots.length > 0,
    tracks,
    sizesByTrack,
    hasPostUnico,
  };
}
