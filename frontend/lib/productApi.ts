// 商品詳細API（FastAPI）を呼ぶ関数

// APIのURL（lib/apiBase.ts で共通管理）
import { API_BASE_URL } from "./apiBase";

// 商品詳細。DBに値がない項目は null
export type Product = {
  product_id: string;
  product_name: string | null;
  brand: string | null;
  store_name: string | null;
  category: string | null;
  price: number | null;
  description: string | null;
  size: string | null;
  gift_wrap: boolean | null; // ギフト包装に対応しているか
  message_card: boolean | null; // メッセージカードに対応しているか
  rating: number | null; // レビューの平均
  review_count: number | null;
  sales_count: number | null; // 直近1年の販売数
  stock: number | null;
  registered_at: string | null;
  scenes: string[]; // product_scenes
  target_ages: string[]; // product_targets
  target_genders: string[];
  preferences: string[]; // product_preference
};

export async function fetchProduct(productId: string): Promise<Product> {
  const res = await fetch(
    `${API_BASE_URL}/api/products/${encodeURIComponent(productId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("商品が見つかりません");
    throw new Error(`商品情報を取得できませんでした（${res.status}）`);
  }
  return res.json();
}

// 似た商品（商品詳細の「この商品を探している方へのおすすめ」）
export type SimilarProduct = {
  product_id: string;
  product_name: string | null;
  brand: string | null;
  category: string | null;
  price: number | null;
  rating: number | null; // 商品詳細と同じ評価の値
  review_count: number | null;
  reasons: string[]; // おすすめ理由（例：同じシーン（送別）で選ばれている）
};

export async function fetchSimilarProducts(
  productId: string,
  limit = 4
): Promise<SimilarProduct[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/products/${encodeURIComponent(productId)}/similar?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`おすすめ商品を取得できませんでした（${res.status}）`);
  const data = await res.json();
  return data.results;
}
