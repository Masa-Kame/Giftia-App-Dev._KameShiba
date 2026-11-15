"use client";

import type { Review } from "@/types/review";

type Props = {
  reviews: Review[];
};

// 口コミ一覧(#8)と評価ボタン(#10)
export default function ReviewList({ reviews }: Props) {
  if (reviews.length === 0) {
    return <p>このシーンの口コミはまだありません。</p>;
  }

  return (
    <div>
      {reviews.map((review) => (
        <div
          key={review.review_id}
          style={{
            border: "1px solid #ddd",
            padding: "12px",
            marginBottom: "12px",
            borderRadius: "8px",
          }}
        >
          <p>
            <strong>{review.scene_tag ?? "シーン未設定"}</strong>
            <span style={{ marginLeft: "12px" }}>
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)}
            </span>
            <span style={{ marginLeft: "12px", color: "#666" }}>
              {review.posted_at}
            </span>
          </p>

          <p>{review.comment}</p>

          <div>
            {/* TODO(#10): 押下時に評価を送信し、件数を反映する */}
            <button type="button">
              👍 参考になった({review.vote_good_count})
            </button>
            <button type="button" style={{ marginLeft: "8px" }}>
              👎 参考にならなかった({review.vote_bad_count})
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
