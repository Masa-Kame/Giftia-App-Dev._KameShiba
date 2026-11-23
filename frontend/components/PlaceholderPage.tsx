"use client";

import Link from "next/link";
import SiteHeader from "./SiteHeader";
import { clearSavedSearch } from "@/lib/searchSession";
import styles from "./product.module.css";
import reviewStyles from "./review.module.css";

type Props = {
  title: string; // 画面名（例：カート）
  message: string; // 案内の本文
};

// Phase1 の対象外の画面（カート・お気に入り）の仮ページ
// 押した人が迷わないように、対応予定であることと、次にできることを案内する
export default function PlaceholderPage({ title, message }: Props) {
  return (
    <main className="page standard-page">
      <SiteHeader cartCount={0} favoriteCount={0} />

      <div className={reviewStyles.container}>
        <ol className={styles.breadcrumb}>
          <li>
            <Link href="/" onClick={clearSavedSearch}>トップ</Link>
          </li>
          <li>{title}</li>
        </ol>

        <section className={styles.placeholderPage} aria-labelledby="placeholder-title">
          <h1 id="placeholder-title" className={styles.placeholderTitle}>{title}</h1>
          <div className={styles.placeholderBox}>
            {/* ギフトボックスのアイコン（ProductImage と同じ形） */}
            <svg className={styles.placeholderIcon} viewBox="0 0 64 64" aria-hidden="true">
              <rect x="10" y="28" width="44" height="28" rx="3" fill="currentColor" opacity="0.2" />
              <rect x="6" y="19" width="52" height="11" rx="3" fill="currentColor" opacity="0.35" />
              <rect x="29" y="19" width="6" height="37" fill="currentColor" />
            </svg>
            <p className={styles.placeholderLead}>{title}は Phase2 で対応予定です</p>
            <p className={styles.placeholderText}>{message}</p>
            <Link href="/" className={`search-submit ${styles.placeholderButton}`}>
              ギフトを探す
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
