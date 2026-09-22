import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, Volume2, VolumeX, RotateCcw, BookOpen, Share2 } from "lucide-react";
import { createGame } from "@/game/engine";
import { useGame } from "@/game/store";
import { unlockAudio, setMuted } from "@/game/audio";
import { ShareSheet } from "@/components/ShareSheet";
import { padScore, type SharePayload } from "@/lib/share";

export function GameApp({ rivalScore = null }: { rivalScore?: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<ReturnType<typeof createGame> | null>(null);
  const hud = useGame();
  const [share, setShare] = useState<SharePayload | null>(null);
  const rival = rivalScore;

  useEffect(() => {
    if (!canvasRef.current || !rootRef.current) return;
    const g = createGame(canvasRef.current, rootRef.current);
    gameRef.current = g;
    window.__game = g;
    return () => {
      g.destroy();
      gameRef.current = null;
    };
  }, []);

  function begin() {
    unlockAudio();
    gameRef.current?.start();
  }

  function toggleMute() {
    const next = !hud.muted;
    useGame.getState().patch({ muted: next });
    setMuted(next);
  }

  function openShare(fromRun: boolean) {
    if (fromRun) {
      setShare({
        score: hud.score,
        won: hud.phase === "win",
        world: hud.world,
        coins: hud.coins,
      });
      return;
    }
    setShare(hud.highScore > 0 ? { score: hud.highScore, world: hud.world } : {});
  }

  const showMenu = hud.phase === "title" || hud.phase === "howto";
  const showPause = hud.phase === "paused";
  const showEnd = hud.phase === "gameover" || hud.phase === "win";
  const showClear = hud.phase === "clear";
  const playing = hud.phase === "playing" || hud.phase === "dead" || hud.phase === "paused" || hud.phase === "clear";
  const beatRival = rival != null && hud.score > rival;
  const missedRival = rival != null && hud.score <= rival;

  return (
    <div
      ref={rootRef}
      className="relative h-dvh w-full overflow-hidden bg-bg text-fg"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: "contain", background: "#1a120e" }}
        aria-label="Super Burritos game"
      />

      {playing && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-3 pt-3 pr-24 sm:px-6 sm:pt-4">
          <HudChip label="Score" value={String(hud.score).padStart(6, "0")} />
          <HudChip label={hud.world} value={`${hud.coins} coins`} />
          <HudChip label="Time" value={String(hud.time)} />
          <HudChip label="Lives" value={`x${hud.lives}`} />
        </header>
      )}

      {playing && (
        <div className="pointer-events-auto absolute right-3 top-16 z-20 flex gap-2 sm:top-4">
          <IconBtn label={hud.muted ? "Unmute" : "Mute"} onClick={toggleMute}>
            {hud.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </IconBtn>
          <IconBtn label="Pause" onClick={() => gameRef.current?.pause()}>
            <Pause className="size-5" />
          </IconBtn>
        </div>
      )}

      {showMenu && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/55 px-4 pb-24 pt-8">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-8">
            {hud.phase === "howto" ? (
              <HowTo onBack={() => useGame.getState().patch({ phase: "title" })} />
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">World 1</p>
                <h1 className="mt-2 font-display text-4xl leading-none tracking-wide text-fg sm:text-5xl">
                  Super Burritos
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
                  Stomp nacho chips, kick taco troopers, and dive through burrito tubes. Grab hot sauce to spit salsa.
                </p>
                {rival != null && (
                  <div className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">A friend sent this</p>
                    <p className="mt-1 font-display text-2xl leading-none tabular-nums text-fg">{padScore(rival)}</p>
                    <p className="mt-1 text-sm text-muted">Beat their run, then send yours back.</p>
                  </div>
                )}
                {hud.highScore > 0 && (
                  <p className="mt-3 text-sm tabular-nums text-fg">Best {String(hud.highScore).padStart(6, "0")}</p>
                )}
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={begin}
                    disabled={!hud.ready}
                    className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 font-semibold text-primary-fg transition-transform duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Play className="size-4" />
                    {hud.ready ? (rival != null ? "Accept challenge" : "Play") : "Warming the tortillas…"}
                  </button>
                  <button
                    type="button"
                    onClick={() => useGame.getState().patch({ phase: "howto" })}
                    className="flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-5 font-semibold text-fg transition-transform duration-[var(--motion-quick)] active:scale-[0.98]"
                  >
                    <BookOpen className="size-4" />
                    How to play
                  </button>
                  <button
                    type="button"
                    onClick={() => openShare(false)}
                    className="flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-5 font-semibold text-fg transition-transform duration-[var(--motion-quick)] active:scale-[0.98]"
                  >
                    <Share2 className="size-4" />
                    {hud.highScore > 0 ? "Challenge a friend" : "Share"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showPause && (
        <Modal title="Paused" body="The salsa keeps for a second.">
          <button
            type="button"
            onClick={() => gameRef.current?.pause()}
            className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 font-semibold text-primary-fg"
          >
            Resume
          </button>
        </Modal>
      )}

      {showClear && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 text-center">
          <p className="font-display text-3xl text-fg">{hud.message}</p>
          <p className="mt-1 text-sm text-muted">Course clear</p>
        </div>
      )}

      {showEnd && (
        <Modal
          title={hud.phase === "win" ? "Kitchen closed" : "Burnt"}
          body={
            hud.phase === "win"
              ? beatRival
                ? "You beat the challenge. Send a hotter score."
                : "You ran the whole menu. Extra salsa for you."
              : beatRival
                ? "Out of lives, but you still beat their score."
                : hud.message || "Out of lives."
          }
        >
          <p className="mb-1 text-sm tabular-nums text-muted">Score {String(hud.score).padStart(6, "0")}</p>
          {rival != null && (
            <p className="mb-3 text-sm tabular-nums text-fg">
              {beatRival ? "Beat" : missedRival ? "Short of" : "Tied"} {padScore(rival)}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                gameRef.current?.resumeFromOverlay();
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 font-semibold text-primary-fg"
            >
              <RotateCcw className="size-4" />
              Play again
            </button>
            <button
              type="button"
              onClick={() => openShare(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-5 font-semibold text-fg"
            >
              <Share2 className="size-4" />
              Challenge a friend
            </button>
          </div>
        </Modal>
      )}

      {share && <ShareSheet payload={share} onClose={() => setShare(null)} />}

      <div className="touch-pad pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
        <div className="pointer-events-auto flex gap-2">
          <Pad act="left" label="Left" />
          <Pad act="right" label="Right" />
          <Pad act="down" label="Down" />
        </div>
        <div className="pointer-events-auto flex gap-2">
          {hud.powered && <Pad act="fire" label="Salsa" wide />}
          <Pad act="jump" label="Jump" wide />
        </div>
      </div>
    </div>
  );
}

function HudChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-sm bg-ink/55 px-2 py-1 backdrop-blur-[2px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="font-display text-lg leading-none tabular-nums text-fg">{value}</p>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pointer-events-auto flex size-11 items-center justify-center rounded-md border border-border bg-surface/90 text-fg"
    >
      {children}
    </button>
  );
}

function Pad({ act, label, wide }: { act: string; label: string; wide?: boolean }) {
  return (
    <button
      type="button"
      data-act={act}
      aria-label={label}
      className={
        "flex h-14 items-center justify-center rounded-md border border-border bg-surface/85 font-semibold text-fg " +
        (wide ? "min-w-20 px-4" : "w-14")
      }
    >
      {label}
    </button>
  );
}

function Modal({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/60 px-4 pb-24">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-3xl text-fg">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function HowTo({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <h2 className="font-display text-3xl text-fg">How to play</h2>
      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
        <li>A / D or arrows move. W, Space, or Up jumps. Tap jump again in the air for a double jump. Hold jump to go higher.</li>
        <li>Stomp nacho chips. Stomp tacos into shells, then bump or stomp the shell to send it sliding.</li>
        <li>Bump mystery crates from below. Hot sauce lets you throw salsa with J or Shift.</li>
        <li>S / Down on a burrito tube warps ahead. Reach the chili flag to clear the course.</li>
        <li>Gamepad works too. On a phone, use the pads along the bottom.</li>
      </ul>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 flex h-12 w-full items-center justify-center rounded-md bg-primary font-semibold text-primary-fg"
      >
        Back
      </button>
    </div>
  );
}
