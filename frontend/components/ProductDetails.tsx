"use client";

import type { Product } from "@/lib/productApi";
import styles from "./product.module.css";
import reviewStyles from "./review.module.css";

type Props = {
  product: Product;
};

const yesNo = (value: boolean | null) =>
  value === null ? null : value ? "対応しています" : "対応していません";

// 商品情報：説明文・仕様の表・この商品に付いているタグ（シーン・対象・好み）
export default function ProductDetails({ product }: Props) {
  // 値があるものだけを表に出す
  const specs: [string, string | null][] = [
    ["ブランド", product.brand],
    ["ショップ", product.store_name],
    ["カテゴリー", product.category],
    ["サイズ・内容量", product.size],
    ["ギフト包装", yesNo(product.gift_wrap)],
    ["メッセージカード", yesNo(product.message_card)],
    ["商品番号", product.product_id],
  ];
  const visibleSpecs = specs.filter(([, value]) => value);

  const targets = [...product.target_ages, ...product.target_genders];

  return (
    <section className={`tag-section ${reviewStyles.section}`}>
      <h2 className={reviewStyles.sectionTitle}>商品情報</h2>

      <div className={styles.details}>
        {product.description && (
          <p className={styles.description}>{product.description}</p>
        )}

        {visibleSpecs.length > 0 && (
          <table className={styles.specTable}>
            <tbody>
              {visibleSpecs.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {product.scenes.length > 0 && (
          <TagRow label="こんなシーンで選ばれています" tags={product.scenes} />
        )}
        {targets.length > 0 && <TagRow label="おすすめの相手" tags={targets} />}
        {product.preferences.length > 0 && (
          <TagRow label="こんな好みの方に" tags={product.preferences} />
        )}
      </div>
    </section>
  );
}

function TagRow({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div className={styles.tagRow}>
      <p className={styles.tagLabel}>{label}</p>
      <div className="preference-tags">
        {tags.map((tag) => (
          <span key={tag} className="preference-tag" style={{ cursor: "default" }}>
            <span aria-hidden="true">#</span>
            <span>{tag}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
