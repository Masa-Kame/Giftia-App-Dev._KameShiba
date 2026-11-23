// lib/api.ts — 2週目：searchGifts() の中身を「FastAPI に聞く」に差し替える（穴埋め版）
// 【穴5】【穴6】を、対応表と公式ドキュメントを頼りに自分で埋める。
// 1週目の lib/sampleGifts.ts は、このファイルに置き換える（ダミーは使わない）。
// 答えは 配布コード/答え合わせ/frontend/api.ts（自分で埋めてから見る）。

// 画面が使う商品の形。1週目と同じ（画面・ResultCard は変えない）
export type Gift = {
  id: string;          // 商品ID（例 G0001）
  category: string;    // カテゴリ
  brand: string;       // ブランド・店名
  name: string;        // 商品名
  price: number;       // 価格（円）
  rating: number;      // レビューの平均
  reviewCount: number; // レビュー件数
  recommendation?: {
    scene: string;
    policy: "classic" | "unique";
    productPolicy: "classic" | "unique" | null;
    group: "match" | "untagged" | "opposite";
    score: number;
    components: { scene: number; policy: number; purchase: number; review: number };
    purchaseQuantity: number;
    validReviewCount: number;
    bayesianRating: number | null;
    reasons: { source: "database" | "demo_curated"; kind: "feature" | "purchase"; text: string }[];
  };
};

// 既存APIとの互換性を維持した検索条件。
export type SearchSort = "popular" | "rating" | "price_asc" | "recommend";
export type PopularityPeriod = "weekly" | "monthly" | "yearly" | "all";

export type SearchCondition = {
  keyword: string;    // いまの検索：キーワード
  category: string;   // いまの検索：カテゴリー（空ならすべて）
  categories?: string[]; // 複数選択（OR検索）。非空ならcategoryより優先
  indivWrap: boolean; // 取引先へのお礼：個包装だけ
  priceBand: string;  // 取引先へのお礼："" | "3000" | "5000"
  priceMin?: number; // バーの下限（以上）
  priceMax?: number; // バーの上限（以下）。未指定は上限なし
  sort?: SearchSort;
  popularityPeriod?: PopularityPeriod;
  scene?: string; // 実DBで同名のタグを確認したシーンのみ送信する。
  giftPolicy?: "classic" | "unique" | "";
  targetAge?: string;
  targetGender?: string;
  preferences?: string[]; // 受取人の好み。複数指定はOR
};

// API の場所。NEXT_PUBLIC_ の値はブラウザに配られる＝秘密は置かない（.env.local に書く）
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// 入力した条件をサーバー（FastAPI）に送り、結果（Gift の配列）をもらう
export async function searchGifts(c: SearchCondition): Promise<Gift[]> {
  // ① 条件を URL のクエリ（?q=...&category=...）に組み立てる。空の条件は送らない
  const params = new URLSearchParams();
  if (c.keyword) params.set("q", c.keyword);
  if (c.scene) params.set("scene", c.scene);
  if (c.targetAge && c.targetAge !== "指定なし") params.set("target_age", c.targetAge);
  if (c.targetGender && c.targetGender !== "指定なし") params.set("target_gender", c.targetGender);
  c.preferences?.forEach((preference) => params.append("preferences", preference));
  const categories = c.categories?.filter((value) => value !== "") ?? [];
  if (categories.length > 0) {
    categories.forEach((category) => params.append("categories", category));
  } else if (c.category) {
    params.set("category", c.category);
  }
  if (c.indivWrap) params.set("indiv_wrap", "true");
  if (c.priceBand === "3000") { params.set("price_min", "3000"); params.set("price_max", "4999"); } // 3,000以上 5,000未満
  if (c.priceBand === "5000") { params.set("price_min", "5000"); params.set("price_max", "9999"); } // 5,000以上 10,000未満
  if (c.priceMin !== undefined) params.set("price_min", String(c.priceMin));
  if (c.priceMax !== undefined) params.set("price_max", String(c.priceMax));
  if (c.sort) params.set("sort", c.sort);
  if (c.sort === "recommend" && c.giftPolicy) params.set("gift_policy", c.giftPolicy);
  if (c.sort === "popular" && c.popularityPeriod) params.set("popularity_period", c.popularityPeriod);

  // ② fetch で API を呼ぶ（通信が終わるまで待つ＝await）
  const res = await fetch(`${API}/api/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // ③ 返ってきた JSON を読む。{ total, results } の results が Gift の配列
  const data = await res.json();
  return data.results;
}
