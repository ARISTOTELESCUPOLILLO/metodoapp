// Server-only: mede a duração real de um buffer de áudio sem depender do cliente.
// Suporta WebM (Matroska/EBML), MP4/M4A (ISO BMFF), WAV (RIFF) e MP3 (Xing/Info ou contagem de frames).
// Tudo JS puro — roda no Cloudflare Worker (sem ffmpeg, sem libs nativas).
//
// Retorna { durationS, format }. Lança Error('audio_unsupported_format') quando não consegue parsear.

export type ProbedFormat = "webm" | "mp4" | "wav" | "mp3" | "unknown";

export interface AudioProbe {
  durationS: number;
  format: ProbedFormat;
}

function ab(buf: Buffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

function startsWith(buf: Uint8Array, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[offset + i] !== sig[i]) return false;
  return true;
}

function readUIntBE(buf: Uint8Array, off: number, len: number): number {
  let v = 0;
  for (let i = 0; i < len; i++) v = v * 256 + buf[off + i];
  return v;
}

function readUIntLE(buf: Uint8Array, off: number, len: number): number {
  let v = 0;
  for (let i = len - 1; i >= 0; i--) v = v * 256 + buf[off + i];
  return v;
}

function readFloat64BE(buf: Uint8Array, off: number): number {
  const dv = new DataView(buf.buffer, buf.byteOffset + off, 8);
  return dv.getFloat64(0, false);
}

function readFloat32BE(buf: Uint8Array, off: number): number {
  const dv = new DataView(buf.buffer, buf.byteOffset + off, 4);
  return dv.getFloat32(0, false);
}

// ---------- EBML / WebM ----------
// Lê VINT (variable-length integer). Retorna {value, size}. Se `keepMarker` true, mantém o bit marcador
// (usado pelo IDs do EBML). Caso contrário, remove (usado para tamanhos / valores).
function readVint(
  buf: Uint8Array,
  off: number,
  keepMarker: boolean,
): { value: number; size: number } {
  if (off >= buf.length) throw new Error("vint_out_of_range");
  const first = buf[off];
  if (first === 0) throw new Error("vint_invalid");
  let mask = 0x80;
  let size = 1;
  while (size <= 8 && (first & mask) === 0) {
    mask >>= 1;
    size++;
  }
  if (size > 8) throw new Error("vint_too_large");
  let value = keepMarker ? first : first & (mask - 1);
  for (let i = 1; i < size; i++) {
    value = value * 256 + buf[off + i];
  }
  return { value, size };
}

