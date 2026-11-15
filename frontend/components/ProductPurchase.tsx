"use client";

import { useState } from "react";
import type { Product } from "@/lib/productApi";
import styles from "./product.module.css";

type Props = {
  product: Product;
  reviewTotal: number | null; // 口コミ件数（reviews テーブル）
  isFavorite: boolean;
  onAddToCart: (quantity: number) => void;
  onBuyNow: (quantity: number) => void;
  onToggleFavorite: () => void;
};

const MAX_QUANTITY = 10; // 1回に選べる最大数

// 購入エリア：商品名・評価・価格・在庫・ギフト対応・数量・カート/購入/お気に入りボタン
export default function ProductPurchase({
  product,
  reviewTotal,
  isFavorite,
  onAddToCart,
  onBuyNow,
  onToggleFavorite,
}: Props) {
  const [quantity, setQuantity] = useState(1);

  const stock = product.stock ?? 0;
  const maxQuantity = Math.max(1, Math.min(stock, MAX_QUANTITY));
  const isSoldOut = stock <= 0;

  const rating = product.rating ?? 0;
  const fullStars = Math.round(rating);

  const giftBadges = [
    product.gift_wrap && "ギフト包装できます",
    product.message_card && "メッセージカードを付けられます",
  ].filter(Boolean) as string[];

  return (
    <div className={styles.purchase}>
      {(product.brand || product.store_name) && (
        <p className={styles.brand}>{product.brand ?? product.store_name}</p>
      )}

      <h1 className={styles.productName}>{product.product_name}</h1>

      {product.rating !== null && (
        <div className={styles.ratingRow}>
          <span className={styles.stars} aria-label={`平均 ${rating.toFixed(1)}`}>
            {"★".repeat(fullStars)}
            <span className={styles.starsEmpty}>{"★".repeat(5 - fullStars)}</span>
          </span>
          <span>{rating.toFixed(1)}</span>
          {reviewTotal !== null && (
            <a href="#reviews" className={styles.ratingLink}>
              口コミを見る（{reviewTotal}件）
            </a>
          )}
        </div>
      )}

      {product.price !== null && (
        <p className={styles.price}>
          ¥{product.price.toLocaleString("ja-JP")}
          <span className={styles.priceUnit}>（1個）</span>
        </p>
      )}

      {product.sales_count !== null && product.sales_count > 0 && (
        <p className={styles.socialProof}>
          直近1年で {product.sales_count.toLocaleString("ja-JP")} 個 購入されています
        </p>
      )}

      {giftBadges.length > 0 && (
        <ul className={styles.giftBadges}>
          {giftBadges.map((label) => (
            <li key={label} className={styles.giftBadge}>
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.buyBox}>
        <p
          className={`${styles.stock} ${
            isSoldOut ? styles.stockOut : stock < 10 ? styles.stockLow : styles.stockOk
          }`}
        >
          {isSoldOut ? "在庫切れ" : stock < 10 ? `残りわずか（あと${stock}点）` : "在庫あり"}
        </p>

        <div className={styles.quantityRow}>
          <span id="quantity-label">数量</span>
          <div className={styles.quantity} role="group" aria-labelledby="quantity-label">
            <button
              type="button"
              aria-label="1つ減らす"
              disabled={isSoldOut || quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              −
            </button>
            <output aria-live="polite">{quantity}</output>
            <button
              type="button"
              aria-label="1つ増やす"
              disabled={isSoldOut || quantity >= maxQuantity}
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            >
              ＋
            </button>
          </div>
        </div>

        <div className={styles.buyButtons}>
          <button
            type="button"
            className="search-submit"
            disabled={isSoldOut}
            onClick={() => onAddToCart(quantity)}
          >
            カートに入れる
          </button>
          <button
            type="button"
            className={styles.buyNow}
            disabled={isSoldOut}
            onClick={() => onBuyNow(quantity)}
          >
            今すぐ買う
          </button>
        </div>

        <button
          type="button"
          className={`${styles.favorite} ${isFavorite ? styles.favoriteOn : ""}`}
          aria-pressed={isFavorite}
          onClick={onToggleFavorite}
        >
          {isFavorite ? "♥ お気に入りに追加済み" : "♡ お気に入りに追加"}
        </button>
      </div>
    </div>
  );
}
