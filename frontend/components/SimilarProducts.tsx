"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSimilarProducts, type SimilarProduct } from "@/lib/productApi";
import ProductImage from "./ProductImage";
import styles from "./product.module.css";

const COUNT = 4; // 表示する件数

// 「この商品を探している方へのおすすめ」：同じシーン・同じカテゴリ・近い価格帯の商品
// 並び順と理由は API（backend/products.py の find_similar_products）が決める
export default function SimilarProducts({ productId }: { productId: string }) {
  // 取得結果を「どの商品で取ったか（key）」と一緒に持つ（商品ページの他の部分と同じ書き方）
  const [result, setResult] = useState<{
    key: string;
    items?: SimilarProduct[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchSimilarProducts(productId, COUNT)
      .then((items) => {
        if (!ignore) setResult({ key: productId, items });
      })
      .catch((err) => {
        if (!ignore) {
          setResult({
            key: productId,
            error: err instanceof Error ? err.message : "おすすめ商品を取得できませんでした",
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, [productId]);

  const isLoading = result?.key !== productId;
  const items = !isLoading ? result?.items ?? [] : [];
  const error = !isLoading ? result?.error ?? "" : "";

  // 該当する商品がないときは、欄ごと出さない
  if (!isLoading && !error && items.length === 0) return null;

  return (
    <section className={styles.similar} aria-labelledby="similar-title">
      <h2 id="similar-title" className={styles.similarTitle}>
        この商品を探している方へのおすすめ
      </h2>
      <p className={styles.similarHint}>同じシーンで選ばれている、近い価格帯の商品です</p>

      {error && (
        <p role="alert" className={styles.similarHint}>
          {error}
        </p>
      )}

      <ul className={styles.similarGrid} aria-busy={isLoading}>
        {isLoading
          ? Array.from({ length: COUNT }, (_, i) => (
              <li key={i} className={`${styles.skeleton} ${styles.similarSkeleton}`} />
            ))
          : items.map((item) => (
              <li key={item.product_id}>
                <Link href={`/products/${encodeURIComponent(item.product_id)}`} className={styles.similarCard}>
                  <ProductImage category={item.category} productName={item.product_name} compact />
                  <span className={styles.similarBrand}>{item.brand}</span>
                  <span className={styles.similarName}>{item.product_name}</span>
                  {item.price !== null && (
                    <span className={styles.similarPrice}>¥{item.price.toLocaleString("ja-JP")}</span>
                  )}
                  {item.rating !== null && (
                    <span className={styles.similarRating}>
                      ★ {item.rating.toFixed(1)}（{item.review_count ?? 0}件）
                    </span>
                  )}
                  <ul className={styles.similarReasons} aria-label="おすすめ理由">
                    {item.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
