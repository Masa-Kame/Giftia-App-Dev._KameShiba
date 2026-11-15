"use client";

import { useState } from "react";
import { postReview } from "@/lib/reviewApi";
import { SCENES, TEST_USER_ID, isScene } from "@/types/review";

type Props = {
  productId: string;
  onPosted: () => void; // 投稿できたら親に知らせる（一覧を読み直す）
};

const labelStyle = {
  display: "block",
  fontWeight: "bold",
  marginBottom: "8px",
} as const;

// 口コミ投稿フォーム（#6：利用シーン選択を追加）
export default function ReviewForm({ productId, onPosted }: Props) {
  const [scene, setScene] = useState("");
  const [rating, setRating] = useState(0); // 0 = 未選択
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    // 入力チェック
    if (!isScene(scene)) {
      setError("利用シーンを選択してください");
      return;
    }
    if (rating === 0) {
      setError("評価（星）を選択してください");
      return;
    }
    if (comment.trim() === "") {
      setError("口コミを入力してください");
      return;
    }

    setIsSending(true);
    try {
      await postReview(productId, {
        user_id: TEST_USER_ID,
        rating,
        scene_tag: scene,
        comment: comment.trim(),
      });
      setScene("");
      setRating(0);
      setComment("");
      setMessage("口コミを投稿しました");
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>口コミ投稿</h2>

      {/* 利用シーン：絞り込みと同じ形のボタンから1つ選ぶ */}
      <div style={{ marginBottom: "20px" }}>
        <span style={labelStyle}>利用シーン</span>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {SCENES.map((s) => {
            const isActive = scene === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={isActive}
                onClick={() => setScene(s)}
                style={{
                  backgroundColor: isActive ? "#2563eb" : "#ffffff",
                  color: isActive ? "#ffffff" : "#000000",
                  border: isActive ? "1px solid #2563eb" : "1px solid #ccc",
                  borderRadius: "6px",
                  padding: "10px 16px",
                  fontSize: "15px",
                  cursor: "pointer",
                  fontWeight: isActive ? "bold" : "normal",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* 評価：星をクリックして選ぶ */}
      <div style={{ marginBottom: "20px" }}>
        <span style={labelStyle}>評価</span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`星${n}つ`}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
              style={{
                background: "none",
                border: "none",
                padding: "4px",
                fontSize: "36px",
                lineHeight: 1,
                cursor: "pointer",
                color: n <= rating ? "#f59e0b" : "#d1d5db",
              }}
            >
              ★
            </button>
          ))}
          <span style={{ marginLeft: "12px", color: "#666" }}>
            {rating === 0 ? "星をクリックして選択" : `${rating} / 5`}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label htmlFor="review-comment" style={labelStyle}>
          口コミ
        </label>
        <textarea
          id="review-comment"
          rows={5}
          maxLength={1000}
          placeholder="贈った相手の反応や、選んだ理由などを書いてください"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "15px",
            boxSizing: "border-box",
          }}
        />
      </div>

      {error && (
        <p role="alert" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
      {message && <p style={{ color: "#16a34a" }}>{message}</p>}

      <button
        type="submit"
        disabled={isSending}
        style={{
          backgroundColor: isSending ? "#93c5fd" : "#2563eb",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          padding: "12px 32px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: isSending ? "default" : "pointer",
        }}
      >
        {isSending ? "投稿中…" : "口コミを投稿する"}
      </button>
    </form>
  );
}
