export const TILE = 32;
export const VIEW_W = 640;
export const VIEW_H = 360;
export const STEP = 1 / 60;

export const T = {
  Air: 0,
  Ground: 1,
  Dirt: 2,
  Brick: 3,
  QCoin: 4,
  QSauce: 5,
  Used: 6,
  Hard: 7,
  Pipe: 8,
  PipeLip: 9,
  OneWay: 10,
} as const;

export type Tile = (typeof T)[keyof typeof T];

export const SOLID: Record<number, boolean> = {
  [T.Ground]: true,
  [T.Dirt]: true,
  [T.Brick]: true,
  [T.QCoin]: true,
  [T.QSauce]: true,
  [T.Used]: true,
  [T.Hard]: true,
  [T.Pipe]: true,
  [T.PipeLip]: true,
};

export const GRAVITY_UP = 1650;
export const GRAVITY_DOWN = 2800;
export const GRAVITY_APEX = 900;
export const APEX_V = 55;
export const JUMP_VEL = -620;
export const DOUBLE_JUMP_VEL = -560;
export const MAX_AIR_JUMPS = 1;
export const JUMP_CUT = 0.48;
export const MAX_FALL = 900;
export const ACCEL_G = 1900;
export const FRICTION = 2200;
export const ACCEL_A = 1200;
export const MAX_RUN = 195;
export const COYOTE = 0.1;
export const JUMP_BUFFER = 0.13;
export const DROP_TIME = 0.18;

export const PW = 12;
export const PH = 22;
export const STOMP_PAD = 12;
export const HURT_PAD = 4;
export const SHELL_SPEED = 300;

export const SAVE_KEY = "super-burritos-v1";
