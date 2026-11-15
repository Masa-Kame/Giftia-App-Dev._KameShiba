"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ProductPurchase from "@/components/ProductPurchase";
import ProductDetails from "@/components/ProductDetails";
import SceneFilter from "@/components/SceneFilter";
import ReviewList from "@/components/ReviewList";
import ReviewForm from "@/components/ReviewForm";
import { fetchProduct, type Product } from "@/lib/productApi";
import { fetchReviews } from "@/lib/reviewApi";
import {
  ALL_SCENES,
  type Review,
  type Scene,
  type SceneFilterValue,
} from "@/types/review";
import styles from "@/components/review.module.css";
import productStyles from "@/components/product.module.css";

// 商品詳細画面　例：http://localhost:3000/products/G0001
// 見た目はトップ画面（app/globals.css）にそろえている
// ※ カート・購入・お気に入りは Phase1 の対象外のため、画面上の表示だけ（DBには保存しない）
// TODO(#13): 口コミの並び替えUIを追加
export default function ProductDetailPage() {
  const { id: productId } = useParams<{ id: string }>();

  // 商品情報
  const [product, setProduct] = useState<Product | null>(null);
  const [productError, setProductError] = useState("");

  // カート・お気に入り（表示だけ）
  const [cartCount, setCartCount] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [notice, setNotice] = useState("");

  // 口コミ
  const [selectedScene, setSelectedScene] =
    useState<SceneFilterValue>(ALL_SCENES);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [sceneCounts, setSceneCounts] = useState<Record<Scene, number> | null>(null);
  const [allCount, setAllCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0); // 増やすと一覧を読み直す

  // 商品情報を取得する
  useEffect(() => {
    let ignore = false;
    setProductError("");
    fetchProduct(productId)
      .then((data) => {
        if (!ignore) setProduct(data);
      })
      .catch((err) => {
        if (!ignore) {
          setProductError(
            err instanceof Error ? err.message : "商品情報を取得できませんでした"
          );
        }
      });
    return () => {
      ignore = true;
    };
  }, [productId]);

  // シーンを切り替えたとき・投稿したときに、APIから口コミを取り直す（#8）
  useEffect(() => {
    let ignore = false; // 古い通信の結果で上書きしないための目印
    setIsLoading(true);
    setError("");

    fetchReviews(productId, selectedScene)
      .then((data) => {
        if (ignore) return;
        setReviews(data.results);
        setTotal(data.total);
        setSceneCounts(data.scene_counts);
        setAllCount(data.all_count);
      })
      .catch((err) => {
        if (ignore) return;
        setError(
          err instanceof Error ? err.message : "口コミを取得できませんでした"
        );
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [productId, selectedScene, reloadKey]);

  const handleAddToCart = (quantity: number) => {
    setCartCount((n) => n + quantity);
    setNotice(`カートに${quantity}個入れました（デモ版のため、カートの中身は保存されません）`);
  };
  const handleBuyNow = (quantity: number) => {
    setNotice(`${quantity}個の購入手続きへ進みます（デモ版のため、購入画面はありません）`);
  };
  const handleToggleFavorite = () => {
    setIsFavorite((v) => !v);
    setNotice(
      isFavorite
        ? "お気に入りから外しました"
        : "お気に入りに追加しました（デモ版のため保存されません）"
    );
  };

  return (
    <main className="page standard-page">
      <SiteHeader
        cartCount={cartCount}
        favoriteCount={isFavorite ? 1 : 0}
        onCartClick={() => setNotice("デモ版のため、カート画面はありません")}
        onFavoritesClick={() => setNotice("デモ版のため、お気に入り一覧の画面はありません")}
      />

      {notice && (
        <p className={`development-note ${productStyles.notice}`} role="status">
          {notice}
        </p>
      )}

      <div className={styles.container}>
        <ol className={productStyles.breadcrumb}>
          <li>
            <Link href="/">トップ</Link>
          </li>
          {product?.category && <li>{product.category}</li>}
          {product?.product_name && <li>{product.product_name}</li>}
        </ol>

        {productError && (
          <p role="alert" className={styles.error}>
            {productError}
          </p>
        )}

        {product && (
          <>
            <section className={styles.product}>
              <div className={styles.productImage}>商品画像</div>
              <ProductPurchase
                product={product}
                reviewTotal={allCount}
                isFavorite={isFavorite}
                onAddToCart={handleAddToCart}
                onBuyNow={handleBuyNow}
                onToggleFavorite={handleToggleFavorite}
              />
            </section>

            <ProductDetails product={product} />
          </>
        )}

        <section id="reviews" className={`tag-section ${styles.section}`}>
          <div>
            <h2 className={styles.sectionTitle}>利用シーン別の口コミ</h2>
            <p className="tag-hint">
              シーンを選ぶと、そのシーンで贈った人の口コミだけを表示します。数字は口コミの件数です
            </p>
          </div>

          <SceneFilter
            selected={selectedScene}
            onSelect={setSelectedScene}
            counts={sceneCounts}
            allCount={allCount}
          />

          <p className="tag-hint">
            選択中：{selectedScene}
            {!isLoading && !error && `（${total}件）`}
          </p>

          {isLoading && <p className={styles.message}>読み込み中…</p>}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {!isLoading && !error && (
            // key を変えると、シーン切り替え・投稿のたびに「5件表示」に戻る
            <ReviewList key={`${selectedScene}-${reloadKey}`} reviews={reviews} />
          )}
        </section>

        <ReviewForm
          productId={productId}
          onPosted={() => setReloadKey((n) => n + 1)}
        />
      </div>
    </main>
  );
}
