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

function noise(dur: number, peak: number, dest: GainNode) {
  const c = ctx();
  if (!c || !bus || muted) return;
  const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = n;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  env(c, g, peak, 0.005, dur);
  src.start();
  src.stop(c.currentTime + dur + 0.02);
}

export function unlockAudio() {
  if (!bus) {
    const c = new AudioContext({ latencyHint: "interactive" });
    const master = c.createGain();
    const sfx = c.createGain();
    const music = c.createGain();
    master.gain.value = 0.7;
    sfx.gain.value = 0.9;
    music.gain.value = 0.18;
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
  const beat = 0.22;
  if (musicTimer < beat) return;
  musicTimer -= beat;
  const bass = [98, 98, 130.8, 87.3, 98, 73.4, 87.3, 98];
  const lead = [392, 440, 523.25, 440, 392, 349.23, 329.63, 392, 523.25, 440, 392, 349.23, 293.66, 329.63, 349.23, 392];
  const i = step % bass.length;
  const j = step % lead.length;
  tone(bass[i]!, 0.18, "triangle", 0.12, bus.music);
  if (step % 2 === 0) tone(lead[j]!, 0.16, "square", 0.05, bus.music);
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
    noise(0.08, 0.22, bus!.sfx);
    tone(180, 0.1, "triangle", 0.12, bus!.sfx, -80);
  },
  bump() {
    tone(140, 0.08, "square", 0.14, bus!.sfx, -40);
  },
  break() {
    noise(0.12, 0.2, bus!.sfx);
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
    [523, 659, 784, 1046].forEach((f, i) => {
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
