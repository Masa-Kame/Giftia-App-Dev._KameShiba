"use client";

import Image from "next/image";
import Link from "next/link";
import { clearSavedSearch, useHasSavedSearchResults } from "@/lib/searchSession";
import styles from "./product.module.css";

type Props = {
  cartCount: number;
  favoriteCount: number;
};

// 商品詳細・カート・お気に入り画面のヘッダー。ロゴ・トップに戻る・お気に入り・カート
// お気に入り・カートは仮の画面（Phase2で対応予定。app/favorites・app/cart）へ移動する
export default function SiteHeader({ cartCount, favoriteCount }: Props) {
  // 検索結果から来たときは「検索結果に戻る」、それ以外は「トップに戻る」
  const canBackToResults = useHasSavedSearchResults();

  return (
    <header className={styles.siteHeader}>
      {/* ロゴは検索前のトップへ（保存した検索状態を消す） */}
      <Link href="/" aria-label="Giftia トップへ戻る" onClick={clearSavedSearch}>
        <Image
          className="giftia-logo"
          src="/giftia-logo.png"
          alt="Giftia"
          width={1297}
          height={371}
          unoptimized
        />
      </Link>

      <nav className={styles.headerNav} aria-label="サイト内メニュー">
        {/* どちらも "/" へ移動。検索結果に戻る場合は、トップ画面が保存した検索状態を復元する */}
        {canBackToResults ? (
          <Link href="/" className={styles.navLink}>
            ← 検索結果に戻る
          </Link>
        ) : (
          <Link href="/" className={styles.navLink}>
            ← トップに戻る
          </Link>
        )}
        <Link href="/favorites" className={styles.navButton}>
          ♡ お気に入り
          <span className={styles.badge}>{favoriteCount}</span>
        </Link>
        <Link href="/cart" className={`${styles.navButton} ${styles.navCart}`}>
          カートを見る
          <span className={styles.badge}>{cartCount}</span>
        </Link>
      </nav>
    </header>
  );
}
