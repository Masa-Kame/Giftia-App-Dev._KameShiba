# products.py — 商品詳細API（商品詳細画面の「商品情報」「購入エリア」に表示する）
# main.py に次の2行を足して読み込む：
#   from products import router as products_router
#   app.include_router(products_router)

from calendar import monthrange
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from database import db_cursor
from ranking_config import DEMO_REFERENCE_DATE

router = APIRouter(prefix="/api/products", tags=["products"])


def _to_bool(value):
    """tinyint（1/0）を true/false に。値がなければ null"""
    return None if value is None else bool(value)


def _recent_year_bounds(reference: date) -> tuple[date, date]:
    """基準日を含む直近1暦年。[開始日, 基準日の翌日)で日時を比較する。"""
    end = reference + timedelta(days=1)
    start = date(end.year - 1, end.month,
                 min(end.day, monthrange(end.year - 1, end.month)[1]))
    return start, end


@router.get("/{product_id}")
def get_product(product_id: str):
    """商品1件の情報と、付いているシーン・対象・好みタグを返す"""
    period_start, period_end = _recent_year_bounds(DEMO_REFERENCE_DATE)
    # 商品・属性・購入実績の SELECT を1回の接続でまとめて実行する。
    with db_cursor() as cur:
        cur.execute("SELECT * FROM products WHERE product_id = %s", (product_id,))
        p = cur.fetchone()
        if p is None:
            raise HTTPException(status_code=404, detail="商品が見つかりません")

        cur.execute(
            """SELECT COALESCE(SUM(oi.quantity), 0) AS purchased_quantity
               FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
               WHERE oi.product_id = %s AND o.ordered_at >= %s AND o.ordered_at < %s""",
            (product_id, period_start.isoformat(), period_end.isoformat()),
        )
        recent_year_sales_count = int(cur.fetchone()["purchased_quantity"])

        cur.execute(
            "SELECT scene_tag FROM product_scenes WHERE product_id = %s ORDER BY scene_tag",
            (product_id,),
        )
        scenes = cur.fetchall()
        cur.execute(
            "SELECT target_age, target_gender FROM product_targets WHERE product_id = %s",
            (product_id,),
        )
        targets = cur.fetchall()
        cur.execute(
            """SELECT t.preference_tag
               FROM product_preference pp
               JOIN preference_tags t ON t.preference_tag_id = pp.preference_tag_id
               WHERE pp.product_id = %s
               ORDER BY t.preference_category, t.preference_tag""",
            (product_id,),
        )
        preferences = cur.fetchall()

    rating = p.get("rating")
    # 列がないデータでも動くように p.get() で取り出す（ない項目は null になり、画面では表示しない）
    return {
        "product_id": p["product_id"],
        "product_name": p.get("product_name"),
        "brand": p.get("brand"),
        "store_name": p.get("store_name"),
        "category": p.get("category"),
        "price": p.get("price"),
        "description": p.get("description"),
        "size": p.get("size"),
        "gift_wrap": _to_bool(p.get("gift_wrap")),
        "message_card": _to_bool(p.get("message_card")),
        "rating": float(rating) if rating is not None else None,
        "review_count": p.get("review_count"),
        "sales_count": p.get("sales_count"),
        "recent_year_sales_count": recent_year_sales_count,
        "sales_period_start": period_start.isoformat(),
        "sales_period_end": (period_end - timedelta(days=1)).isoformat(),
        "stock": p.get("stock"),
        "registered_at": p.get("registered_at"),
        "scenes": [r["scene_tag"] for r in scenes],
        "target_ages": sorted({r["target_age"] for r in targets}),
        "target_genders": sorted({r["target_gender"] for r in targets}),
        "preferences": [r["preference_tag"] for r in preferences],
    }


