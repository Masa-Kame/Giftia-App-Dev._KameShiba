"use client";

import { useState } from "react";
import type { Review } from "@/types/review";
import styles from "./review.module.css";

type Props = {
  reviews: Review[];
};

const INITIAL_COUNT = 5; // 最初に表示する件数

// 口コミ一覧（#8）と評価ボタン（#10）
// 最初は5件だけ表示し、「もっと見る」で全件を開く。シーンを切り替えると5件表示に戻る
export default function ReviewList({ reviews }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (reviews.length === 0) {
    return <p className={styles.message}>このシーンの口コミはまだありません。</p>;
  }

  const visibleReviews = isExpanded ? reviews : reviews.slice(0, INITIAL_COUNT);
  const hiddenCount = reviews.length - INITIAL_COUNT;

  const handleCollapse = () => {
    setIsExpanded(false);
    // 畳んだあと、口コミの先頭に戻る
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div>
      <ul className={styles.reviewList}>
        {visibleReviews.map((review) => (
          <li key={review.review_id} className={`card ${styles.reviewCard}`}>
            <div className={styles.reviewMeta}>
              <span
                className={
                  review.scene_tag
                    ? styles.sceneBadge
                    : `${styles.sceneBadge} ${styles.sceneBadgeEmpty}`
                }
              >
                {review.scene_tag ?? "シーン未設定"}
              </span>
              <span className={styles.stars} aria-label={`星${review.rating}つ`}>
                {"★".repeat(review.rating)}
                <span className={styles.starsEmpty}>
                  {"★".repeat(5 - review.rating)}
                </span>
              </span>
              <time className={styles.date} dateTime={review.posted_at}>
                {review.posted_at.replaceAll("-", "/")}
              </time>
            </div>

            {review.comment && <p className={styles.comment}>{review.comment}</p>}

            <div className={styles.votes}>
              {/* TODO(#10): 押下時に評価を送信し、件数を反映する */}
              <button type="button" className={styles.voteButton}>
                👍 参考になった
                <span className={styles.voteCount}>{review.vote_good_count}</span>
              </button>
              <button type="button" className={styles.voteButton}>
                👎 参考にならなかった
                <span className={styles.voteCount}>{review.vote_bad_count}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* 「もっと見る」はトップ画面の好みタグと同じボタン（globals.css の .preferences-toggle） */}
      {hiddenCount > 0 &&
        (isExpanded ? (
          <button type="button" className="preferences-toggle" onClick={handleCollapse}>
            閉じる ⌃
          </button>
        ) : (
          <button
            type="button"
            className="preferences-toggle"
            aria-expanded={false}
            onClick={() => setIsExpanded(true)}
          >
            もっと見る（残り{hiddenCount}件） ⌄
          </button>
        ))}
    </div>
  );
}
