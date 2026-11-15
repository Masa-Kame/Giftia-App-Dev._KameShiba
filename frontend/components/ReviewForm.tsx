"use client";

import { useState } from "react";
import { postReview } from "@/lib/reviewApi";
import { SCENES, TEST_USER_ID, isScene } from "@/types/review";
import styles from "./review.module.css";

type Props = {
  productId: string;
  onPosted: () => void; // 投稿できたら親に知らせる（一覧を読み直す）
};

// 口コミ投稿フォーム（#6：利用シーン選択を追加）。見た目はトップ画面にそろえている
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
    <form className={styles.reviewForm} onSubmit={handleSubmit}>
      <h2 className={styles.sectionTitle}>口コミを投稿する</h2>

      {/* 利用シーン：トップ画面と同じタグから1つ選ぶ */}
      <div className={styles.field}>
        <span className="field-caption">
          利用シーン<span className="field-hint">（1つ選択）</span>
        </span>
        <div className="preference-tags">
          {SCENES.map((s) => {
            const isActive = scene === s;
            return (
              <button
                key={s}
                type="button"
                className={`preference-tag${isActive ? " selected" : ""}`}
                aria-pressed={isActive}
                onClick={() => setScene(s)}
              >
                <span aria-hidden="true">#</span>
                <span>{s}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 評価：星をクリックして選ぶ */}
      <div className={styles.field}>
        <span className="field-caption">評価</span>
        <div className={styles.starButtons}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={
                n <= rating
                  ? `${styles.starButton} ${styles.starButtonOn}`
                  : styles.starButton
              }
              aria-label={`星${n}つ`}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
            >
              ★
            </button>
          ))}
          <span className={styles.starLabel}>
            {rating === 0 ? "星をクリックして選択" : `${rating} / 5`}
          </span>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="review-comment" className="field-caption">
          口コミ
        </label>
        <textarea
          id="review-comment"
          className={styles.textarea}
          maxLength={1000}
          placeholder="贈った相手の反応や、選んだ理由などを書いてください"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && <p className={styles.success}>{message}</p>}

      <div className={styles.formActions}>
        <button type="submit" className="search-submit" disabled={isSending}>
          {isSending ? "投稿中…" : "口コミを投稿する"}
        </button>
      </div>
    </form>
  );
}
