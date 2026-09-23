import { T, TILE } from "./const";

export type Spawn =
  | { kind: "nacho"; x: number; y: number }
  | { kind: "taco"; x: number; y: number }
  | { kind: "fish"; x: number; y: number }
  | { kind: "octo"; x: number; y: number }
  | { kind: "coin"; x: number; y: number }
  | { kind: "sauce"; x: number; y: number }
  | { kind: "flag"; x: number; y: number };

export type Warp = { x: number; y: number; toX: number; toY: number };

export type Level = {
  id: number;
  name: string;
  world: string;
  theme: "overworld" | "cave" | "water";
  boss?: boolean;
  w: number;
  h: number;
  tiles: Uint8Array;
  spawns: Spawn[];
  warps: Warp[];
  spawnX: number;
  spawnY: number;
  time: number;
};

function make(w: number, h: number, g: number): { t: Uint8Array; set: (x: number, y: number, v: number) => void; g: number; w: number; h: number } {
  const t = new Uint8Array(w * h);
  const set = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    t[y * w + x] = v;
  };
  for (let x = 0; x < w; x++) {
    set(x, g, T.Ground);
    for (let y = g + 1; y < h; y++) set(x, y, T.Dirt);
  }
  set(0, g, T.Hard);
  set(w - 1, g, T.Hard);
  for (let y = 0; y < h; y++) {
    set(0, y, y >= g ? T.Hard : T.Hard);
    set(w - 1, y, T.Hard);
  }
  for (let y = 0; y < g; y++) {
    set(0, y, T.Air);
    set(w - 1, y, T.Air);
  }
  return { t, set, g, w, h };
}

function pit(L: ReturnType<typeof make>, x0: number, x1: number) {
  for (let x = x0; x < x1; x++) for (let y = L.g; y < L.h; y++) L.set(x, y, T.Air);
}

function pipe(L: ReturnType<typeof make>, x: number, height = 3) {
  for (let i = 0; i < height; i++) {
    const y = L.g - i;
    const kind = i === height - 1 ? T.PipeLip : T.Pipe;
    L.set(x, y, kind);
    L.set(x + 1, y, kind);
  }
}

function row(L: ReturnType<typeof make>, x0: number, x1: number, y: number, v: number) {
  for (let x = x0; x < x1; x++) L.set(x, y, v);
}

function stairs(L: ReturnType<typeof make>, x: number, steps: number, dir = 1) {
  for (let i = 0; i < steps; i++) {
    const sx = x + i * dir;
    for (let k = 0; k <= i; k++) L.set(sx, L.g - 1 - k, T.Hard);
  }
}

function coins(spawns: Spawn[], x0: number, x1: number, y: number) {
  for (let x = x0; x < x1; x++) spawns.push({ kind: "coin", x: x * TILE + 8, y: y * TILE + 8 });
}

export function buildLevel(id: number): Level {
  if (id === 1) return grotto();
  if (id === 2) return chile();
  if (id === 3) return hacienda();
  if (id === 4) return bowlArena();
  if (id === 5) return tide();
  if (id === 6) return kelp();
  if (id === 7) return coral();
  if (id === 8) return trench();
  return plains();
}

function plains(): Level {
  const w = 210;
  const h = 16;
  const L = make(w, h, 13);
  const spawns: Spawn[] = [];
  const warps: Warp[] = [];

  pit(L, 36, 40);
  pit(L, 78, 83);
  pit(L, 148, 153);

  L.set(38, 10, T.OneWay);
  L.set(39, 10, T.OneWay);

  row(L, 18, 21, 10, T.QCoin);
  L.set(19, 10, T.QSauce);
  row(L, 54, 58, 10, T.Brick);
  L.set(56, 10, T.QCoin);

  pipe(L, 44, 3);
  pipe(L, 118, 4);
  pipe(L, 172, 3);

  row(L, 70, 77, 9, T.OneWay);
  row(L, 96, 102, 8, T.OneWay);
  row(L, 132, 138, 9, T.Brick);

  stairs(L, 88, 4, 1);
  row(L, 160, 166, 11, T.Hard);
  row(L, 162, 166, 10, T.Hard);
  row(L, 164, 166, 9, T.Hard);

  coins(spawns, 8, 14, 12);
  coins(spawns, 70, 77, 8);
  coins(spawns, 96, 102, 7);
  coins(spawns, 132, 136, 8);

  spawns.push(
    { kind: "nacho", x: 26 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 60 * TILE, y: 12 * TILE },
    { kind: "taco", x: 66 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 104 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 110 * TILE, y: 12 * TILE },
    { kind: "taco", x: 140 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 178 * TILE, y: 12 * TILE },
    { kind: "flag", x: 198 * TILE, y: 10 * TILE },
  );

  warps.push({ x: 44, y: 11, toX: 120, toY: 12 });

  return {
    id: 0,
    name: "Salsa Plains",
    world: "1-1",
    theme: "overworld",
    w,
    h,
    tiles: L.t,
    spawns,
    warps,
    spawnX: 4 * TILE,
    spawnY: 13 * TILE - 22,
    time: 400,
  };
}

