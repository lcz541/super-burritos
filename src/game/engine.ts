import {
  TILE,
  VIEW_W,
  VIEW_H,
  STEP,
  T,
  SOLID,
  GRAVITY_UP,
  GRAVITY_DOWN,
  GRAVITY_APEX,
  APEX_V,
  JUMP_VEL,
  DOUBLE_JUMP_VEL,
  MAX_AIR_JUMPS,
  JUMP_CUT,
  MAX_FALL,
  ACCEL_G,
  FRICTION,
  ACCEL_A,
  MAX_RUN,
  COYOTE,
  JUMP_BUFFER,
  DROP_TIME,
  PW,
  PH,
  STOMP_PAD,
  HURT_PAD,
  SHELL_SPEED,
  SAVE_KEY,
} from "./const";
import { createInput } from "./input";
import { loadArt, drawSheet, type Art } from "./assets";
import { buildLevel, LEVEL_COUNT, MAP_NODES, type Level } from "./levels";
import { useGame, type Hud, type Phase } from "./store";
import { unlockAudio, startMusic, stopMusic, tickMusic, play, setMuted } from "./audio";

type Enemy = {
  kind: "nacho" | "taco" | "fish" | "octo";
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  dir: number;
  state: "walk" | "shell" | "slide" | "squash";
  t: number;
  dead: boolean;
  chip: boolean;
  homeY: number;
  cool: number;
};

type Actor =
  | { kind: "coin"; x: number; y: number; t: number; dead: boolean; rising: number }
  | { kind: "sauce"; x: number; y: number; t: number; dead: boolean }
  | { kind: "salsa"; x: number; y: number; vx: number; vy: number; bounces: number; dead: boolean }
  | { kind: "ink"; x: number; y: number; vx: number; vy: number; t: number; dead: boolean }
  | { kind: "flag"; x: number; y: number; w: number; h: number };

type Boss = {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  max: number;
  t: number;
  flash: number;
  hop: number;
  dead: boolean;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string };
type Pop = { x: number; y: number; text: string; life: number };

type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  grounded: boolean;
  coyote: number;
  buffer: number;
  invuln: number;
  powered: boolean;
  fireCd: number;
  dead: boolean;
  dropT: number;
  warpT: number;
  squash: number;
  stretch: number;
  anim: number;
  clearing: boolean;
  jumpHeldPrev: boolean;
  airJumps: number;
};

function loadSave(): { high: number; cleared: number } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { high: 0, cleared: -1 };
    const p = JSON.parse(raw) as { high?: number; cleared?: number };
    return { high: p.high ?? 0, cleared: typeof p.cleared === "number" ? p.cleared : -1 };
  } catch {
    return { high: 0, cleared: -1 };
  }
}

