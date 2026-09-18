/**
 * Avisos sonoros do caixa: bipes curtos (WebAudio) e voz opcional.
 * A preferência fica salva no próprio aparelho.
 */
const SOUND_KEY = "cpx.sound.enabled";
const VOICE_KEY = "cpx.voice.enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SOUND_KEY) !== "0";
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
}

export function isVoiceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(VOICE_KEY) === "1";
}

export function setVoiceEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOICE_KEY, enabled ? "1" : "0");
}

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(frequency: number, startAt: number, duration: number, volume = 0.16) {
  const context = audioContext();
  if (!context) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "square";
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(context.destination);
  const begin = context.currentTime + startAt;
  gain.gain.setValueAtTime(volume, begin);
  gain.gain.exponentialRampToValueAtTime(0.0001, begin + duration);
  osc.start(begin);
  osc.stop(begin + duration);
}

export type SoundKind = "ok" | "avulso" | "alerta" | "erro" | "caixa";

/** Toca o aviso sonoro correspondente (se o som estiver ligado). */
export function playSound(kind: SoundKind) {
  if (!isSoundEnabled()) return;
  switch (kind) {
    case "ok":
      tone(1180, 0, 0.09);
      break;
    case "avulso":
      // dois bipes agudos: item lançado sem cadastro
      tone(980, 0, 0.08);
      tone(1320, 0.11, 0.1);
      break;
    case "alerta":
      // bipe grave duplo: produto não cadastrado
      tone(420, 0, 0.16);
      tone(330, 0.2, 0.22);
      break;
    case "erro":
      tone(260, 0, 0.32, 0.2);
      break;
    case "caixa":
      tone(760, 0, 0.09);
      tone(1010, 0.1, 0.09);
      tone(1320, 0.2, 0.16);
      break;
  }
}

/** Fala o aviso em voz alta, quando o usuário ativou a voz. */
export function speak(text: string) {
  if (typeof window === "undefined" || !isVoiceEnabled()) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  utter.rate = 1.05;
  synth.speak(utter);
}

/** Bipe + voz na mesma chamada. */
export function alertUser(kind: SoundKind, spokenText?: string) {
  playSound(kind);
  if (spokenText) speak(spokenText);
}
