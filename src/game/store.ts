import { create } from "zustand";

export type Phase = "loading" | "title" | "howto" | "map" | "shop" | "playing" | "paused" | "dead" | "clear" | "gameover" | "win";

export type Hud = {
  phase: Phase;
  score: number;
  coins: number;
  lives: number;
  world: string;
  time: number;
  powered: boolean;
  highScore: number;
  muted: boolean;
  message: string;
  ready: boolean;
  pocketSauce: boolean;
  chileBoots: boolean;
};

const initial: Hud = {
  phase: "title",
  score: 0,
  coins: 0,
  lives: 3,
  world: "1-1",
  time: 400,
  powered: false,
  highScore: 0,
  muted: false,
  message: "",
  ready: false,
  pocketSauce: false,
  chileBoots: false,
};

type GameStore = Hud & {
  patch: (p: Partial<Hud>) => void;
};

export const useGame = create<GameStore>((set) => ({
  ...initial,
  patch: (p) => set(p),
}));