function grotto(): Level {
  const w = 220;
  const h = 16;
  const L = make(w, h, 13);
  const spawns: Spawn[] = [];
  const warps: Warp[] = [];

  pit(L, 28, 32);
  pit(L, 64, 70);
  pit(L, 120, 126);
  pit(L, 168, 174);

  pipe(L, 20, 4);
  pipe(L, 50, 3);
  pipe(L, 90, 5);
  pipe(L, 150, 4);
  pipe(L, 190, 3);

  row(L, 34, 40, 10, T.OneWay);
  row(L, 66, 72, 9, T.OneWay);
  row(L, 74, 80, 7, T.OneWay);
  row(L, 108, 114, 10, T.Brick);
  L.set(110, 10, T.QSauce);
  L.set(112, 10, T.QCoin);
  row(L, 128, 134, 8, T.OneWay);
  row(L, 176, 182, 10, T.OneWay);

  stairs(L, 98, 5, 1);
  row(L, 200, 206, 11, T.Hard);
  row(L, 202, 206, 10, T.Hard);

  coins(spawns, 34, 40, 9);
  coins(spawns, 74, 80, 6);
  coins(spawns, 128, 134, 7);
  coins(spawns, 176, 182, 9);

  spawns.push(
    { kind: "nacho", x: 16 * TILE, y: 12 * TILE },
    { kind: "taco", x: 42 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 56 * TILE, y: 12 * TILE },
    { kind: "taco", x: 84 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 104 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 140 * TILE, y: 12 * TILE },
    { kind: "taco", x: 146 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 184 * TILE, y: 12 * TILE },
    { kind: "taco", x: 196 * TILE, y: 12 * TILE },
    { kind: "flag", x: 208 * TILE, y: 10 * TILE },
  );

  warps.push({ x: 50, y: 11, toX: 92, toY: 12 });

  return {
    id: 1,
    name: "Guacamole Grotto",
    world: "1-2",
    theme: "cave",
    w,
    h,
    tiles: L.t,
    spawns,
    warps,
    spawnX: 5 * TILE,
    spawnY: 13 * TILE - 22,
    time: 400,
  };
}

function hacienda(): Level {
  const w = 240;
  const h = 16;
  const L = make(w, h, 13);
  const spawns: Spawn[] = [];

  pit(L, 24, 28);
  pit(L, 52, 58);
  pit(L, 88, 92);
  pit(L, 130, 136);
  pit(L, 178, 184);

  row(L, 26, 30, 10, T.OneWay);
  row(L, 54, 60, 9, T.OneWay);
  row(L, 56, 62, 7, T.QCoin);
  L.set(59, 7, T.QSauce);
  row(L, 94, 100, 10, T.Brick);
  L.set(97, 10, T.QCoin);
  row(L, 118, 124, 8, T.OneWay);
  row(L, 148, 154, 9, T.Hard);
  row(L, 162, 168, 7, T.OneWay);

  pipe(L, 38, 3);
  pipe(L, 74, 4);
  pipe(L, 110, 3);
  pipe(L, 154, 5);
  pipe(L, 198, 3);

  stairs(L, 200, 5, 1);

  coins(spawns, 10, 16, 12);
  coins(spawns, 54, 60, 8);
  coins(spawns, 118, 124, 7);
  coins(spawns, 162, 168, 6);
  coins(spawns, 210, 216, 9);

  spawns.push(
    { kind: "nacho", x: 18 * TILE, y: 12 * TILE },
    { kind: "taco", x: 34 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 46 * TILE, y: 12 * TILE },
    { kind: "taco", x: 68 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 82 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 102 * TILE, y: 12 * TILE },
    { kind: "taco", x: 126 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 144 * TILE, y: 12 * TILE },
    { kind: "taco", x: 170 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 190 * TILE, y: 12 * TILE },
    { kind: "taco", x: 214 * TILE, y: 12 * TILE },
    { kind: "flag", x: 228 * TILE, y: 8 * TILE },
  );

  return {
    id: 3,
    name: "Hacienda Heights",
    world: "1-4",
    theme: "overworld",
    w,
    h,
    tiles: L.t,
    spawns,
    warps: [],
    spawnX: 4 * TILE,
    spawnY: 13 * TILE - 22,
    time: 360,
  };
}

