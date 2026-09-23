export type Actions = {
  moveX: number;
  up: boolean;
  jump: boolean;
  jumpHeld: boolean;
  down: boolean;
  fire: boolean;
  pause: boolean;
};

const GAME_CODES = new Set([
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "KeyJ",
  "KeyK",
  "KeyP",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Escape",
  "Enter",
]);

export function createInput() {
  const keys = new Set<string>();
  const inject = new Set<string>();
  const pointers = new Map<number, string>();
  let prevJump = false;
  let prevFire = false;
  let prevPause = false;

  function allKeys() {
    const s = new Set(keys);
    for (const k of inject) s.add(k);
    return s;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    keys.add(e.code);
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function clear() {
    keys.clear();
    inject.clear();
  }

  function bindPointer(el: HTMLElement) {
    const down = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest("[data-act]") as HTMLElement | null;
      if (!t) return;
      const act = t.dataset.act;
      if (!act) return;
      e.preventDefault();
      pointers.set(e.pointerId, act);
      try {
        t.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }

  function pollGamepad(a: Actions) {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0;
      const dz = 0.25;
      if (Math.abs(ax) > dz) a.moveX += Math.sign(ax);
      if (p.buttons[14]?.pressed) a.moveX -= 1;
      if (p.buttons[15]?.pressed) a.moveX += 1;
      if (p.buttons[12]?.pressed) a.up = true;
      if (p.buttons[12]?.pressed || p.buttons[0]?.pressed) a.jumpHeld = true;
      if (p.buttons[13]?.pressed) a.down = true;
      if (p.buttons[2]?.pressed || p.buttons[1]?.pressed) a.fire = true;
      if (p.buttons[9]?.pressed) a.pause = true;
    }
  }

  function sample(): Actions {
    const k = allKeys();
    const a: Actions = { moveX: 0, up: false, jump: false, jumpHeld: false, down: false, fire: false, pause: false };
    if (k.has("KeyA") || k.has("ArrowLeft")) a.moveX -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) a.moveX += 1;
    if (k.has("ArrowUp") || k.has("KeyW")) a.up = true;
    if (k.has("KeyW") || k.has("ArrowUp") || k.has("Space")) a.jumpHeld = true;
    if (k.has("KeyS") || k.has("ArrowDown")) a.down = true;
    if (k.has("KeyJ") || k.has("KeyK") || k.has("ShiftLeft") || k.has("ShiftRight")) a.fire = true;
    if (k.has("KeyP") || k.has("Escape")) a.pause = true;

    for (const act of pointers.values()) {
      if (act === "left") a.moveX -= 1;
      if (act === "right") a.moveX += 1;
      if (act === "up") a.up = true;
      if (act === "jump") a.jumpHeld = true;
      if (act === "down") a.down = true;
      if (act === "fire") a.fire = true;
    }

    pollGamepad(a);
    a.moveX = Math.max(-1, Math.min(1, a.moveX));

    const fireHeld = a.fire;
    const pauseHeld = a.pause;
    a.jump = a.jumpHeld && !prevJump;
    a.fire = fireHeld && !prevFire;
    a.pause = pauseHeld && !prevPause;
    prevJump = a.jumpHeld;
    prevFire = fireHeld;
    prevPause = pauseHeld;
    return a;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });

  return {
    sample,
    bindPointer,
    setKeys(codes: string[]) {
      inject.clear();
      for (const c of codes) inject.add(c);
    },
    getInjected() {
      return [...inject];
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
    },
  };
}
