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
import ReviewSortSelect from "@/components/ReviewSortSelect";
import ProductImage from "@/components/ProductImage";
import ProductSkeleton from "@/components/ProductSkeleton";
import SimilarProducts from "@/components/SimilarProducts";
import { notifyMascot } from "@/lib/mascot";
import { fetchProduct, type Product } from "@/lib/productApi";
import { fetchReviews, type ReviewListResponse } from "@/lib/reviewApi";
import { ALL_SCENES, type SceneFilterValue, type SortValue } from "@/types/review";
import { clearSavedSearch, useHasSavedSearchResults } from "@/lib/searchSession";
import styles from "@/components/review.module.css";
import productStyles from "@/components/product.module.css";

// 商品詳細画面　例：http://localhost:3000/products/G0001
// 見た目はトップ画面（app/globals.css）にそろえている
// ※ カート・購入・お気に入りは Phase1 の対象外のため、画面上の表示だけ（DBには保存しない）
export default function ProductDetailPage() {
  const { id: productId } = useParams<{ id: string }>();
  const canBackToResults = useHasSavedSearchResults(); // 検索結果から来たか

  // 取得結果を「どの条件で取ったか（key）」と一緒に持ち、useEffect内で直接setStateしない（ESLint対応）
  
  // 商品情報
  const [productResult, setProductResult] = useState<{
    key: string;
    product?: Product;
    error?: string;
  } | null>(null);

  // カート・お気に入り（表示だけ）
  const [cartCount, setCartCount] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [notice, setNotice] = useState("");

  // 口コミ
  const [selectedScene, setSelectedScene] =
    useState<SceneFilterValue>(ALL_SCENES);
  const [sortValue, setSortValue] = useState<SortValue>("new"); // 並び順（#13）
  const [reloadKey, setReloadKey] = useState(0); // 増やすと一覧を読み直す
  const [reviewResult, setReviewResult] = useState<{
    key: string;
    data?: ReviewListResponse;
    error?: string;
  } | null>(null);

  // 商品情報を取得する
  useEffect(() => {
    let ignore = false; // 古い通信の結果で上書きしないための目印
    fetchProduct(productId)
      .then((product) => {
        if (!ignore) setProductResult({ key: productId, product });
      })
      .catch((err) => {
        if (!ignore) {
          setProductResult({
            key: productId,
            error: err instanceof Error ? err.message : "商品情報を取得できませんでした",
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, [productId]);

  // シーン・並び順を切り替えたとき・投稿したときに、APIから口コミを取り直す（#8・#13）
  const reviewKey = `${productId}|${selectedScene}|${sortValue}|${reloadKey}`;
  useEffect(() => {
    let ignore = false;
    fetchReviews(productId, selectedScene, sortValue)
      .then((data) => {
        if (!ignore) setReviewResult({ key: reviewKey, data });
      })
      .catch((err) => {
        if (!ignore) {
          setReviewResult({
            key: reviewKey,
            error: err instanceof Error ? err.message : "口コミを取得できませんでした",
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, [productId, selectedScene, sortValue, reviewKey]);

  // 画面に使う値
  const product =
    productResult?.key === productId ? productResult.product ?? null : null;
  const productError =
    productResult?.key === productId ? productResult.error ?? "" : "";

  const isLoading = reviewResult?.key !== reviewKey;
  const error = !isLoading ? reviewResult?.error ?? "" : "";
  const reviews = !isLoading ? reviewResult?.data?.results ?? [] : [];
  const total = reviewResult?.data?.total ?? 0;
  // 件数は読み込み中も前回の値を出しておく（ボタンの数字がちらつかないように）
  const sceneCounts = reviewResult?.data?.scene_counts ?? null;
  const allCount = reviewResult?.data?.all_count ?? null;

  const handleAddToCart = (quantity: number) => {
    setCartCount((n) => n + quantity);
    setNotice(`カートに${quantity}個入れました`);
    notifyMascot("cart"); // かめしばマスコットが喜ぶ
  };
  const handleBuyNow = (quantity: number) => {
    setNotice(`${quantity}個の購入手続きへ進みます`);
  };
  const handleToggleFavorite = () => {
    setIsFavorite((v) => !v);
    setNotice(
      isFavorite
        ? "お気に入りから外しました"
        : "お気に入りに追加しました"
    );
  };

  return (
    <main className="page standard-page">
      <SiteHeader
        cartCount={cartCount}
        favoriteCount={isFavorite ? 1 : 0}
      />

      {notice && (
        <p className={`development-note ${productStyles.notice}`} role="status">
          {notice}
        </p>
      )}

      <div className={styles.container}>
        <ol className={productStyles.breadcrumb}>
          <li>
            {/* トップは検索前の画面へ（保存した検索状態を消す） */}
            <Link href="/" onClick={clearSavedSearch}>トップ</Link>
          </li>
          {canBackToResults && (
            <li>
              <Link href="/">検索結果</Link>
            </li>
          )}
          {product?.category && <li>{product.category}</li>}
          {product?.product_name && <li>{product.product_name}</li>}
        </ol>

        {productError && (
          <p role="alert" className={styles.error}>
            {productError}
          </p>
        )}

        {/* 読み込み中は仮表示で場所を確保する（読み込み後に画面がずれないように） */}
        {!product && !productError && <ProductSkeleton />}

        {product && (
          <>
            <section className={styles.product}>
              <ProductImage
                category={product.category}
                productName={product.product_name}
              />
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

            {/* この商品を探している方へのおすすめ（同じシーン・同じカテゴリ・近い価格帯） */}
            <SimilarProducts productId={productId} />
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
          <div className={styles.reviewToolbar}>
            <p className="tag-hint">
              選択中：{selectedScene}
              {!isLoading && !error && `（${total}件）`}
              {/* 口コミAPIは最大50件まで返す。それを超えるときは、表示している件数を明記する */}
              {!isLoading && !error && total > reviews.length && `　※並び順の上位${reviews.length}件を表示`}
            </p>
            <ReviewSortSelect value={sortValue} onChange={setSortValue} />
          </div>

          {isLoading && <p className={styles.message}>読み込み中…</p>}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {!isLoading && !error && (
            // key を変えると、シーン・並び順の切り替えや投稿のたびに「5件表示」に戻る
            <ReviewList key={`${selectedScene}-${sortValue}-${reloadKey}`} reviews={reviews} />
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