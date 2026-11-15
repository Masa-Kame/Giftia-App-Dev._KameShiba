"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SceneFilter from "@/components/SceneFilter";
import ReviewList from "@/components/ReviewList";
import ReviewForm from "@/components/ReviewForm";
import { fetchReviews } from "@/lib/reviewApi";
import { ALL_SCENES, type Review, type SceneFilterValue } from "@/types/review";

// 商品詳細画面　例：http://localhost:3000/products/G0001
// TODO: 商品名・価格・説明は仮。商品情報のAPIができたら置き換える
// TODO(#13): 並び替えUIを追加
export default function ProductDetailPage() {
  const { id: productId } = useParams<{ id: string }>();

  const [selectedScene, setSelectedScene] =
    useState<SceneFilterValue>(ALL_SCENES);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0); // 増やすと一覧を読み直す

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

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <h1>コーヒーギフトセット</h1>

      <div
        style={{
          height: "250px",
          background: "#f3f3f3",
          borderRadius: "8px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        商品画像
      </div>

      <p>価格: ¥4,500</p>
      <p>コーヒー好きな方へのギフトとして人気の商品です。</p>

      <hr style={{ margin: "24px 0" }} />

      <h2>利用シーン別口コミ</h2>

      <SceneFilter selected={selectedScene} onSelect={setSelectedScene} />

      <p>
        <strong>選択中：</strong>
        {selectedScene}
        {!isLoading && !error && `（${total}件）`}
      </p>

      {isLoading && <p>読み込み中…</p>}
      {error && (
        <p role="alert" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
      {!isLoading && !error && <ReviewList reviews={reviews} />}

      <hr style={{ margin: "24px 0" }} />

      <ReviewForm
        productId={productId}
        onPosted={() => setReloadKey((n) => n + 1)}
      />
    </main>
  );
}