function probeWebm(buf: Uint8Array): number | null {
  // header EBML = 1A 45 DF A3
  if (!startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return null;
  // Vamos varrer o Segment procurando o Info -> Duration (4489) e TimecodeScale (2AD7B1).
  // Para evitar percorrer o arquivo todo, usamos só os primeiros ~256KB onde costuma estar o cabeçalho do Segment.
  const SCAN = Math.min(buf.length, 256 * 1024);
  let off = 0;

  // Skip top-level EBML header
  try {
    const id = readVint(buf, off, true);
    off += id.size;
    const sz = readVint(buf, off, false);
    off += sz.size;
    off += sz.value; // pula EBML header
  } catch {
    return null;
  }

  // Agora deve estar em Segment (18538067)
  if (off + 4 > buf.length) return null;
  if (
    !(buf[off] === 0x18 && buf[off + 1] === 0x53 && buf[off + 2] === 0x80 && buf[off + 3] === 0x67)
  )
    return null;
  off += 4;
  // tamanho do Segment (pode ser unknown size = todos os bits 1) — vamos só varrer
  const segSz = readVint(buf, off, false);
  off += segSz.size;
  const segEnd = Math.min(SCAN, segSz.value > 0 && segSz.value < SCAN ? off + segSz.value : SCAN);

  let timecodeScale = 1_000_000; // ns por tick (default Matroska)
  let durationTicks: number | null = null;

  while (off < segEnd - 2) {
    let id: { value: number; size: number };
    let sz: { value: number; size: number };
    try {
      id = readVint(buf, off, true);
      off += id.size;
      sz = readVint(buf, off, false);
      off += sz.size;
    } catch {
      break;
    }
    const elemEnd = off + sz.value;
    if (elemEnd > buf.length) break;

    // Info element = 1549A966
    if (id.value === 0x1549a966) {
      let inOff = off;
      while (inOff < elemEnd - 2) {
        let cid: { value: number; size: number };
        let csz: { value: number; size: number };
        try {
          cid = readVint(buf, inOff, true);
          inOff += cid.size;
          csz = readVint(buf, inOff, false);
          inOff += csz.size;
        } catch {
          break;
        }
        if (cid.value === 0x2ad7b1 && csz.value <= 8) {
          timecodeScale = readUIntBE(buf, inOff, csz.value);
        } else if (cid.value === 0x4489) {
          // Duration é um float (4 ou 8 bytes)
          if (csz.value === 4) durationTicks = readFloat32BE(buf, inOff);
          else if (csz.value === 8) durationTicks = readFloat64BE(buf, inOff);
        }
        inOff += csz.value;
      }
      break; // achou Info
    }
    off = elemEnd;
  }

  if (durationTicks == null) return null;
  return (durationTicks * timecodeScale) / 1e9;
}

// ---------- MP4 / M4A ----------
function probeMp4(buf: Uint8Array): number | null {
  // ftyp signature em offset 4
  if (buf.length < 12) return null;
  if (!(buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70)) return null;
  // varre boxes top-level procurando moov, depois moov.mvhd
  let off = 0;
  while (off + 8 <= buf.length) {
    let size = readUIntBE(buf, off, 4);
    const type = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    let headerLen = 8;
    if (size === 1) {
      if (off + 16 > buf.length) return null;
      size = readUIntBE(buf, off + 12, 4); // 64-bit largesize (assume <4GB)
      headerLen = 16;
    }
    if (size < headerLen) return null;
    const bodyOff = off + headerLen;
    const bodyEnd = off + size;
    if (type === "moov") {
      // procura mvhd
      let mo = bodyOff;
      while (mo + 8 <= bodyEnd) {
        const ms = readUIntBE(buf, mo, 4);
        const mt = String.fromCharCode(buf[mo + 4], buf[mo + 5], buf[mo + 6], buf[mo + 7]);
        if (mt === "mvhd") {
          const version = buf[mo + 8];
          let timescale: number, duration: number;
          if (version === 1) {
            // 8 bytes created + 8 bytes modified + 4 timescale + 8 duration (offset 8 + 4 (flags) = 12)
            timescale = readUIntBE(buf, mo + 8 + 4 + 8 + 8, 4);
            // duration 64-bit — assumimos cabe em number
            duration = readUIntBE(buf, mo + 8 + 4 + 8 + 8 + 4, 8);
          } else {
            timescale = readUIntBE(buf, mo + 8 + 4 + 4 + 4, 4);
            duration = readUIntBE(buf, mo + 8 + 4 + 4 + 4 + 4, 4);
          }
          if (timescale > 0) return duration / timescale;
          return null;
        }
        if (ms < 8) break;
        mo += ms;
      }
      return null;
    }
    if (size === 0) break; // box ate fim do arquivo, ignore
    off += size;
  }
  return null;
}

// ---------- WAV ----------
function probeWav(buf: Uint8Array): number | null {
  if (!startsWith(buf, [0x52, 0x49, 0x46, 0x46]) || !startsWith(buf, [0x57, 0x41, 0x56, 0x45], 8))
    return null;
  let off = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (off + 8 <= buf.length) {
    const id = String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
    const sz = readUIntLE(buf, off + 4, 4);
    if (id === "fmt ") {
      // bytesPerSec @ offset 8 do payload do chunk fmt
      byteRate = readUIntLE(buf, off + 8 + 8, 4);
    } else if (id === "data") {
      dataSize = sz;
      break;
    }
    off += 8 + sz + (sz % 2); // padding par
  }
  if (byteRate > 0 && dataSize > 0) return dataSize / byteRate;
  return null;
}

// ---------- MP3 ----------
const MPEG_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const MPEG_SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG 1
  2: [22050, 24000, 16000], // MPEG 2
  0: [11025, 12000, 8000], // MPEG 2.5
};

function findMp3FrameSync(buf: Uint8Array, start: number, end: number): number {
  for (let i = start; i < end - 1; i++) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) return i;
  }
  return -1;
}

