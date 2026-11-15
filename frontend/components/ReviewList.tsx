"use client";

import { useState } from "react";
import { postVote } from "@/lib/reviewApi";
import { VOTE_BAD, VOTE_GOOD, type Review, type VoteType } from "@/types/review";
import styles from "./review.module.css";

type Props = {
  reviews: Review[];
};

const INITIAL_COUNT = 5; // 最初に表示する件数

// 評価ボタンを押したあとの件数と、自分の評価（口コミIDごとに持つ）
type VoteState = {
  good: number;
  bad: number;
  myVote: VoteType | null;
};

// 口コミ一覧（#8）と評価ボタン（#10・#11）
// 最初は5件だけ表示し、「もっと見る」で全件を開く。シーンを切り替えると5件表示に戻る
export default function ReviewList({ reviews }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [sendingId, setSendingId] = useState<string | null>(null); // 送信中の口コミ
  const [voteErrors, setVoteErrors] = useState<Record<string, string>>({});

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

  // 評価ボタン：押すとAPIに送り、返ってきた件数と自分の評価で表示を更新する
  const handleVote = async (reviewId: string, voteType: VoteType) => {
    setSendingId(reviewId);
    setVoteErrors((prev) => ({ ...prev, [reviewId]: "" }));
    try {
      const result = await postVote(reviewId, voteType);
      setVotes((prev) => ({
        ...prev,
        [reviewId]: {
          good: result.vote_good_count,
          bad: result.vote_bad_count,
          myVote: result.my_vote,
        },
      }));
    } catch (err) {
      setVoteErrors((prev) => ({
        ...prev,
        [reviewId]: err instanceof Error ? err.message : "評価を送れませんでした",
      }));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div>
      <ul className={styles.reviewList}>
        {visibleReviews.map((review) => {
          // 押したあとの値があればそちら、なければAPIから受け取った値
          const vote = votes[review.review_id] ?? {
            good: review.vote_good_count,
            bad: review.vote_bad_count,
            myVote: review.my_vote ?? null,
          };
          const isSending = sendingId === review.review_id;

          return (
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
                <button
                  type="button"
                  className={`${styles.voteButton} ${
                    vote.myVote === VOTE_GOOD ? styles.voteButtonOn : ""
                  }`}
                  aria-pressed={vote.myVote === VOTE_GOOD}
                  disabled={isSending}
                  onClick={() => handleVote(review.review_id, VOTE_GOOD)}
                >
                  👍 参考になった
                  <span className={styles.voteCount}>{vote.good}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.voteButton} ${
                    vote.myVote === VOTE_BAD ? styles.voteButtonOn : ""
                  }`}
                  aria-pressed={vote.myVote === VOTE_BAD}
                  disabled={isSending}
                  onClick={() => handleVote(review.review_id, VOTE_BAD)}
                >
                  👎 参考にならなかった
                  <span className={styles.voteCount}>{vote.bad}</span>
                </button>
              </div>

              {voteErrors[review.review_id] && (
                <p role="alert" className={styles.voteError}>
                  {voteErrors[review.review_id]}
                </p>
              )}
            </li>
          );
        })}
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
