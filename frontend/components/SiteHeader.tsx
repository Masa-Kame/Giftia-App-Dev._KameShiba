"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "./product.module.css";

type Props = {
  cartCount: number;
  favoriteCount: number;
  onCartClick: () => void;
  onFavoritesClick: () => void;
};

// 商品詳細画面のヘッダー。ロゴ・トップに戻る・お気に入り・カート
export default function SiteHeader({
  cartCount,
  favoriteCount,
  onCartClick,
  onFavoritesClick,
}: Props) {
  return (
    <header className={styles.siteHeader}>
      <Link href="/" aria-label="Giftia トップへ戻る">
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
        <Link href="/" className={styles.navLink}>
          ← トップに戻る
        </Link>
        <button type="button" className={styles.navButton} onClick={onFavoritesClick}>
          ♡ お気に入り
          <span className={styles.badge}>{favoriteCount}</span>
        </button>
        <button
          type="button"
          className={`${styles.navButton} ${styles.navCart}`}
          onClick={onCartClick}
        >
          カートを見る
          <span className={styles.badge}>{cartCount}</span>
        </button>
      </nav>
    </header>
  );
}