function probeMp3(buf: Uint8Array): number | null {
  // pula tag ID3v2 se houver
  let off = 0;
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    // tamanho synchsafe (4 bytes, 7 bits cada)
    const tagSize =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    off = 10 + tagSize;
  }
  const firstFrame = findMp3FrameSync(buf, off, Math.min(buf.length, off + 64 * 1024));
  if (firstFrame < 0) return null;
  const b1 = buf[firstFrame + 1];
  const b2 = buf[firstFrame + 2];
  const versionBits = (b1 >> 3) & 0x03;
  const layerBits = (b1 >> 1) & 0x03;
  const bitrateIdx = (b2 >> 4) & 0x0f;
  const sampleIdx = (b2 >> 2) & 0x03;
  if (
    versionBits === 1 ||
    layerBits === 0 ||
    bitrateIdx === 0 ||
    bitrateIdx === 15 ||
    sampleIdx === 3
  )
    return null;
  const sampleRate =
    MPEG_SAMPLE_RATES[versionBits === 3 ? 3 : versionBits === 2 ? 2 : 0]?.[sampleIdx];
  if (!sampleRate) return null;
  const isV1L3 = versionBits === 3 && layerBits === 1;
  const bitrate = (isV1L3 ? MPEG_BITRATES_V1_L3 : MPEG_BITRATES_V2_L3)[bitrateIdx] * 1000;
  if (!bitrate) return null;

  // Tenta Xing/Info (CBR/VBR header)
  // Em frames MPEG1 stereo o offset é 36; MPEG1 mono 21; MPEG2 stereo 21; MPEG2 mono 13
  const channelMode = (buf[firstFrame + 3] >> 6) & 0x03; // 3 = mono
  const isMono = channelMode === 3;
  const xingOff = firstFrame + 4 + (isV1L3 ? (isMono ? 17 : 32) : isMono ? 9 : 17);
  if (xingOff + 8 < buf.length) {
    const tag = String.fromCharCode(
      buf[xingOff],
      buf[xingOff + 1],
      buf[xingOff + 2],
      buf[xingOff + 3],
    );
    if (tag === "Xing" || tag === "Info") {
      const flags = readUIntBE(buf, xingOff + 4, 4);
      if (flags & 0x0001) {
        const totalFrames = readUIntBE(buf, xingOff + 8, 4);
        // samples por frame: MPEG1 L3 = 1152; MPEG2 L3 = 576
        const samplesPerFrame = isV1L3 ? 1152 : 576;
        if (totalFrames > 0) return (totalFrames * samplesPerFrame) / sampleRate;
      }
    }
  }

  // Fallback: estimar pelo bitrate CBR e tamanho do arquivo (ignorando tag ID3 inicial)
  const audioBytes = buf.length - off;
  return (audioBytes * 8) / bitrate;
}

// ---------- Entry point ----------
export function probeAudio(input: Buffer | Uint8Array, mimeHint?: string): AudioProbe {
  const buf = ab(input);

  // Tenta na ordem mais provável pelo mime
  const tryers: Array<["webm" | "mp4" | "wav" | "mp3", (b: Uint8Array) => number | null]> = [];
  const m = (mimeHint || "").toLowerCase();
  if (m.includes("webm") || m.includes("ogg")) tryers.push(["webm", probeWebm]);
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) tryers.push(["mp4", probeMp4]);
  if (m.includes("wav")) tryers.push(["wav", probeWav]);
  if (m.includes("mpeg") || m.includes("mp3")) tryers.push(["mp3", probeMp3]);
  // Fallback genérico: tenta todos
  const all: Array<["webm" | "mp4" | "wav" | "mp3", (b: Uint8Array) => number | null]> = [
    ["webm", probeWebm],
    ["mp4", probeMp4],
    ["wav", probeWav],
    ["mp3", probeMp3],
  ];
  for (const t of all) {
    if (!tryers.some(([f]) => f === t[0])) tryers.push(t);
  }

  for (const [format, fn] of tryers) {
    try {
      const d = fn(buf);
      if (d != null && isFinite(d) && d > 0) return { durationS: d, format };
    } catch {
      // tenta o próximo
    }
  }

  throw new Error("audio_unsupported_format");
}