# ── 似た商品（商品詳細の「この商品を探している方へのおすすめ」）──────────────
# 候補：在庫あり・自分以外で、同じシーンタグを1つ以上持つか同じカテゴリの商品。価格は半額〜1.5倍
# 並び順：共通シーン数の多い順 → 同じカテゴリ優先 → 補正評価（ベイズ平均）の高い順 → 価格が近い順 → 商品ID順
# 同じ商品なら毎回同じ結果になる（理由もデータから作るので説明できる）
SIMILAR_PRIOR_WEIGHT = 10  # 補正評価の m（検索の評価順 BAYES_PRIOR_WEIGHT と同じ値）
SIMILAR_SQL = """WITH target AS (
    SELECT product_id, category, price FROM products WHERE product_id = %s
), target_scenes AS (
    SELECT DISTINCT scene_tag FROM product_scenes WHERE product_id = %s
), shared AS (
    SELECT ps.product_id AS shared_product_id,
           COUNT(DISTINCT ps.scene_tag) AS shared_scene_count,
           GROUP_CONCAT(DISTINCT ps.scene_tag) AS shared_scenes
    FROM product_scenes ps JOIN target_scenes ts ON ts.scene_tag = ps.scene_tag
    GROUP BY ps.product_id
), review_stats AS (
    SELECT product_id AS reviewed_product_id, COUNT(*) AS v, SUM(rating) AS rating_sum
    FROM reviews WHERE rating BETWEEN 1 AND 5 GROUP BY product_id
), global_rating AS (
    SELECT AVG(1.0 * rating) AS average_c FROM reviews WHERE rating BETWEEN 1 AND 5
)
SELECT p.product_id, p.product_name, p.brand, p.category, p.price,
       p.rating AS display_rating, p.review_count AS display_review_count,
       COALESCE(shared.shared_scene_count, 0) AS shared_scene_count,
       shared.shared_scenes,
       CASE WHEN p.category = target.category THEN 1 ELSE 0 END AS same_category,
       (COALESCE(review_stats.rating_sum, 0) + %s * COALESCE(global_rating.average_c, 0))
         / (COALESCE(review_stats.v, 0) + %s) AS bayesian_rating,
       COALESCE(review_stats.v, 0) AS review_count,
       ABS(p.price - target.price) AS price_diff
FROM products p
CROSS JOIN target
CROSS JOIN global_rating
LEFT JOIN shared ON shared.shared_product_id = p.product_id
LEFT JOIN review_stats ON review_stats.reviewed_product_id = p.product_id
WHERE p.product_id <> target.product_id
  AND p.stock > 0
  AND (shared.shared_product_id IS NOT NULL OR p.category = target.category)
  AND p.price BETWEEN target.price * 0.5 AND target.price * 1.5
ORDER BY shared_scene_count DESC, same_category DESC, bayesian_rating DESC,
         price_diff ASC, p.product_id ASC
LIMIT %s"""


def _similar_reasons(row) -> list[str]:
    """おすすめ理由（データから作る。当てはまらない理由は付けない）"""
    reasons = []
    if row["shared_scenes"]:
        scenes = sorted(set(str(row["shared_scenes"]).split(",")))
        reasons.append(f"同じシーン（{'・'.join(scenes)}）で選ばれている")
    if row["same_category"]:
        reasons.append(f"同じカテゴリ（{row['category']}）")
    reasons.append("近い価格帯")
    return reasons


def find_similar_products(cur, product_id: str, limit: int) -> list[dict]:
    """似た商品を limit 件返す。cur は db_cursor() のカーソル（テストでは差し替える）"""
    cur.execute(
        SIMILAR_SQL,
        (product_id, product_id, SIMILAR_PRIOR_WEIGHT, SIMILAR_PRIOR_WEIGHT, limit),
    )
    return [
        {
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "brand": row["brand"],
            "category": row["category"],
            "price": row["price"],
            # 表示する評価・件数は商品詳細と同じ products の値（補正評価は並び順にだけ使う）
            "rating": float(row["display_rating"]) if row["display_rating"] is not None else None,
            "review_count": row["display_review_count"],
            "reasons": _similar_reasons(row),
        }
        for row in cur.fetchall()
    ]


@router.get("/{product_id}/similar")
def get_similar_products(product_id: str, limit: int = Query(default=4, ge=1, le=12)):
    """「この商品を探している方へのおすすめ」。商品がなければ404"""
    with db_cursor() as cur:
        cur.execute("SELECT 1 FROM products WHERE product_id = %s", (product_id,))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="商品が見つかりません")
        return {"results": find_similar_products(cur, product_id, limit)}
