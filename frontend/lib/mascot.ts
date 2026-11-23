// lib/mascot.ts — かめしばマスコットへの合図（画面のどこからでも呼べる）
// 例：カートに入れたとき notifyMascot("cart") → components/MascotFollower.tsx が反応する

export const MASCOT_EVENT = "giftia:mascot";

export type MascotReaction = "cart";

export function notifyMascot(reaction: MascotReaction) {
  window.dispatchEvent(new CustomEvent<MascotReaction>(MASCOT_EVENT, { detail: reaction }));
}
