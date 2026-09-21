export const APP_NAME = "Super Burritos";

export type SharePayload = {
  score?: number;
  won?: boolean;
  world?: string;
  coins?: number;
};

export function padScore(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(6, "0");
}

export function readChallenge(search = typeof window === "undefined" ? "" : window.location.search): number | null {
  const raw = new URLSearchParams(search).get("beat");
  if (!raw) return null;
  const beat = Number(raw);
  if (!Number.isFinite(beat) || beat < 1 || beat > 99_999_999) return null;
  return Math.floor(beat);
}

export function appUrl(score?: number) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  if (score && score > 0) url.searchParams.set("beat", String(Math.floor(score)));
  return url.toString();
}

export function shareCopy(payload: SharePayload) {
  const score = payload.score && payload.score > 0 ? payload.score : undefined;
  const url = appUrl(score);
  if (!score) {
    return {
      title: APP_NAME,
      text: "Play Super Burritos — stomp nacho chips, kick taco troopers, and dive through burrito tubes.",
      url,
    };
  }
  const result = payload.won ? "cleared the kitchen" : "ran the kitchen";
  const extras = [payload.world ? `World ${payload.world}` : null, payload.coins != null ? `${payload.coins} coins` : null]
    .filter(Boolean)
    .join(" · ");
  const text = extras
    ? `I ${result} in Super Burritos with ${padScore(score)} points (${extras}). Can you beat it?`
    : `I ${result} in Super Burritos with ${padScore(score)} points. Can you beat it?`;
  return { title: APP_NAME, text, url };
}

export function tweetIntent(payload: SharePayload) {
  const { text, url } = shareCopy(payload);
  const intent = new URL("https://x.com/intent/post");
  intent.searchParams.set("text", `${text}\n${url}`);
  return intent.toString();
}

export function canNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function nativeShare(payload: SharePayload) {
  const { title, text, url } = shareCopy(payload);
  await navigator.share({ title, text, url });
}

export async function copyShareLink(payload: SharePayload) {
  const { url } = shareCopy(payload);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return url;
    }
  } catch {
    /* fall through to execCommand */
  }
  const el = document.createElement("textarea");
  el.value = url;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  if (!ok) throw new Error("copy failed");
  return url;
}