function saveSave(high: number, cleared: number) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, high, cleared }));
  } catch {
    /* ignore */
  }
}

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function createGame(canvas: HTMLCanvasElement, root: HTMLElement) {
  const maybe = canvas.getContext("2d");
  if (!maybe) throw new Error("Canvas unsupported");
  const ctx: CanvasRenderingContext2D = maybe;

  const input = createInput();
  const unbind = input.bindPointer(root);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let art: Art | null = null;
  let level: Level = buildLevel(0);
  let tiles = level.tiles;
  let W = level.w;
  let H = level.h;
  let enemies: Enemy[] = [];
  let actors: Actor[] = [];
  let particles: Particle[] = [];
  let pops: Pop[] = [];
  let boss: Boss | null = null;
  const bumps = new Map<number, number>();

  const player: Player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    coyote: 0,
    buffer: 0,
    invuln: 0,
    powered: false,
    fireCd: 0,
    dead: false,
    dropT: 0,
    warpT: 0,
    squash: 1,
    stretch: 1,
    anim: 0,
    clearing: false,
    jumpHeldPrev: false,
    airJumps: MAX_AIR_JUMPS,
  };

  let camX = 0;
  let camY = 0;
  let look = 0;
  let trauma = 0;
  let hitstop = 0;
  let score = 0;
  let coins = 0;
  let lives = 3;
  let timeLeft = 400;
  let timeAcc = 0;
  let hudAcc = 0;
  let high = 0;
  let cleared = -1;
  let mapIndex = 0;
  let mapCd = 0;
  let spawnX = 0;
  let spawnY = 0;
  let deathT = 0;
  let clearT = 0;
  let titleCam = 0;
  let lastMoveX = 0;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let running = true;
  let lastLandVy = 0;

  function at(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return T.Hard;
    return tiles[ty * W + tx]!;
  }
  function setAt(tx: number, ty: number, v: number) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    tiles[ty * W + tx] = v;
  }
  function isSolid(tx: number, ty: number) {
    return !!SOLID[at(tx, ty)];
  }
  function isOneWay(tx: number, ty: number) {
    return at(tx, ty) === T.OneWay;
  }

  function addScore(n: number, x?: number, y?: number) {
    score += n;
    if (x != null && y != null) pops.push({ x, y, text: `+${n}`, life: 0.7 });
    if (score > high) {
      high = score;
      saveSave(high, cleared);
    }
  }

  function burst(x: number, y: number, color: string, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.35 + Math.random() * 0.3,
        max: 0.6,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  function sync(extra: Partial<Hud> = {}) {
    useGame.getState().patch({
      score,
      coins,
      lives,
      world: level.world,
      time: Math.max(0, Math.ceil(timeLeft)),
      powered: player.powered,
      highScore: high,
      ...extra,
    });
  }

  function setPhase(phase: Phase, message = "") {
    useGame.getState().patch({ phase, message });
  }

  function spawnFromLevel() {
    enemies = [];
    actors = [];
    particles = [];
    pops = [];
    bumps.clear();
    for (const s of level.spawns) {
      if (s.kind === "nacho") {
        enemies.push({ kind: "nacho", x: s.x, y: s.y, vx: -40, vy: 0, w: 24, h: 18, dir: -1, state: "walk", t: 0, dead: false, chip: false, homeY: s.y, cool: 0 });
      } else if (s.kind === "taco") {
        enemies.push({ kind: "taco", x: s.x, y: s.y, vx: -36, vy: 0, w: 24, h: 24, dir: -1, state: "walk", t: 0, dead: false, chip: false, homeY: s.y, cool: 0 });
      } else if (s.kind === "fish") {
        enemies.push({ kind: "fish", x: s.x, y: s.y, vx: -60, vy: 0, w: 28, h: 18, dir: -1, state: "walk", t: Math.random() * 4, dead: false, chip: false, homeY: s.y, cool: 0 });
      } else if (s.kind === "octo") {
        enemies.push({ kind: "octo", x: s.x, y: s.y, vx: -28, vy: 0, w: 36, h: 32, dir: -1, state: "walk", t: Math.random() * 2, dead: false, chip: false, homeY: s.y, cool: 1.4 });
      } else if (s.kind === "coin") {
        actors.push({ kind: "coin", x: s.x, y: s.y, t: Math.random(), dead: false, rising: 0 });
      } else if (s.kind === "sauce") {
        actors.push({ kind: "sauce", x: s.x, y: s.y, t: 0, dead: false });
      } else if (s.kind === "flag") {
        actors.push({ kind: "flag", x: s.x, y: s.y - 48, w: 16, h: 96 });
      }
    }
  }

  function placePlayer() {
    player.x = spawnX;
    player.y = spawnY;
    player.vx = 0;
    player.vy = 0;
    player.facing = 1;
    player.grounded = false;
    player.coyote = 0;
    player.buffer = 0;
    player.invuln = 1.2;
    player.dead = false;
    player.dropT = 0;
    player.warpT = 0;
    player.squash = 1;
    player.stretch = 1;
    player.clearing = false;
    player.anim = 0;
    player.jumpHeldPrev = false;
    player.airJumps = MAX_AIR_JUMPS;
    deathT = 0;
    clearT = 0;
    camX = player.x - VIEW_W * 0.3;
    camY = player.y - VIEW_H * 0.6;
  }

  function loadLevel(id: number) {
    level = buildLevel(id);
    tiles = level.tiles;
    W = level.w;
    H = level.h;
    spawnX = level.spawnX;
    spawnY = level.spawnY;
    timeLeft = level.time;
    spawnFromLevel();
    placePlayer();
    boss = level.boss
      ? {
          x: (level.w - 8) * TILE,
          y: 13 * TILE - 72,
          w: 88,
          h: 72,
          hp: 8,
          max: 8,
          t: 0.6,
          flash: 0,
          hop: 0,
          dead: false,
        }
      : null;
    sync({ world: level.world, time: level.time });
  }

  function showMap(select?: number) {
    if (select != null) mapIndex = Math.max(0, Math.min(LEVEL_COUNT - 1, select));
    const node = MAP_NODES[mapIndex] ?? MAP_NODES[0]!;
    setPhase("map", node.name);
    sync({ world: node.label, message: node.name });
    startMusic();
  }

  function finishCourse() {
    if (level.id > cleared) cleared = level.id;
    saveSave(high, cleared);
    if (level.id >= LEVEL_COUNT - 1) {
      stopMusic();
      setPhase("win", "You cleaned the whole menu.");
    } else {
      showMap(level.id + 1);
    }
  }

  function startRun() {
    lives = 3;
    score = 0;
    coins = 0;
    player.powered = false;
    sync();
    showMap(Math.min(LEVEL_COUNT - 1, Math.max(0, cleared + 1)));
  }

  function collectCoin(x: number, y: number) {
    coins += 1;
    addScore(200, x, y);
    play("coin");
    burst(x, y, "#e8c547", 6);
    if (coins >= 100) {
      coins -= 100;
      lives += 1;
      play("power");
    }
  }

  function hurtPlayer() {
    if (player.invuln > 0 || player.dead || player.clearing) return;
    if (player.powered) {
      player.powered = false;
      player.invuln = 1.6;
      player.vy = -240;
      player.vx = -player.facing * 120;
      play("hurt");
      trauma = Math.min(1, trauma + 0.35);
      sync({ powered: false });
      return;
    }
    killPlayer();
  }

  function killPlayer() {
    if (player.dead) return;
    player.dead = true;
    player.vy = -380;
    player.vx = 0;
    player.powered = false;
    deathT = 0;
    play("die");
    stopMusic();
    trauma = 0.8;
    setPhase("dead");
  }

  function resolveX(b: { x: number; y: number; vx: number; w: number; h: number }) {
    const x0 = Math.floor(b.x / TILE);
    const x1 = Math.floor((b.x + b.w - 0.001) / TILE);
    const y0 = Math.floor(b.y / TILE);
    const y1 = Math.floor((b.y + b.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!isSolid(tx, ty)) continue;
        if (b.vx > 0) {
          if (isSolid(tx - 1, ty)) continue;
          b.x = tx * TILE - b.w;
          b.vx = 0;
        } else if (b.vx < 0) {
          if (isSolid(tx + 1, ty)) continue;
          b.x = (tx + 1) * TILE;
          b.vx = 0;
        }
      }
    }
  }

  function resolveY(
    b: { x: number; y: number; vy: number; w: number; h: number },
    prevBottom: number,
    allowOneWay: boolean,
    drop: boolean,
  ) {
    let grounded = false;
    let hitCeil = false;
    let head: { tx: number; ty: number; kind: number } | null = null;
    const x0 = Math.floor(b.x / TILE);
    const x1 = Math.floor((b.x + b.w - 0.001) / TILE);
    const y0 = Math.floor(b.y / TILE);
    const y1 = Math.floor((b.y + b.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const kind = at(tx, ty);
        const solid = isSolid(tx, ty);
        const ow = allowOneWay && isOneWay(tx, ty);
        if (!solid && !ow) continue;
        const top = ty * TILE;
        const bot = top + TILE;
        if (b.vy >= 0) {
          if (ow && (drop || prevBottom > top + 4)) continue;
          if (solid && isSolid(tx, ty - 1)) continue;
          b.y = top - b.h;
          b.vy = 0;
          grounded = true;
        } else {
          if (ow) continue;
          if (solid && isSolid(tx, ty + 1)) continue;
          b.y = bot;
          b.vy = 0;
          hitCeil = true;
          head = { tx, ty, kind };
        }
      }
    }
    return { grounded, hitCeil, head };
  }

  function moveBody(
    b: { x: number; y: number; vx: number; vy: number; w: number; h: number },
    dt: number,
    opts: { oneWay: boolean; drop: boolean },
  ) {
    const dist = Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt;
    const steps = Math.max(1, Math.ceil(dist / (TILE * 0.4)));
    const sdt = dt / steps;
    let grounded = false;
    let hitCeil = false;
    let head: { tx: number; ty: number; kind: number } | null = null;
    for (let i = 0; i < steps; i++) {
      b.x += b.vx * sdt;
      resolveX(b);
      const prevBottom = b.y + b.h;
      b.y += b.vy * sdt;
      const r = resolveY(b, prevBottom, opts.oneWay, opts.drop);
      if (r.grounded) grounded = true;
      if (r.hitCeil) {
        hitCeil = true;
        head = r.head;
      }
    }
    return { grounded, hitCeil, head };
  }

  function bumpTile(tx: number, ty: number, kind: number) {
    const idx = ty * W + tx;
    bumps.set(idx, -10);
    play("bump");
    if (kind === T.QCoin || kind === T.QSauce) {
      setAt(tx, ty, T.Used);
      const cx = tx * TILE + 8;
      const cy = ty * TILE - 8;
      if (kind === T.QSauce) {
        actors.push({ kind: "sauce", x: cx, y: ty * TILE - 2, t: 0, dead: false });
      } else {
        actors.push({ kind: "coin", x: cx, y: cy, t: 0, dead: false, rising: 0.35 });
      }
      addScore(50, cx, cy);
    } else if (kind === T.Brick) {
      if (player.powered) {
        setAt(tx, ty, T.Air);
        play("break");
        burst(tx * TILE + 16, ty * TILE + 16, "#c4783a", 10);
        addScore(50);
      }
    }
    for (const e of enemies) {
      if (e.dead) continue;
      if (aabb(e.x, e.y, e.w, e.h, tx * TILE, ty * TILE - 18, TILE, 18)) {
        e.vy = -180;
        e.dead = true;
        e.state = "squash";
        e.t = 0;
        addScore(100, e.x, e.y);
      }
    }
  }

  function hitEnemy(e: Enemy, pad: number) {
    return aabb(player.x - pad, player.y, PW + pad * 2, PH, e.x, e.y, e.w, e.h);
  }

  function isStomp(e: Enemy) {
    if (player.vy < -40) return false;
    const feet = player.y + PH;
    const band = e.y + Math.max(16, e.h * 0.72);
    return feet <= band;
  }

  function toShell(e: Enemy) {
    e.state = "shell";
    e.vx = 0;
    e.dead = false;
    if (e.h > 16) {
      e.y += e.h - 14;
      e.h = 14;
    }
  }

  function kickShell(e: Enemy, dir?: number) {
    const side = dir ?? (player.x + PW / 2 < e.x + e.w / 2 ? -1 : 1);
    e.state = "slide";
    e.dead = false;
    e.vx = -side * SHELL_SPEED;
    e.dir = Math.sign(e.vx) || 1;
    player.invuln = Math.max(player.invuln, 0.2);
    play("bump");
  }

  function stomp(e: Enemy) {
    player.vy = JUMP_VEL * 0.55;
    player.buffer = 0;
    player.airJumps = MAX_AIR_JUMPS;
    player.invuln = Math.max(player.invuln, 0.12);
    hitstop = reduced() ? 0 : 0.05;
    trauma = Math.min(1, trauma + 0.25);
    play("stomp");
    player.squash = 1.25;
    player.stretch = 0.8;
    if (e.kind === "taco" && e.state === "walk") {
      toShell(e);
      addScore(100, e.x, e.y);
    } else if (e.kind === "taco" && e.state === "slide") {
      toShell(e);
      addScore(100, e.x, e.y);
    } else if (e.kind === "taco") {
      kickShell(e);
    } else {
      e.state = "squash";
      e.dead = true;
      e.t = 0;
      e.vx = 0;
      addScore(100, e.x, e.y);
      burst(e.x + 8, e.y + 8, e.kind === "octo" ? "#7a3ea8" : "#e8c547", 7);
      if (e.chip) hurtBoss();
    }
  }

  function hurtBoss() {
    if (!boss || boss.dead) return;
    boss.hp -= 1;
    boss.flash = 0.16;
    addScore(200, boss.x, boss.y);
    if (boss.hp <= 0) {
      boss.dead = true;
      burst(boss.x + 40, boss.y + 30, "#f15a24", 18);
      player.clearing = true;
      player.vx = 0;
      addScore(2000, boss.x, boss.y);
      play("flag");
      stopMusic();
      setPhase("clear", "The nacho bowl spilled.");
      clearT = 0;
    }
  }

  function stepPlayer(dt: number, a: ReturnType<ReturnType<typeof createInput>["sample"]>) {
    if (player.clearing) {
      player.vx = 0;
      player.vy = 90;
      const body = { x: player.x, y: player.y, vx: player.vx, vy: player.vy, w: PW, h: PH };
      const r = moveBody(body, dt, { oneWay: true, drop: false });
      player.x = body.x;
      player.y = body.y;
      player.vy = body.vy;
      if (r.grounded) player.vy = 0;
      clearT += dt;
      if (clearT > 1.4) finishCourse();
      return;
    }

    if (player.dead) {
      player.vy += GRAVITY_DOWN * dt;
      player.y += player.vy * dt;
      deathT += dt;
      if (deathT > 1.35) {
        lives -= 1;
        if (lives <= 0) {
          setPhase("gameover", "The chips won this round.");
          sync({ lives: 0 });
        } else {
          player.powered = false;
          loadLevel(level.id);
          startMusic();
          setPhase("playing");
          sync({ lives });
        }
      }
      return;
    }

    if (a.jump) player.buffer = JUMP_BUFFER;
    player.buffer = Math.max(0, player.buffer - dt);
    player.coyote = player.grounded ? COYOTE : Math.max(0, player.coyote - dt);
    player.dropT = Math.max(0, player.dropT - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.fireCd = Math.max(0, player.fireCd - dt);

    if (a.down && a.jump && player.grounded) player.dropT = DROP_TIME;

    const swimming = level.theme === "water";
    const canJump = player.coyote > 0;
    if (swimming) {
      if (player.buffer > 0) {
        player.vy = -250;
        player.buffer = 0;
        player.grounded = false;
        player.stretch = 1.12;
        player.squash = 0.9;
        play("jump");
      }
    } else if (player.buffer > 0 && canJump) {
      player.vy = JUMP_VEL;
      player.grounded = false;
      player.coyote = 0;
      player.buffer = 0;
      player.stretch = 1.28;
      player.squash = 0.78;
      play("jump");
    } else if (player.buffer > 0 && player.airJumps > 0 && !player.grounded) {
      player.airJumps -= 1;
      player.vy = DOUBLE_JUMP_VEL;
      player.buffer = 0;
      player.stretch = 1.2;
      player.squash = 0.84;
      play("jump");
      burst(player.x + PW / 2, player.y + PH, "#f4e8d0", 6);
    }
    if (!swimming && player.jumpHeldPrev && !a.jumpHeld && player.vy < 0) player.vy *= JUMP_CUT;
    player.jumpHeldPrev = a.jumpHeld;

    const accel = player.grounded ? ACCEL_G : ACCEL_A;
    lastMoveX = a.moveX;
    if (a.moveX !== 0) {
      player.vx += a.moveX * accel * dt;
      player.facing = a.moveX < 0 ? -1 : 1;
    } else if (player.grounded) {
      const s = Math.sign(player.vx);
      player.vx -= s * FRICTION * dt;
      if (Math.sign(player.vx) !== s) player.vx = 0;
    } else if (swimming) {
      player.vx *= Math.exp(-1.2 * dt);
    } else {
      player.vx *= 0.997;
    }
    const max = swimming ? 130 : MAX_RUN;
    if (player.vx > max) player.vx = max;
    if (player.vx < -max) player.vx = -max;

    if (swimming) {
      player.vy += 420 * dt;
      if (player.vy > 150) player.vy = 150;
      if (player.vy < -280) player.vy = -280;
    } else {
      let g = GRAVITY_DOWN;
      if (player.vy < 0) g = GRAVITY_UP;
      if (Math.abs(player.vy) < APEX_V) g = GRAVITY_APEX;
      player.vy += g * dt;
      if (player.vy > MAX_FALL) player.vy = MAX_FALL;
    }

    const body = { x: player.x, y: player.y, vx: player.vx, vy: player.vy, w: PW, h: PH };
    const prevVy = player.vy;
    const r = moveBody(body, dt, { oneWay: true, drop: player.dropT > 0 });
    player.x = body.x;
    player.y = body.y;
    player.vx = body.vx;
    player.vy = body.vy;
    if (r.grounded && !player.grounded) {
      lastLandVy = prevVy;
      player.squash = 1.2;
      player.stretch = 0.82;
      if (lastLandVy > 500) burst(player.x + PW / 2, player.y + PH, "#d9b48a", 5);
    }
    player.grounded = r.grounded;
    if (r.grounded) player.airJumps = MAX_AIR_JUMPS;
    if (r.hitCeil && r.head) bumpTile(r.head.tx, r.head.ty, r.head.kind);

    if (player.x < TILE) player.x = TILE;
    if (player.x > (W - 2) * TILE) player.x = (W - 2) * TILE;

    if (player.y > H * TILE + 40) killPlayer();

    if (player.powered && a.fire && player.fireCd <= 0) {
      player.fireCd = 0.28;
      actors.push({
        kind: "salsa",
        x: player.x + (player.facing > 0 ? PW : -8),
        y: player.y + 6,
        vx: player.facing * 240,
        vy: 40,
        bounces: 0,
        dead: false,
      });
      play("fire");
    }

    let onWarp = false;
    if (player.grounded && a.down) {
      const tx = Math.floor((player.x + PW / 2) / TILE);
      const ty = Math.floor((player.y + PH + 2) / TILE);
      const k = at(tx, ty);
      if (k === T.PipeLip || k === T.Pipe) {
        const warp = level.warps.find((w) => Math.abs(w.x - tx) <= 1);
        if (warp) {
          onWarp = true;
          player.warpT += dt;
          if (player.warpT > 0.32) {
            player.x = warp.toX * TILE;
            player.y = warp.toY * TILE - PH;
            player.warpT = 0;
            player.invuln = 0.6;
            burst(player.x, player.y, "#6b8f3c", 8);
          }
        }
      }
    }
    if (!onWarp) player.warpT = 0;

    player.squash += (1 - player.squash) * (1 - Math.exp(-12 * dt));
    player.stretch += (1 - player.stretch) * (1 - Math.exp(-12 * dt));
    player.anim += dt;
  }

  function stepEnemies(dt: number) {
    for (const e of enemies) {
      if (e.state === "squash") {
        e.t += dt;
        if (e.t > 0.45) e.dead = true;
        continue;
      }
      if (e.dead) continue;
      if (e.kind === "fish" || e.kind === "octo") {
        e.t += dt;
        const speed = e.kind === "fish" ? 62 : 26;
        e.dir = e.dir || -1;
        e.vx = e.dir * speed;
        e.x += e.vx * dt;
        const amp = e.kind === "fish" ? 20 : 8;
        e.y = e.homeY + Math.sin(e.t * (e.kind === "fish" ? 2.2 : 1.2)) * amp;
        const ahead = e.dir > 0 ? e.x + e.w + 4 : e.x - 4;
        const tx = Math.floor(ahead / TILE);
        const ty = Math.floor((e.y + e.h * 0.5) / TILE);
        if (e.x < TILE * 2 || e.x > (W - 3) * TILE || isSolid(tx, ty)) e.dir *= -1;
        if (e.kind === "octo") {
          e.cool -= dt;
          if (e.cool <= 0 && !player.dead && !player.clearing) {
            e.cool = 2.2;
            const dx = player.x - e.x;
            const dy = player.y - e.y;
            const len = Math.hypot(dx, dy) || 1;
            actors.push({ kind: "ink", x: e.x + e.w / 2, y: e.y + 8, vx: (dx / len) * 86, vy: (dy / len) * 86, t: 0, dead: false });
          }
        }
        continue;
      }
      e.vy += 2400 * dt;
      if (e.vy > 700) e.vy = 700;

      if (e.state === "walk") {
        const cruise = e.chip ? 78 : e.kind === "nacho" ? 42 : 36;
        e.vx = e.dir * cruise;
        const ahead = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
        const foot = Math.floor(ahead / TILE);
        const gy = Math.floor((e.y + e.h + 2) / TILE);
        if (isSolid(foot, Math.floor((e.y + 4) / TILE)) || (!isSolid(foot, gy) && !isOneWay(foot, gy))) {
          e.dir *= -1;
        }
      } else if (e.state === "slide") {
        /* keep vx */
      } else {
        e.vx = 0;
      }

      const body = { x: e.x, y: e.y, vx: e.vx, vy: e.vy, w: e.w, h: e.h };
      const r = moveBody(body, dt, { oneWay: true, drop: false });
      if (e.state === "walk" && body.vx === 0) e.dir *= -1;
      e.x = body.x;
      e.y = body.y;
      if (e.state === "slide") {
        if (body.vx === 0) {
          e.dir *= -1;
          e.vx = e.dir * SHELL_SPEED;
        } else {
          e.vx = body.vx;
        }
      } else {
        e.vx = e.vx;
      }
      e.vy = r.grounded ? 0 : body.vy;
      e.t += dt;

      if (e.state === "slide") {
        for (const o of enemies) {
          if (o === e || o.dead || o.state === "squash") continue;
          if (aabb(e.x, e.y, e.w, e.h, o.x, o.y, o.w, o.h)) {
            o.dead = true;
            o.state = "squash";
            o.t = 0;
            addScore(200, o.x, o.y);
            play("stomp");
          }
        }
      }
    }
    enemies = enemies.filter((e) => !(e.dead && e.state === "squash" && e.t > 0.45));
  }

  function stepActors(dt: number) {
    for (const a of actors) {
      if ("dead" in a && a.dead) continue;
      if (a.kind === "coin") {
        a.t += dt;
        if (a.rising > 0) {
          a.y -= 80 * dt;
          a.rising -= dt;
          if (a.rising <= 0) {
            a.dead = true;
            collectCoin(a.x, a.y);
          }
        }
      } else if (a.kind === "sauce") {
        a.t += dt;
        a.y += Math.sin(a.t * 6) * 8 * dt;
      } else if (a.kind === "ink") {
        a.t += dt;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.t > 2.6 || a.x < 0 || a.x > W * TILE) a.dead = true;
      } else if (a.kind === "salsa") {
        a.vy += 1800 * dt;
        const body = { x: a.x, y: a.y, vx: a.vx, vy: a.vy, w: 8, h: 8 };
        const r = moveBody(body, dt, { oneWay: true, drop: false });
        a.x = body.x;
        a.y = body.y;
        a.vx = body.vx;
        a.vy = body.vy;
        if (r.grounded) {
          a.vy = -220;
          a.bounces += 1;
        }
        if (r.hitCeil || a.bounces > 3 || a.x < 0 || a.x > W * TILE) a.dead = true;
        for (const e of enemies) {
          if (e.dead || e.state === "squash") continue;
          if (!aabb(a.x, a.y, 8, 8, e.x, e.y, e.w, e.h)) continue;
          a.dead = true;
          if (e.kind === "taco" && e.state === "walk") {
            toShell(e);
            addScore(100, e.x, e.y);
            burst(e.x + 8, e.y + 8, "#f15a24", 6);
            play("stomp");
          } else if (e.kind === "taco" && (e.state === "shell" || e.state === "slide")) {
            kickShell(e, a.vx >= 0 ? -1 : 1);
            addScore(100, e.x, e.y);
          } else {
            e.dead = true;
            e.state = "squash";
            e.t = 0;
            addScore(200, e.x, e.y);
            burst(e.x + 8, e.y + 8, "#f15a24", 8);
            play("stomp");
            if (e.chip) hurtBoss();
          }
        }
      }
    }
    actors = actors.filter((a) => !("dead" in a && a.dead));
  }

  function overlaps() {
    if (player.dead || player.clearing) return;
    const px = player.x;
    const py = player.y;
    if (boss && !boss.dead && aabb(px, py, PW, PH, boss.x + 8, boss.y + 16, boss.w - 16, boss.h - 12)) {
      const feet = py + PH;
      if (player.vy > -20 && feet < boss.y + 28) {
        player.vy = JUMP_VEL * 0.42;
        player.y = boss.y + 16 - PH;
      } else hurtPlayer();
    }
    for (const e of enemies) {
      if (e.dead || e.state === "squash") continue;
      if (!hitEnemy(e, STOMP_PAD)) continue;
      if (e.state === "shell") {
        if (isStomp(e)) {
          stomp(e);
        } else if (hitEnemy(e, HURT_PAD)) {
          kickShell(e);
          player.vx = (player.x + PW / 2 < e.x + e.w / 2 ? -1 : 1) * 90;
        }
        continue;
      }
      if (e.state === "slide") {
        if (isStomp(e)) stomp(e);
        else if (hitEnemy(e, HURT_PAD)) hurtPlayer();
        continue;
      }
      if (isStomp(e)) stomp(e);
      else if (hitEnemy(e, HURT_PAD)) hurtPlayer();
    }
    for (const a of actors) {
      if (a.kind === "coin" && !a.dead && a.rising <= 0 && aabb(px, py, PW, PH, a.x, a.y, 12, 12)) {
        a.dead = true;
        collectCoin(a.x, a.y);
      }
      if (a.kind === "sauce" && !a.dead && aabb(px, py, PW, PH, a.x - 4, a.y - 4, 22, 26)) {
        a.dead = true;
        player.powered = true;
        play("power");
        addScore(1000, a.x, a.y);
        burst(a.x, a.y, "#f15a24", 10);
        sync({ powered: true });
      }
      if (a.kind === "ink" && !a.dead && aabb(px, py, PW, PH, a.x - 6, a.y - 6, 14, 14)) {
        a.dead = true;
        hurtPlayer();
      }
      if (a.kind === "flag" && aabb(px, py, PW, PH, a.x, a.y, a.w, a.h)) {
        player.clearing = true;
        player.x = a.x + 2;
        addScore(Math.ceil(timeLeft) * 10);
        play("flag");
        stopMusic();
        setPhase("clear", level.name);
        clearT = 0;
      }
    }
  }

  function stepFx(dt: number) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 700 * dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const p of pops) p.life -= dt;
    pops = pops.filter((p) => p.life > 0);
    for (const [k, v] of bumps) {
      const n = v + 70 * dt;
      if (n >= 0) bumps.delete(k);
      else bumps.set(k, n);
    }
    trauma = Math.max(0, trauma - dt * 1.8);
  }

  function stepCamera(dt: number) {
    look += (player.facing * 64 - look) * (1 - Math.exp(-3.5 * dt));
    const tx = player.x + PW / 2 + look - VIEW_W / 2;
    const ty = player.y + PH / 2 - VIEW_H * 0.58;
    const k = player.grounded ? 7 : 4.5;
    camX += (tx - camX) * (1 - Math.exp(-k * dt));
    camY += (ty - camY) * (1 - Math.exp(-3.2 * dt));
    const maxX = W * TILE - VIEW_W;
    const maxY = H * TILE - VIEW_H;
    camX = Math.max(0, Math.min(maxX, camX));
    camY = Math.max(0, Math.min(Math.max(0, maxY), camY));
  }

  function stepBoss(dt: number) {
    if (!boss || boss.dead || player.dead || player.clearing) return;
    boss.t += dt;
    boss.flash = Math.max(0, boss.flash - dt);
    boss.hop = Math.max(0, boss.hop - dt);
    if (boss.t < 1.65) return;
    boss.t = 0;
    boss.hop = 0.28;
    const alive = enemies.filter((e) => e.chip && !e.dead && e.state !== "squash").length;
    const n = alive >= 5 ? 0 : alive >= 3 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      enemies.push({
        kind: "nacho",
        x: boss.x + 6,
        y: boss.y + 10,
        vx: -80 - i * 24,
        vy: -210 - i * 40,
        w: 18,
        h: 14,
        dir: -1,
        state: "walk",
        t: 0,
        dead: false,
        chip: true,
        homeY: boss.y,
        cool: 0,
      });
    }
    if (n > 0) play("bump");
  }

  function stepMap(dt: number, a: ReturnType<ReturnType<typeof createInput>["sample"]>) {
    mapCd = Math.max(0, mapCd - dt);
    player.anim += dt;
    const unlocked = Math.min(LEVEL_COUNT - 1, cleared + 1);
    let moved = false;
    if (mapCd <= 0 && a.moveX > 0 && mapIndex < unlocked) {
      mapIndex += 1;
      mapCd = 0.2;
      moved = true;
      play("bump");
    } else if (mapCd <= 0 && a.moveX < 0 && mapIndex > 0) {
      mapIndex -= 1;
      mapCd = 0.2;
      moved = true;
      play("bump");
    }
    const node = MAP_NODES[mapIndex];
    if (moved && node) sync({ world: node.label, message: node.name });
    if (a.jump && mapIndex <= unlocked) {
      loadLevel(mapIndex);
      setPhase("playing", "");
      startMusic();
    }
  }

  function step(dt: number) {
    const phase = useGame.getState().phase;
    tickMusic(dt);
    if (phase === "title" || phase === "howto") {
      titleCam += 28 * dt;
      return;
    }
    if (phase === "map") {
      stepMap(dt, input.sample());
      return;
    }
    if (phase === "paused") {
      const a = input.sample();
      if (a.pause || a.jump) setPhase("playing");
      return;
    }
    if (phase === "gameover" || phase === "win" || phase === "loading") return;

    const a = input.sample();
    if (phase === "playing" && a.pause) {
      setPhase("paused");
      play("pause");
      return;
    }

    if (hitstop > 0) {
      hitstop -= dt;
      return;
    }

    if (phase === "playing") {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        killPlayer();
      }
    }

    stepPlayer(dt, a);
    stepBoss(dt);
    stepEnemies(dt);
    stepActors(dt);
    overlaps();
    stepFx(dt);
    stepCamera(dt);

    hudAcc += dt;
    if (hudAcc > 0.2) {
      hudAcc = 0;
      sync();
    }
    void timeAcc;
  }

  function worldToScreen(x: number, y: number) {
    let sx = x - camX;
    let sy = y - camY;
    if (trauma > 0 && !reduced()) {
      const mag = trauma * trauma * 7;
      sx += (Math.random() - 0.5) * mag;
      sy += (Math.random() - 0.5) * mag;
    }
    return { x: sx, y: sy };
  }

  function drawParallax() {
    if (!art) return;
    const phase = useGame.getState().phase;
    const demo = phase === "title" || phase === "howto";
    const cx = demo ? titleCam : camX;
    const sky = level.theme === "cave" ? art.cave : art.sky;
    if (level.theme === "water") {
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, "#1f86c4");
      g.addColorStop(1, "#08345c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 18; i++) {
        const bx = ((i * 97 + player.anim * 18) % (VIEW_W + 20)) - 10;
        const by = (i * 53 + Math.sin(player.anim + i) * 12) % VIEW_H;
        ctx.fillStyle = "#d7f4ff";
        ctx.beginPath();
        ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    ctx.drawImage(sky, 0, 0, VIEW_W, VIEW_H);
    if (level.theme !== "cave") {
      const farX = -((cx * 0.15) % VIEW_W);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(art.far, farX, 0, VIEW_W, VIEW_H);
      ctx.drawImage(art.far, farX + VIEW_W, 0, VIEW_W, VIEW_H);
      const midX = -((cx * 0.38) % VIEW_W);
      ctx.globalAlpha = 0.92;
      ctx.drawImage(art.mid, midX, 18, VIEW_W, VIEW_H);
      ctx.drawImage(art.mid, midX + VIEW_W, 18, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  function drawTiles() {
    if (!art) return;
    const tx0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const tx1 = Math.min(W - 1, Math.floor((camX + VIEW_W) / TILE) + 2);
    const ty0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const ty1 = Math.min(H - 1, Math.floor((camY + VIEW_H) / TILE) + 2);
    const drawnPipe = new Set<number>();

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const kind = at(tx, ty);
        if (kind === T.Air) continue;
        const bump = bumps.get(ty * W + tx) ?? 0;
        const p = worldToScreen(tx * TILE, ty * TILE + bump);

        if (kind === T.Pipe || kind === T.PipeLip) {
          const key = ty * W + tx;
          if (drawnPipe.has(key)) continue;
          if (kind === T.PipeLip && (tx === 0 || at(tx - 1, ty) !== T.PipeLip)) {
            let h = 1;
            while (at(tx, ty + h) === T.Pipe) h++;
            for (let i = 0; i < h; i++) {
              drawnPipe.add((ty + i) * W + tx);
              drawnPipe.add((ty + i) * W + tx + 1);
            }
            ctx.drawImage(art.pipe, p.x, p.y, TILE * 2, TILE * h);
          }
          continue;
        }

        if (kind === T.Ground) {
          ctx.fillStyle = "#b86a3a";
          ctx.fillRect(p.x, p.y, TILE, TILE);
          ctx.fillStyle = "#6b8f3c";
          ctx.fillRect(p.x, p.y, TILE, 8);
          ctx.drawImage(art.tileGround, p.x, p.y - 4, TILE, TILE);
        } else if (kind === T.Dirt) {
          ctx.fillStyle = "#8a4e2a";
          ctx.fillRect(p.x, p.y, TILE, TILE);
          ctx.drawImage(art.tileDirt, p.x, p.y, TILE, TILE);
        } else if (kind === T.Brick) {
          ctx.drawImage(art.brick, p.x, p.y, TILE, TILE);
        } else if (kind === T.QCoin || kind === T.QSauce) {
          ctx.drawImage(art.qblock, p.x, p.y, TILE, TILE);
        } else if (kind === T.Used) {
          ctx.drawImage(art.tileUsed, p.x, p.y, TILE, TILE);
        } else if (kind === T.Hard) {
          ctx.fillStyle = "#6a3d24";
          ctx.fillRect(p.x, p.y, TILE, TILE);
          ctx.drawImage(art.tileHard, p.x, p.y, TILE, TILE);
        } else if (kind === T.OneWay) {
          const img = at(tx - 1, ty) !== T.OneWay ? art.platL : at(tx + 1, ty) !== T.OneWay ? art.platR : art.platM;
          ctx.drawImage(img, p.x, p.y - 4, TILE, TILE);
        }
      }
    }
  }

  function drawEntities() {
    if (!art) return;
    const t = player.anim;
    for (const a of actors) {
      if (a.kind === "coin") {
        const p = worldToScreen(a.x - 6, a.y - 6 + Math.sin(a.t * 6) * 2);
        drawSheet(ctx, art.coin, Math.floor(a.t * 8), p.x, p.y, 24, 24);
      } else if (a.kind === "sauce") {
        const p = worldToScreen(a.x - 6, a.y - 8 + Math.sin(a.t * 5) * 3);
        ctx.drawImage(art.hotsauce, p.x, p.y, 22, 26);
      } else if (a.kind === "salsa") {
        const p = worldToScreen(a.x - 6, a.y - 6);
        drawSheet(ctx, art.salsa, Math.floor(t * 10), p.x, p.y, 16, 16);
      } else if (a.kind === "ink") {
        const p = worldToScreen(a.x, a.y);
        ctx.fillStyle = "rgba(18, 8, 28, 0.82)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (a.kind === "flag") {
        const p = worldToScreen(a.x - 6, a.y);
        ctx.drawImage(art.flag, p.x, p.y, 28, a.h);
      }
    }
    for (const e of enemies) {
      const flip = e.dir > 0;
      if (e.kind === "nacho") {
        const sc = e.chip ? 0.7 : 1;
        const p = worldToScreen(e.x + e.w / 2 - 20 * sc, e.y + e.h - 40 * sc);
        if (e.state === "squash") ctx.drawImage(art.nachoSquash, p.x, p.y + 16 * sc, 40 * sc, 20 * sc);
        else drawSheet(ctx, art.nacho, Math.floor(e.t * 8), p.x, p.y, 40 * sc, 40 * sc, flip);
      } else if (e.kind === "fish") {
        const p = worldToScreen(e.x + e.w / 2 - 22, e.y + e.h - 34);
        drawSheet(ctx, art.fish, Math.floor(e.t * 8), p.x, p.y, 44, 34, flip);
      } else if (e.kind === "octo") {
        const p = worldToScreen(e.x + e.w / 2 - 24, e.y + e.h - 48);
        drawSheet(ctx, art.octo, Math.floor(e.t * 6), p.x, p.y, 48, 48, flip);
      } else {
        const p = worldToScreen(e.x + e.w / 2 - 20, e.y + e.h - 44);
        if (e.state === "shell" || e.state === "slide") ctx.drawImage(art.tacoShell, p.x, p.y + 16, 40, 24);
        else if (e.state === "squash") ctx.drawImage(art.tacoShell, p.x, p.y + 20, 40, 16);
        else drawSheet(ctx, art.taco, Math.floor(e.t * 8), p.x, p.y, 40, 44, flip);
      }
    }

    if (boss && !boss.dead) {
      const hop = boss.hop > 0 ? -10 : 0;
      const p = worldToScreen(boss.x, boss.y + hop);
      ctx.save();
      if (boss.flash > 0) ctx.globalAlpha = 0.45;
      ctx.drawImage(art.bowl, p.x, p.y, boss.w, boss.h);
      ctx.restore();
      for (let i = 0; i < boss.max; i++) {
        ctx.fillStyle = i < boss.hp ? "#f15a24" : "#3a2418";
        ctx.fillRect(p.x + 4 + i * 10, p.y - 8, 8, 5);
      }
    }

    if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0 && !player.dead) return;
    const pw = 52 * player.stretch;
    const ph = 52 * player.squash;
    const p = worldToScreen(player.x + PW / 2 - pw / 2, player.y + PH - ph);
    const flip = player.facing < 0;
    const gun = player.powered;
    let sheet = gun ? art.heroIdleGun : art.heroIdle;
    let frame = Math.floor(player.anim * 6);
    if (player.dead || player.clearing) {
      sheet = gun ? art.heroJumpGun : art.heroJump;
      frame = 3;
    } else if (!player.grounded) {
      sheet = gun ? art.heroJumpGun : art.heroJump;
      frame = player.vy < -80 ? 1 : player.vy < 80 ? 2 : 3;
    } else if (Math.abs(player.vx) > 25) {
      sheet = gun ? art.heroRunGun : art.heroRun;
      frame = Math.floor(player.anim * 10);
    }
    drawSheet(ctx, sheet, frame, p.x, p.y, pw, ph, flip);

    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      const s = worldToScreen(pt.x, pt.y);
      ctx.fillRect(s.x, s.y, pt.size, pt.size);
      ctx.globalAlpha = 1;
    }
    ctx.font = "700 11px Nunito, sans-serif";
    ctx.fillStyle = "#f4e8d0";
    ctx.textAlign = "center";
    for (const pop of pops) {
      const s = worldToScreen(pop.x, pop.y - (0.7 - pop.life) * 28);
      ctx.globalAlpha = Math.min(1, pop.life * 2);
      ctx.fillText(pop.text, s.x, s.y);
      ctx.globalAlpha = 1;
    }
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function drawMap() {
    if (!art) return;
    const g = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    g.addColorStop(0, "#e7b56a");
    g.addColorStop(0.46, "#c9843a");
    g.addColorStop(0.52, "#1f86c4");
    g.addColorStop(1, "#0b4f86");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#f4e2b0";
    ctx.fillRect(0, 250, 360, 110);
    ctx.fillStyle = "#0a3e6e";
    ctx.fillRect(360, 250, 280, 110);
    ctx.strokeStyle = "#fff6e8";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    MAP_NODES.forEach((n, i) => {
      if (i === 0) ctx.moveTo(n.x, n.y);
      else ctx.lineTo(n.x, n.y);
    });
    ctx.stroke();
    const unlocked = Math.min(LEVEL_COUNT - 1, cleared + 1);
    for (const n of MAP_NODES) {
      const open = n.id <= unlocked;
      const done = n.id <= cleared;
      ctx.beginPath();
      ctx.fillStyle = !open ? "#6b5344" : n.boss ? "#f15a24" : n.water ? "#7fd0ff" : "#fff6e8";
      ctx.arc(n.x, n.y, n.boss ? 16 : 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = n.id === mapIndex ? 4 : 2;
      ctx.strokeStyle = done ? "#2f7d32" : "#2a1208";
      ctx.stroke();
      ctx.fillStyle = "#2a1208";
      ctx.font = "700 11px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n.boss ? "BOSS" : n.label, n.x, n.y + 28);
    }
    const here = MAP_NODES[mapIndex];
    if (here) {
      const bob = Math.sin(player.anim * 6) * 3;
      drawSheet(ctx, art.heroIdle, Math.floor(player.anim * 6), here.x - 18, here.y - 46 + bob, 36, 36, false);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff8f0";
    ctx.font = "700 22px 'Lilita One', sans-serif";
    ctx.fillText("WORLD MAP", 16, 32);
    ctx.font = "700 14px Nunito, sans-serif";
    ctx.fillText("Land  ·  then the tide", 16, 52);
    const name = here?.name ?? "";
    ctx.textAlign = "right";
    ctx.fillText(name, VIEW_W - 16, 32);
    ctx.font = "600 12px Nunito, sans-serif";
    ctx.fillText("Move, then jump", VIEW_W - 16, 50);
    ctx.textAlign = "left";
  }

  function draw() {
    resize();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (!art) {
      ctx.fillStyle = "#1c0b06";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }
    const phase = useGame.getState().phase;
    if (phase === "map") {
      drawMap();
      return;
    }
    if (phase === "title" || phase === "howto") {
      camX = titleCam;
      camY = 80;
    }
    drawParallax();
    drawTiles();
    drawEntities();
  }

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  window.__controlsTest = {
    getYaw: () => (player.facing < 0 ? Math.PI : 0),
    getSpeed: () => Math.hypot(player.vx, player.vy),
    setKeys: (codes: string[]) => input.setKeys(codes),
    getX: () => player.x,
    getVx: () => player.vx,
    getY: () => player.y,
    getVy: () => player.vy,
    getAirJumps: () => player.airJumps,
    getMoveX: () => lastMoveX,
    getInjected: () => input.getInjected(),
    isDead: () => player.dead,
    isGrounded: () => player.grounded,
    setPowered: (v: boolean) => {
      player.powered = v;
      sync({ powered: v });
    },
  };

  raf = requestAnimationFrame(frame);

  loadArt()
    .then((a) => {
      art = a;
      loadLevel(0);
      const saved = loadSave();
      high = saved.high;
      cleared = saved.cleared;
      useGame.getState().patch({ phase: "title", highScore: high, ready: true });
    })
    .catch((err) => {
      console.error(err);
      useGame.getState().patch({ phase: "title", message: "Some art failed to load.", ready: true });
    });

  return {
    start: startRun,
    pause() {
      const p = useGame.getState().phase;
      if (p === "playing") setPhase("paused");
      else if (p === "paused") setPhase("playing");
    },
    resumeFromOverlay() {
      const p = useGame.getState().phase;
      if (p === "paused") setPhase("playing");
      if (p === "gameover" || p === "win") startRun();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      input.dispose();
      unbind();
    },
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      getX: () => number;
      getVx: () => number;
      getY?: () => number;
      getVy?: () => number;
      getAirJumps?: () => number;
      getMoveX?: () => number;
      getInjected?: () => string[];
      isDead?: () => boolean;
      isGrounded?: () => boolean;
      setPowered?: (v: boolean) => void;
    };
    __game?: { start: () => void; pause: () => void };
  }
}