export const LEVEL_COUNT = 9;

export type ShopKind = "salsa" | "queso" | "cantina";

export type MapStop = {
  key: string;
  kind: "level" | "shop";
  x: number;
  y: number;
  label: string;
  name: string;
  levelId?: number;
  water?: boolean;
  boss?: boolean;
  shop?: ShopKind;
};

export const MAP_STOPS: MapStop[] = [
  { key: "l0", kind: "level", levelId: 0, x: 72, y: 268, label: "1-1", name: "Salsa Plains" },
  { key: "s0", kind: "shop", shop: "salsa", x: 132, y: 186, label: "Casa", name: "Salsa Casa" },
  { key: "l1", kind: "level", levelId: 1, x: 188, y: 220, label: "1-2", name: "Guacamole Grotto" },
  { key: "l2", kind: "level", levelId: 2, x: 310, y: 292, label: "1-3", name: "Chile Ridge" },
  { key: "l3", kind: "level", levelId: 3, x: 440, y: 214, label: "1-4", name: "Hacienda Heights" },
  { key: "s1", kind: "shop", shop: "queso", x: 440, y: 308, label: "Stand", name: "Queso Stand" },
  { key: "l4", kind: "level", levelId: 4, x: 584, y: 176, label: "1-5", name: "Nacho Bowl", boss: true },
  { key: "l5", kind: "level", levelId: 5, x: 420, y: 72, label: "2-1", name: "Tide Pool", water: true },
  { key: "s2", kind: "shop", shop: "cantina", x: 584, y: 72, label: "Cantina", name: "Pier Cantina" },
  { key: "l6", kind: "level", levelId: 6, x: 320, y: 108, label: "2-2", name: "Kelp Alley", water: true },
  { key: "l7", kind: "level", levelId: 7, x: 180, y: 68, label: "2-3", name: "Coral Current", water: true },
  { key: "l8", kind: "level", levelId: 8, x: 64, y: 78, label: "2-4", name: "Octopus Trench", water: true },
];

export const MAP_LINKS: { a: string; b: string; bow: number }[] = [
  { a: "l0", b: "s0", bow: 16 },
  { a: "l0", b: "l1", bow: 20 },
  { a: "l1", b: "l2", bow: -18 },
  { a: "l2", b: "l3", bow: 16 },
  { a: "l3", b: "s1", bow: 8 },
  { a: "l3", b: "l4", bow: -18 },
  { a: "l4", b: "l5", bow: 8 },
  { a: "l5", b: "s2", bow: -12 },
  { a: "l5", b: "l6", bow: 14 },
  { a: "l6", b: "l7", bow: -16 },
  { a: "l7", b: "l8", bow: 14 },
];

export const SHOP_PRICES = { life: 20, sauce: 40, boots: 50 } as const;

