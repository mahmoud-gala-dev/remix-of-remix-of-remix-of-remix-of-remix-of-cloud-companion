import type { AmbientSound } from "@/pomodoro/types";

/**
 * Web Audio ambient noise generator — no audio files. White and brown noise come
 * from a looping noise buffer; "rain" is brown noise shaped by a band-pass filter.
 */
export class AmbientAudioController {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private current: AmbientSound = "none";
  private volume = 0.5;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.context ??= new Ctor();
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  private buildBuffer(context: AudioContext, kind: AmbientSound) {
    const seconds = 2;
    const length = context.sampleRate * seconds;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === "white") {
        data[index] = white * 0.6;
      } else {
        /* Brown noise: an integrated random walk, also the base for "rain". */
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[index] = lastOut * 3.5;
      }
    }
    return buffer;
  }

  play(kind: AmbientSound, volume = this.volume) {
    this.volume = volume;
    if (kind === "none") {
      this.stop();
      return;
    }
    const context = this.ensureContext();
    if (!context) return;
    this.stop();

    const source = context.createBufferSource();
    source.buffer = this.buildBuffer(context, kind);
    source.loop = true;

    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.35;

    if (kind === "rain") {
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1400;
      filter.Q.value = 0.7;
      source.connect(filter).connect(gain).connect(context.destination);
    } else {
      source.connect(gain).connect(context.destination);
    }

    source.start();
    this.source = source;
    this.gain = gain;
    this.current = kind;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.35;
  }

  stop() {
    try {
      this.source?.stop();
    } catch {
      // Already stopped.
    }
    this.source?.disconnect();
    this.gain?.disconnect();
    this.source = null;
    this.gain = null;
    this.current = "none";
  }

  get playing() {
    return this.current;
  }
}

export const ambientAudio = new AmbientAudioController();

export type CueName = "start" | "pause" | "resume" | "checkpoint" | "complete";

const CUES: Record<CueName, { freq: number[]; duration: number; type: OscillatorType }> = {
  start: { freq: [660, 880], duration: 0.12, type: "sine" },
  pause: { freq: [440], duration: 0.16, type: "triangle" },
  resume: { freq: [520, 660], duration: 0.1, type: "sine" },
  checkpoint: { freq: [880], duration: 0.09, type: "square" },
  complete: { freq: [523, 659, 784], duration: 0.16, type: "sine" },
};

let cueContext: AudioContext | null = null;

/** Short synthesized cue; silent when the browser has no Web Audio support. */
export function playCue(name: CueName, volume = 0.5) {
  if (typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  cueContext ??= new Ctor();
  if (cueContext.state === "suspended") void cueContext.resume();

  const cue = CUES[name];
  cue.freq.forEach((frequency, index) => {
    const oscillator = cueContext!.createOscillator();
    const gain = cueContext!.createGain();
    const startAt = cueContext!.currentTime + index * cue.duration;
    oscillator.type = cue.type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.3), startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + cue.duration);
    oscillator.connect(gain).connect(cueContext!.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + cue.duration + 0.02);
  });
}
