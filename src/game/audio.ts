type Bus = { master: GainNode; sfx: GainNode; music: GainNode; ctx: AudioContext };

let bus: Bus | null = null;
let muted = false;
let musicTimer = 0;
let musicOn = false;
let step = 0;

function ctx(): AudioContext | null {
  return bus?.ctx ?? null;
}

function env(c: AudioContext, g: GainNode, peak: number, a: number, d: number) {
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  dest: GainNode,
  slide = 0,
) {
  const c = ctx();
  if (!c || !bus || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
  o.connect(g);
  g.connect(dest);
  env(c, g, peak, 0.01, dur);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

function noise(dur: number, peak: number, dest: GainNode, cutoff = 900) {
  const c = ctx();
  if (!c || !bus || muted) return;
  const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = n;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = cutoff;
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  env(c, g, peak, 0.005, dur);
  src.start();
  src.stop(c.currentTime + dur + 0.02);
}

function trumpet(freq: number, dur: number, peak: number) {
  if (!bus) return;
  tone(freq, dur, "square", peak, bus.music);
  tone(freq * 1.2599, dur * 0.92, "square", peak * 0.42, bus.music);
}

export function unlockAudio() {
  if (!bus) {
    const c = new AudioContext({ latencyHint: "interactive" });
    const master = c.createGain();
    const sfx = c.createGain();
    const music = c.createGain();
    master.gain.value = 0.7;
    sfx.gain.value = 0.9;
    music.gain.value = 0.22;
    sfx.connect(master);
    music.connect(master);
    master.connect(c.destination);
    bus = { ctx: c, master, sfx, music };
  }
  if (bus.ctx.state === "suspended") void bus.ctx.resume();
}

export function setMuted(v: boolean) {
  muted = v;
  if (bus) bus.master.gain.setTargetAtTime(v ? 0 : 0.7, bus.ctx.currentTime, 0.03);
}

export function startMusic() {
  musicOn = true;
}

export function stopMusic() {
  musicOn = false;
}

export function tickMusic(dt: number) {
  if (!musicOn || muted || !bus) return;
  musicTimer += dt;
  const beat = 0.14;
  if (musicTimer < beat) return;
  musicTimer -= beat;

  const bass = [98, 0, 146.83, 0, 98, 0, 146.83, 0, 130.81, 0, 196, 0, 146.83, 0, 146.83, 0];
  const lead = [
    392, 493.88, 587.33, 493.88, 392, 329.63, 392, 0, 440, 493.88, 587.33, 659.25, 587.33, 493.88, 392, 293.66, 493.88,
    587.33, 659.25, 587.33, 493.88, 392, 440, 493.88, 587.33, 493.88, 392, 329.63, 293.66, 392, 493.88, 392,
  ];
  const i = step % bass.length;
  const j = step % lead.length;
  const b = bass[i]!;
  if (b) {
    tone(b, 0.16, "triangle", 0.14, bus.music);
    tone(b * 0.5, 0.16, "triangle", 0.07, bus.music);
  }
  const l = lead[j]!;
  if (l && step % 2 === 0) trumpet(l, 0.2, 0.055);
  if (step % 2 === 1) tone(784, 0.05, "triangle", 0.025, bus.music);
  if (step % 4 === 2) noise(0.04, 0.035, bus.music, 1800);
  if (step % 32 === 0) tone(660, 0.22, "sawtooth", 0.04, bus.music, 280);
  step++;
}

export const sfx = {
  jump() {
    tone(520, 0.12, "square", 0.12, bus!.sfx, -280);
  },
  coin() {
    tone(880, 0.07, "square", 0.14, bus!.sfx);
    tone(1320, 0.1, "square", 0.1, bus!.sfx);
  },
  stomp() {
    noise(0.08, 0.22, bus!.sfx, 400);
    tone(180, 0.1, "triangle", 0.12, bus!.sfx, -80);
  },
  bump() {
    tone(140, 0.08, "square", 0.14, bus!.sfx, -40);
  },
  break() {
    noise(0.12, 0.2, bus!.sfx, 500);
  },
  power() {
    tone(330, 0.08, "square", 0.12, bus!.sfx);
    tone(440, 0.1, "square", 0.1, bus!.sfx);
    tone(660, 0.16, "square", 0.1, bus!.sfx);
  },
  fire() {
    tone(420, 0.08, "sawtooth", 0.08, bus!.sfx, -160);
  },
  hurt() {
    tone(220, 0.2, "sawtooth", 0.14, bus!.sfx, -140);
  },
  die() {
    tone(400, 0.4, "square", 0.12, bus!.sfx, -320);
  },
  flag() {
    [392, 493.88, 587.33, 784].forEach((f, i) => {
      setTimeout(() => tone(f, 0.16, "square", 0.12, bus!.sfx), i * 90);
    });
  },
  pause() {
    tone(300, 0.06, "square", 0.08, bus!.sfx);
  },
};

function safe(fn: () => void) {
  if (!bus || muted) return;
  try {
    fn();
  } catch {
    /* ignore */
  }
}

export function play(name: keyof typeof sfx) {
  safe(() => sfx[name]());
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!bus) return;
    if (document.hidden) void bus.ctx.suspend();
    else if (!muted) void bus.ctx.resume();
  });
}
