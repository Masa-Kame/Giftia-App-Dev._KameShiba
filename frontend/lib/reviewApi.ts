// 口コミAPI（FastAPI）を呼ぶ関数
import type { Review, Scene, SceneFilterValue, VoteType } from "@/types/review";
import { ALL_SCENES, TEST_USER_ID } from "@/types/review";

// APIのURL（既存の lib/api.ts と同じ設定を使う）
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ReviewListResponse = {
  total: number; // 選んだシーンの件数
  results: Review[];
  scene_counts: Record<Scene, number>; // シーンごとの件数（商品の口コミ全体）
  all_count: number; // すべての件数
};

// APIがエラーを返したとき、理由（detail）を取り出す
async function toError(res: Response): Promise<Error> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return new Error(data.detail);
  } catch {
    // JSONでない場合は下の共通メッセージにする
  }
  return new Error(`通信に失敗しました（${res.status}）`);
}

// #7 シーン別口コミ取得
export async function fetchReviews(
  productId: string,
  scene: SceneFilterValue
): Promise<ReviewListResponse> {
  const params = new URLSearchParams();
  if (scene !== ALL_SCENES) params.set("scene", scene);
  // ログインがないため、テスト用ユーザーとして「自分が押した評価」を受け取る（#10）
  params.set("user_id", TEST_USER_ID);

  const res = await fetch(
    `${API_BASE_URL}/api/products/${encodeURIComponent(productId)}/reviews?${params}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw await toError(res);
  return res.json();
}

export type ReviewInput = {
  user_id: string;
  rating: number;
  scene_tag: Scene;
  comment: string;
};

// #6 口コミ投稿
export async function postReview(
  productId: string,
  input: ReviewInput
): Promise<Review> {
  const res = await fetch(
    `${API_BASE_URL}/api/products/${encodeURIComponent(productId)}/reviews`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!res.ok) throw await toError(res);
  return res.json();
}

export type VoteResult = {
  review_id: string;
  vote_good_count: number;
  vote_bad_count: number;
  my_vote: VoteType | null;
};

// #10・#11 口コミの評価（同じボタンをもう一度押すと取り消し、逆のボタンで切り替え）
export async function postVote(
  reviewId: string,
  voteType: VoteType
): Promise<VoteResult> {
  const res = await fetch(
    `${API_BASE_URL}/api/reviews/${encodeURIComponent(reviewId)}/votes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: TEST_USER_ID, vote_type: voteType }),
    }
  );
  if (!res.ok) throw await toError(res);
  return res.json();
}
