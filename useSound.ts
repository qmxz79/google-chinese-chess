import { useCallback, useRef, useState } from "react";

let audioCtx: AudioContext | null = null;

function ensureCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playNoise(ctx: AudioContext, duration: number, volume: number, delay: number) {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 4);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime + delay);
}

export function useSound() {
  const [bgmOn, setBgmOn] = useState(false);
  const bgmStopRef = useRef<(() => void) | null>(null);
  const bgmOnRef = useRef(false);

  const play = useCallback(
    (freq: number, duration: number, type: OscillatorType = "sine", volume = 0.3, delay = 0) => {
      try {
        const ctx = ensureCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        const now = ctx.currentTime + delay;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      } catch {
        /* audio not available */
      }
    },
    []
  );

  const playPickup = useCallback(() => {
    try {
      const ctx = ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
      playNoise(ctx, 0.04, 0.1, 0);
    } catch {}
  }, []);

  const playPlace = useCallback(() => {
    try {
      const ctx = ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
      playNoise(ctx, 0.08, 0.15, 0);
    } catch {}
  }, []);

  const playCheck = useCallback(() => {
    play(700, 0.1, "square", 0.1, 0);
    play(900, 0.1, "square", 0.1, 0.13);
  }, [play]);

  const playWin = useCallback(() => {
    [523, 659, 784, 1047].forEach((freq, i) => play(freq, 0.35, "sine", 0.18, i * 0.16));
  }, [play]);

  const startBgm = useCallback(() => {
    if (bgmOnRef.current) return;
    bgmOnRef.current = true;

    const notes = [262, 294, 330, 392, 440, 392, 330, 294];
    let idx = 0;
    let stopped = false;
    let timeoutId: number;

    const playNext = () => {
      if (stopped) return;
      const noteDur = 0.45;
      play(notes[idx % notes.length], noteDur, "triangle", 0.03);
      idx++;
      timeoutId = window.setTimeout(playNext, noteDur * 1000 * 0.82);
    };

    playNext();
    setBgmOn(true);
    bgmStopRef.current = () => {
      stopped = true;
      clearTimeout(timeoutId);
      bgmOnRef.current = false;
    };
  }, [play]);

  const stopBgm = useCallback(() => {
    bgmStopRef.current?.();
    bgmStopRef.current = null;
    setBgmOn(false);
  }, []);

  const toggleBgm = useCallback(() => {
    if (bgmOn) stopBgm();
    else startBgm();
  }, [bgmOn, startBgm, stopBgm]);

  return { playPickup, playPlace, playCheck, playWin, bgmOn, toggleBgm };
}