function chile(): Level {
  const w = 120;
  const h = 16;
  const L = make(w, h, 13);
  const spawns: Spawn[] = [];
  pit(L, 22, 27);
  pit(L, 58, 64);
  pit(L, 90, 96);
  stairs(L, 30, 4, 1);
  stairs(L, 48, 4, -1);
  row(L, 36, 44, 8, T.Brick);
  L.set(40, 8, T.QCoin);
  row(L, 66, 74, 9, T.OneWay);
  row(L, 78, 84, 7, T.Brick);
  L.set(80, 7, T.QSauce);
  pipe(L, 16, 2);
  coins(spawns, 36, 44, 7);
  coins(spawns, 66, 74, 8);
  spawns.push(
    { kind: "nacho", x: 18 * TILE, y: 12 * TILE },
    { kind: "taco", x: 34 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 52 * TILE, y: 12 * TILE },
    { kind: "taco", x: 70 * TILE, y: 12 * TILE },
    { kind: "nacho", x: 86 * TILE, y: 12 * TILE },
    { kind: "taco", x: 100 * TILE, y: 12 * TILE },
    { kind: "flag", x: 112 * TILE, y: 10 * TILE },
  );
  return {
    id: 2,
    name: "Chile Ridge",
    world: "1-3",
    theme: "overworld",
    w,
    h,
    tiles: L.t,
    spawns,
    warps: [],
    spawnX: 4 * TILE,
    spawnY: 13 * TILE - 22,
    time: 340,
  };
}

function kelp(): Level {
  const w = 120;
  const h = 16;
  const L = make(w, h, 13);
  const spawns: Spawn[] = [];
  pit(L, 18, 24);
  pit(L, 46, 54);
  pit(L, 78, 86);
  row(L, 20, 24, 8, T.OneWay);
  row(L, 32, 40, 6, T.OneWay);
  row(L, 56, 64, 9, T.Brick);
  L.set(60, 9, T.QCoin);
  row(L, 88, 96, 7, T.OneWay);
  coins(spawns, 32, 40, 5);
  coins(spawns, 88, 96, 6);
  spawns.push(
    { kind: "fish", x: 16 * TILE, y: 7 * TILE },
    { kind: "fish", x: 36 * TILE, y: 5 * TILE },
    { kind: "octo", x: 50 * TILE, y: 8 * TILE },
    { kind: "fish", x: 70 * TILE, y: 6 * TILE },
    { kind: "octo", x: 92 * TILE, y: 8 * TILE },
    { kind: "fish", x: 104 * TILE, y: 5 * TILE },
    { kind: "flag", x: 112 * TILE, y: 10 * TILE },
  );
  return {
    id: 6,
    name: "Kelp Alley",
    world: "2-2",
    theme: "water",
    w,
    h,
    tiles: L.t,
    spawns,
    warps: [],
    spawnX: 4 * TILE,
    spawnY: 9 * TILE,
    time: 380,
  };
}

function bowlArena(): Level {
  const w = 36;
  const h = 16;
  const L = make(w, h, 13);
  row(L, 8, 15, 10, T.OneWay);
  row(L, 16, 22, 8, T.OneWay);
  row(L, 5, 9, 7, T.Brick);
  L.set(7, 7, T.QCoin);
  return {
    id: 4,
    name: "Nacho Bowl",
    world: "1-5",
    theme: "overworld",
    boss: true,
    w,
    h,
    tiles: L.t,
    spawns: [],
    warps: [],
    spawnX: 3 * TILE,
    spawnY: 13 * TILE - 22,
    time: 300,
  };
}

function tide(): Level {
  const w = 150;
  const h = 16;
  const L = make(w, h, 13);
  const spawns: Spawn[] = [];
  pit(L, 24, 30);
  pit(L, 52, 60);
  pit(L, 96, 104);
  row(L, 26, 30, 9, T.OneWay);
  row(L, 40, 48, 8, T.OneWay);
  row(L, 64, 72, 10, T.OneWay);
  row(L, 74, 80, 7, T.OneWay);
  row(L, 108, 116, 9, T.Brick);
  L.set(112, 9, T.QSauce);
  coins(spawns, 40, 48, 7);
  coins(spawns, 74, 80, 6);
  coins(spawns, 108, 114, 8);
  spawns.push(
    { kind: "fish", x: 18 * TILE, y: 8 * TILE },
    { kind: "fish", x: 34 * TILE, y: 6 * TILE },
    { kind: "fish", x: 46 * TILE, y: 10 * TILE },
    { kind: "fish", x: 70 * TILE, y: 5 * TILE },
    { kind: "octo", x: 84 * TILE, y: 7 * TILE },
    { kind: "fish", x: 110 * TILE, y: 6 * TILE },
    { kind: "fish", x: 124 * TILE, y: 9 * TILE },
    { kind: "flag", x: 140 * TILE, y: 10 * TILE },
  );
  return {
    id: 5,
    name: "Tide Pool",
    world: "2-1",
    theme: "water",
    w,
    h,
    tiles: L.t,
    spawns,
    warps: [],
    spawnX: 4 * TILE,
    spawnY: 10 * TILE,
    time: 400,
  };
}

