import type { CSSProperties } from "react";
import styles from "./product.module.css";

// 商品画像（ダミー）。画像ファイルは使わず SVG で描くので、通信も素材も不要
// 背景色はカテゴリ名から自動で決まる（同じカテゴリはいつも同じ色。カテゴリが増えても設定不要）
// TODO: DB に画像URLが入ったら <img> / next/image に差し替える

type Props = {
  category: string | null;
  productName: string | null;
  compact?: boolean; // 小さいカード用（おすすめ商品など）
};

// 文字列から色相（0〜359）を決める
function hueOf(text: string): number {
  let hue = 0;
  for (const ch of text) {
    hue = (hue * 31 + (ch.codePointAt(0) ?? 0)) % 360;
  }
  return hue;
}

export default function ProductImage({ category, productName, compact = false }: Props) {
  const label = category ?? "ギフト";
  const style = { "--hue": hueOf(label) } as CSSProperties;

  return (
    <div
      className={`${styles.imagePlaceholder} ${compact ? styles.imagePlaceholderCompact : ""}`}
      style={style}
      role="img"
      aria-label={`${productName ?? "商品"}のイメージ（ダミー画像）`}
    >
      {/* ギフトボックスのアイコン */}
      <svg
        className={styles.imagePlaceholderIcon}
        viewBox="0 0 64 64"
        aria-hidden="true"
      >
        <rect x="10" y="28" width="44" height="28" rx="3" fill="currentColor" opacity="0.2" />
        <rect x="6" y="19" width="52" height="11" rx="3" fill="currentColor" opacity="0.35" />
        <rect x="29" y="19" width="6" height="37" fill="currentColor" />
        <path
          d="M32 19c-3-7-13-10-13-4 0 3 6 4 13 4zm0 0c3-7 13-10 13-4 0 3-6 4-13 4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.imagePlaceholderLabel}>{label}</span>
    </div>
  );
}
