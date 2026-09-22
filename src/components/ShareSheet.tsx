import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import {
  appUrl,
  canNativeShare,
  copyShareLink,
  nativeShare,
  padScore,
  tweetIntent,
  type SharePayload,
} from "@/lib/share";

type Props = {
  payload: SharePayload;
  onClose: () => void;
};

export function ShareSheet({ payload, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const native = canNativeShare();
  const score = payload.score && payload.score > 0 ? payload.score : 0;
  const url = useMemo(() => appUrl(score || undefined), [score]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function shareNative() {
    setError("");
    try {
      await nativeShare(payload);
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      setError("Share was blocked. Copy the link instead.");
    }
  }

  async function copy() {
    setError("");
    try {
      await copyShareLink(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      inputRef.current?.select();
      setError("Select the link and copy it.");
    }
  }

  function postToX() {
    window.open(tweetIntent(payload), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/70 px-4 pb-24 pt-8">
      <div
        role="dialog"
        aria-labelledby="share-title"
        className="max-h-[min(40rem,calc(100dvh-5rem))] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-6 text-ink shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Send a challenge</p>
            <h2 id="share-title" className="mt-1 font-display text-3xl leading-none text-ink">
              Share Super Burritos
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close share"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-ink px-4 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Super Burritos</p>
          {score > 0 ? (
            <>
              <p className="mt-2 font-display text-5xl leading-none tabular-nums text-fg">{padScore(score)}</p>
              <p className="mt-2 text-sm text-muted">
                {payload.won ? "Kitchen cleared" : "This run"}
                {payload.world ? ` · World ${payload.world}` : ""}
                {payload.coins != null ? ` · ${payload.coins} coins` : ""}
              </p>
              <p className="mt-3 text-sm text-fg">Friends open this link and see your score on the title screen.</p>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-3xl leading-none text-fg">World 1</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Stomp nacho chips, kick taco troopers, and dive through burrito tubes.
              </p>
            </>
          )}
        </div>

        <label className="mt-4 block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Challenge link</span>
          <input
            ref={inputRef}
            readOnly
            value={url}
            aria-label="Challenge link"
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 h-11 w-full select-text truncate rounded-md border border-border bg-surface-2 px-3 text-sm text-ink"
          />
        </label>

        <div className="mt-4 flex flex-col gap-2">
          {native && (
            <SheetBtn primary onClick={shareNative}>
              <Share2 className="size-4" />
              Share
            </SheetBtn>
          )}
          <SheetBtn primary={!native} onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Link copied" : "Copy challenge link"}
          </SheetBtn>
          <SheetBtn onClick={postToX}>
            <XLogo />
            Post to X
          </SheetBtn>
        </div>
        {error ? <p className="mt-3 text-sm text-primary">{error}</p> : null}
      </div>
    </div>
  );
}

function SheetBtn({
  primary,
  onClick,
  children,
}: {
  primary?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex h-12 items-center justify-center gap-2 rounded-md px-5 font-semibold transition-transform duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-[0.98] " +
        (primary ? "bg-primary text-primary-fg hover:brightness-110" : "border border-border bg-surface-2 text-ink")
      }
    >
      {children}
    </button>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.9 2.4h3.3l-7.2 8.2 8.5 11H17l-5.2-6.8-6 6.8H2.4l7.7-8.8L1.4 2.4h6.6l4.7 6.2zM17.7 19.4h1.8L6.4 4.2H4.4z"
      />
    </svg>
  );
}