function coral(): Level {
  const w = 160;
  const h = 16;
  const L = make(w, h, 13);
  const spawns: Spawn[] = [];
  pit(L, 20, 26);
  pit(L, 44, 52);
  pit(L, 78, 88);
  pit(L, 112, 120);
  row(L, 22, 26, 8, T.OneWay);
  row(L, 32, 38, 6, T.OneWay);
  row(L, 54, 62, 9, T.OneWay);
  row(L, 66, 72, 6, T.Brick);
  L.set(68, 6, T.QCoin);
  row(L, 90, 98, 8, T.OneWay);
  row(L, 122, 130, 7, T.OneWay);
  coins(spawns, 32, 38, 5);
  coins(spawns, 90, 98, 7);
  spawns.push(
    { kind: "fish", x: 16 * TILE, y: 7 * TILE },
    { kind: "octo", x: 30 * TILE, y: 9 * TILE },
    { kind: "fish", x: 48 * TILE, y: 5 * TILE },
    { kind: "octo", x: 62 * TILE, y: 8 * TILE },
    { kind: "fish", x: 80 * TILE, y: 6 * TILE },
    { kind: "fish", x: 94 * TILE, y: 10 * TILE },
    { kind: "octo", x: 108 * TILE, y: 7 * TILE },
    { kind: "fish", x: 128 * TILE, y: 5 * TILE },
    { kind: "flag", x: 148 * TILE, y: 10 * TILE },
  );
  return {
    id: 7,
    name: "Coral Current",
    world: "2-3",
    theme: "water",
    w,
    h,
    tiles: L.t,
    spawns,
    warps: [],
    spawnX: 4 * TILE,
    spawnY: 9 * TILE,
    time: 400,
  };
}

function trench(): Level {
  const w = 170;
  const h = 16;
  const L = make(w, h, 13);
  const spawns: Spawn[] = [];
  pit(L, 18, 26);
  pit(L, 40, 50);
  pit(L, 70, 82);
  pit(L, 104, 116);
  pit(L, 132, 142);
  row(L, 20, 26, 7, T.OneWay);
  row(L, 32, 38, 9, T.OneWay);
  row(L, 52, 60, 6, T.OneWay);
  row(L, 84, 92, 8, T.Brick);
  L.set(88, 8, T.QSauce);
  row(L, 116, 124, 7, T.OneWay);
  row(L, 144, 152, 9, T.OneWay);
  coins(spawns, 52, 60, 5);
  coins(spawns, 116, 124, 6);
  spawns.push(
    { kind: "octo", x: 16 * TILE, y: 8 * TILE },
    { kind: "fish", x: 28 * TILE, y: 5 * TILE },
    { kind: "octo", x: 44 * TILE, y: 9 * TILE },
    { kind: "fish", x: 58 * TILE, y: 6 * TILE },
    { kind: "octo", x: 74 * TILE, y: 7 * TILE },
    { kind: "fish", x: 90 * TILE, y: 4 * TILE },
    { kind: "octo", x: 108 * TILE, y: 8 * TILE },
    { kind: "fish", x: 122 * TILE, y: 5 * TILE },
    { kind: "octo", x: 138 * TILE, y: 7 * TILE },
    { kind: "fish", x: 150 * TILE, y: 9 * TILE },
    { kind: "flag", x: 160 * TILE, y: 10 * TILE },
  );
  return {
    id: 8,
    name: "Octopus Trench",
    world: "2-4",
    theme: "water",
    w,
    h,
    tiles: L.t,
    spawns,
    warps: [],
    spawnX: 4 * TILE,
    spawnY: 8 * TILE,
    time: 420,
  };
}
