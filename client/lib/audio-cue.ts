import { NotificationType } from "./types/notification";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playAudioCue(type: NotificationType) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case "Goal": {
        // Uplifting arpeggio (C5 -> E5 -> G5)
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.start(now);
        osc.stop(now + 0.45);
        break;
      }
      case "PeakSwing": {
        // Double pulse pitch drop (A5 -> D5)
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.15);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case "VolatilitySpike": {
        // Vibrant double ping
        osc.type = "sine";
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.setValueAtTime(1050, now + 0.06);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case "MarketFreeze": {
        // Low warning drone pulse
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(180, now + 0.12);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.start(now);
        osc.stop(now + 0.35);
        break;
      }
    }
  } catch {
    // Audio context policy blocked or unavailable
  }
}
