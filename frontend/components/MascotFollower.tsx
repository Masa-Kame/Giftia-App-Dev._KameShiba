"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { MASCOT_EVENT, type MascotReaction } from "@/lib/mascot";
import styles from "./mascot.module.css";

// かめしばマスコット：マウスカーソルを追いかけ、カートに入れたときに喜ぶ
// ・位置は requestAnimationFrame と transform だけで動かす（再描画を起こさないので軽い）
// ・止まると待機ポーズ、動くと走るポーズ。カートに入れると箱を持って跳ねる
// ・タッチ操作の端末と「視差効果を減らす」設定の人には表示しない

type Pose = "idle" | "run" | "cart";

const SPRITES: { pose: Pose; src: string; width: number }[] = [
  { pose: "idle", src: "/mascot/kameshiba-idle.webp", width: 143 },
  { pose: "run", src: "/mascot/kameshiba-run.webp", width: 136 },
  { pose: "cart", src: "/mascot/kameshiba-cart.webp", width: 166 },
];
const SPRITE_HEIGHT = 128; // 画像の元の高さ（表示は CSS で 56px）
const OFFSET_X = 20; // カーソルの右下に、少し離れてついてくる
const OFFSET_Y = 24;
const EASE = 0.14; // 追いかける速さ（0〜1。大きいほど速い）
const IDLE_AFTER_MS = 600; // 止まってから待機ポーズになるまで
const REACTION_MS = 1600; // カートに入れたときの反応の長さ

const QUERY = "(pointer: fine) and (prefers-reduced-motion: no-preference)";
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export default function MascotFollower() {
  // マウスで操作していて、動きを減らす設定がないときだけ表示（サーバー側では表示しない）
  const enabled = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
  const [pose, setPose] = useState<Pose>("idle");
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const target = { x: -100, y: -100 };
    const current = { x: -100, y: -100 };
    let facingRight = false;
    let frame = 0;
    let idleTimer = 0;
    let reactionTimer = 0;
    let reacting = false;
    let currentPose: Pose = "idle";

    const changePose = (next: Pose) => {
      if (currentPose === next) return;
      currentPose = next;
      setPose(next);
    };

    const draw = () => {
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      current.x += dx * EASE;
      current.y += dy * EASE;
      if (Math.abs(dx) > 2) facingRight = dx > 0; // 画像は左向き。右へ進むときは反転
      root.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
      root.dataset.facing = facingRight ? "right" : "left";
      // 追いついたら止める（動いていない間は何も計算しない）
      frame = Math.hypot(dx, dy) > 0.5 ? requestAnimationFrame(draw) : 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      target.x = e.clientX + OFFSET_X;
      target.y = e.clientY + OFFSET_Y;
      if (current.x < 0) {
        // 最初の1回はカーソルの位置から出てくる
        current.x = target.x;
        current.y = target.y;
        setVisible(true);
      }
      if (!frame) frame = requestAnimationFrame(draw);
      if (!reacting) changePose("run");
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (!reacting) changePose("idle");
      }, IDLE_AFTER_MS);
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => {
      if (current.x >= 0) setVisible(true);
    };

    const onReaction = (e: Event) => {
      if ((e as CustomEvent<MascotReaction>).detail !== "cart") return;
      reacting = true;
      changePose("cart");
      window.clearTimeout(reactionTimer);
      reactionTimer = window.setTimeout(() => {
        reacting = false;
        changePose("idle");
      }, REACTION_MS);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);
    window.addEventListener(MASCOT_EVENT, onReaction);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      window.removeEventListener(MASCOT_EVENT, onReaction);
      cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer);
      window.clearTimeout(reactionTimer);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={rootRef}
      className={`${styles.mascot} ${visible ? styles.visible : ""} ${pose === "cart" ? styles.reacting : ""}`}
      aria-hidden="true"
    >
      {pose === "cart" && <span className={styles.bubble}>カートに入れたよ！</span>}
      <div className={styles.body}>
        {/* 3つのポーズを重ねておき、表示だけ切り替える（切り替え時に読み込みが起きない） */}
        {SPRITES.map((sprite) => (
          <Image
            key={sprite.pose}
            className={`${styles.sprite} ${sprite.pose === pose ? styles.active : ""}`}
            src={sprite.src}
            alt=""
            width={sprite.width}
            height={SPRITE_HEIGHT}
            unoptimized
          />
        ))}
      </div>
    </div>
  );
}
