// 口コミ関連の共通定義(#6 投稿 / #7 API / #8 表示 で共通利用)
// フィールド名はDB(reviewsテーブル)のカラム名と同じにしている

// ※ product_scenes.scene_tag に入っている値と表記を一致させること
export const SCENES = [
  "送別",
  "誕生日",
  "父の日",
  "母の日",
  "結婚祝い",
  "出産祝い",
  "お中元",
  "お歳暮",
  "お礼",
] as const;

export type Scene = (typeof SCENES)[number];

// 絞り込み用の「すべて」(DBには保存しない)
export const ALL_SCENES = "すべて";
export type SceneFilterValue = Scene | typeof ALL_SCENES;

export type Review = {
  review_id: string; // 例: RV0000007
  product_id: string; // 例: G2433
  user_id: string; // 例: U071299
  rating: number; // 星評価(1〜5)
  comment: string | null;
  posted_at: string; // 例: 2026-11-15
  scene_tag: Scene | null; // 既存の口コミは未設定(NULL)
  vote_good_count: number; // 参考になった
  vote_bad_count: number; // 参考にならなかった
  my_vote?: VoteType | null; // 見ている人が押した評価（押していなければ null）
};

// 評価の種類（review_rating.vote_type と同じ値）
export const VOTE_GOOD = 1; // 参考になった
export const VOTE_BAD = 2; // 参考にならなかった
export type VoteType = typeof VOTE_GOOD | typeof VOTE_BAD;

// 並び替え(#12・#13)
export const SORT_OPTIONS = [
  { value: "new", label: "新着順" },
  { value: "good", label: "参考になった順" },
  { value: "bad", label: "参考にならなかった順" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

// ログイン機能がないため、投稿・評価はテスト用ユーザーで行う
// ※ usersテーブルに実在するIDにすること
export const TEST_USER_ID = "U071299";

// 値が正しいシーンかどうか(フォームのバリデーション用)
export const isScene = (value: string): value is Scene =>
  (SCENES as readonly string[]).includes(value);
