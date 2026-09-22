export type Sheet = {
  img: HTMLImageElement;
  cols: number;
  rows: number;
  fw: number;
  fh: number;
};

export type Art = {
  heroIdle: Sheet;
  heroRun: Sheet;
  heroJump: Sheet;
  heroIdleGun: Sheet;
  heroRunGun: Sheet;
  heroJumpGun: Sheet;
  nacho: Sheet;
  taco: Sheet;
  coin: Sheet;
  salsa: Sheet;
  pipe: HTMLImageElement;
  qblock: HTMLImageElement;
  brick: HTMLImageElement;
  flag: HTMLImageElement;
  hotsauce: HTMLImageElement;
  nachoSquash: HTMLImageElement;
  tacoShell: HTMLImageElement;
  tileGround: HTMLImageElement;
  tileDirt: HTMLImageElement;
  tileUsed: HTMLImageElement;
  tileHard: HTMLImageElement;
  platL: HTMLImageElement;
  platM: HTMLImageElement;
  platR: HTMLImageElement;
  sky: HTMLImageElement;
  far: HTMLImageElement;
  mid: HTMLImageElement;
  cave: HTMLImageElement;
};

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function sheet(img: HTMLImageElement, cols: number, rows: number): Sheet {
  return { img, cols, rows, fw: img.width / cols, fh: img.height / rows };
}

export async function loadArt(): Promise<Art> {
  const [
    heroIdle,
    heroRun,
    heroJump,
    heroIdleGun,
    heroRunGun,
    heroJumpGun,
    nacho,
    taco,
    coin,
    salsa,
    pipe,
    qblock,
    brick,
    flag,
    hotsauce,
    nachoSquash,
    tacoShell,
    tileGround,
    tileDirt,
    tileUsed,
    tileHard,
    platL,
    platM,
    platR,
    sky,
    far,
    mid,
    cave,
  ] = await Promise.all([
    loadImg("/sprites/hero-idle.png"),
    loadImg("/sprites/hero-run.png"),
    loadImg("/sprites/hero-jump.png"),
    loadImg("/sprites/hero-idle-gun.png"),
    loadImg("/sprites/hero-run-gun.png"),
    loadImg("/sprites/hero-jump-gun.png"),
    loadImg("/sprites/nacho.png"),
    loadImg("/sprites/taco.png"),
    loadImg("/sprites/coin.png"),
    loadImg("/sprites/salsa.png"),
    loadImg("/sprites/pipe.png"),
    loadImg("/sprites/qblock.png"),
    loadImg("/sprites/brick.png"),
    loadImg("/sprites/flag.png"),
    loadImg("/sprites/hotsauce.png"),
    loadImg("/sprites/nacho-squash.png"),
    loadImg("/sprites/taco-shell.png"),
    loadImg("/sprites/tile-ground.png"),
    loadImg("/sprites/tile-dirt.png"),
    loadImg("/sprites/tile-used.png"),
    loadImg("/sprites/tile-hard.png"),
    loadImg("/sprites/plat-l.png"),
    loadImg("/sprites/plat-m.png"),
    loadImg("/sprites/plat-r.png"),
    loadImg("/map/overworld-sky.png"),
    loadImg("/map/overworld-far.png"),
    loadImg("/map/overworld-mid.png"),
    loadImg("/map/cave-sky.png"),
  ]);
  return {
    heroIdle: sheet(heroIdle, 2, 2),
    heroRun: sheet(heroRun, 2, 2),
    heroJump: sheet(heroJump, 2, 2),
    heroIdleGun: sheet(heroIdleGun, 2, 2),
    heroRunGun: sheet(heroRunGun, 2, 2),
    heroJumpGun: sheet(heroJumpGun, 2, 2),
    nacho: sheet(nacho, 2, 2),
    taco: sheet(taco, 2, 2),
    coin: sheet(coin, 2, 2),
    salsa: sheet(salsa, 2, 2),
    pipe,
    qblock,
    brick,
    flag,
    hotsauce,
    nachoSquash,
    tacoShell,
    tileGround,
    tileDirt,
    tileUsed,
    tileHard,
    platL,
    platM,
    platR,
    sky,
    far,
    mid,
    cave,
  };
}

export function drawSheet(
  ctx: CanvasRenderingContext2D,
  s: Sheet,
  frame: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  flip = false,
) {
  const n = s.cols * s.rows;
  const i = ((frame % n) + n) % n;
  const c = i % s.cols;
  const r = Math.floor(i / s.cols);
  ctx.save();
  if (flip) {
    ctx.translate(dx + dw / 2, dy + dh / 2);
    ctx.scale(-1, 1);
    ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
  }
  ctx.drawImage(s.img, c * s.fw, r * s.fh, s.fw, s.fh, dx, dy, dw, dh);
  ctx.restore();
}
