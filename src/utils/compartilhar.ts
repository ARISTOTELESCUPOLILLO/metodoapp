// Compartilhamento nativo do arquivo — é assim que se manda para o WhatsApp.
//
// ⚠ NÃO EXISTE "botão do WhatsApp" para mandar ARQUIVO. Os links wa.me só levam
// TEXTO; vídeo por link exigiria o arquivo já hospedado em algum lugar público,
// e o filme montado nasce dentro do navegador. O caminho certo é a folha de
// compartilhamento do próprio sistema (Web Share API com `files`), onde o
// WhatsApp aparece junto com Instagram, Telegram, e-mail e o que mais estiver
// instalado — um toque, sem passar por servidor nenhum.
//
// ⚠ E ELA É DE CELULAR. No desktop, Chrome e Edge só compartilham arquivo em
// alguns casos e o Firefox não compartilha; por isso `podeCompartilharArquivo`
// existe e o botão só aparece quando o aparelho realmente sabe fazer isso. No
// computador o caminho continua sendo baixar.

/** O aparelho sabe compartilhar ESTE arquivo? Só então vale mostrar o botão. */
export function podeCompartilharArquivo(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

/** Monta o File a partir do blob — o nome é o que o WhatsApp mostra. */
export function arquivoDeVideo(blob: Blob, nome: string): File {
  return new File([blob], nome, { type: blob.type || "video/mp4" });
}

export interface ResultadoCompartilhar {
  ok: boolean;
  /** true quando o usuário fechou a folha — não é erro, e não deve virar aviso. */
  cancelado?: boolean;
  erro?: string;
}

/**
 * Abre a folha de compartilhamento com o arquivo.
 *
 * Precisa ser chamada DENTRO do clique: os navegadores exigem gesto do usuário e
 * recusam a chamada se ela vier depois de um `await` longo. Por isso o arquivo
 * já entra pronto aqui — nada de baixar ou montar nesta função.
 */
export async function compartilharVideo(
  file: File,
  texto?: string,
): Promise<ResultadoCompartilhar> {
  try {
    await navigator.share({ files: [file], ...(texto ? { text: texto } : {}) });
    return { ok: true };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    // AbortError = a pessoa fechou a folha. Silêncio é a resposta certa.
    if (err?.name === "AbortError") return { ok: false, cancelado: true };
    return { ok: false, erro: err?.message || "não foi possível compartilhar" };
  }
}
