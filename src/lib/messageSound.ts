export type RingtoneId = "ding" | "chime" | "pop" | "bloop" | "alert" | "off";

export const RINGTONES: { id: RingtoneId; label: string }[] = [
  { id: "ding", label: "Ding (default)" },
  { id: "chime", label: "Chime" },
  { id: "pop", label: "Pop" },
  { id: "bloop", label: "Bloop" },
  { id: "alert", label: "Alert" },
  { id: "off", label: "Off (silent)" },
];

const KEY = "message-ringtone";

export const getRingtone = (): RingtoneId => {
  const v = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) as RingtoneId | null;
  return v && RINGTONES.some((r) => r.id === v) ? v : "ding";
};

export const setRingtone = (id: RingtoneId) => {
  try { localStorage.setItem(KEY, id); } catch { /* noop */ }
};

let ctx: AudioContext | null = null;
const getCtx = () => {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  ctx.resume().catch(() => undefined);
  return ctx;
};

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number };

const PATTERNS: Record<Exclude<RingtoneId, "off">, Note[]> = {
  ding: [{ f: 1320, t: 0, d: 0.5, type: "sine", g: 0.35 }, { f: 1980, t: 0, d: 0.35, type: "sine", g: 0.12 }],
  chime: [
    { f: 880, t: 0, d: 0.35, type: "sine", g: 0.3 },
    { f: 1174, t: 0.12, d: 0.4, type: "sine", g: 0.28 },
    { f: 1568, t: 0.24, d: 0.5, type: "sine", g: 0.25 },
  ],
  pop: [{ f: 520, t: 0, d: 0.12, type: "triangle", g: 0.4 }],
  bloop: [
    { f: 420, t: 0, d: 0.12, type: "sine", g: 0.35 },
    { f: 700, t: 0.1, d: 0.18, type: "sine", g: 0.3 },
  ],
  alert: [
    { f: 990, t: 0, d: 0.18, type: "square", g: 0.22 },
    { f: 990, t: 0.24, d: 0.18, type: "square", g: 0.22 },
  ],
};

/** Play the user's selected message notification sound. */
export const playMessageSound = (id: RingtoneId = getRingtone()) => {
  if (id === "off") return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime + 0.01;
  PATTERNS[id].forEach(({ f, t, d, type = "sine", g = 0.3 }) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, now + t);
    gain.gain.setValueAtTime(0.0001, now + t);
    gain.gain.exponentialRampToValueAtTime(g, now + t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
    osc.connect(gain).connect(c.destination);
    osc.start(now + t);
    osc.stop(now + t + d + 0.02);
  });
};
