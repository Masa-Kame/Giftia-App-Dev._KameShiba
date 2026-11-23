# main.py — Giftia 検索API（2週目・穴埋め版）
# 【穴1】〜【穴4】を、対応表と公式ドキュメント・データ定義.md を頼りに自分で埋める。
# 埋めるまでは ___ が残っていて動かない（/api/search を呼ぶと 500 になり、ターミナルに NameError と行番号が出る）。
# 答えは 配布コード/答え合わせ/backend/main.py（自分で埋めてから見る）。
#
# 画面（Next.js）から呼ばれる「窓口」。条件を受け取り、班のDBを検索して、結果を JSON で返す。
# 起動：uvicorn main:app --reload
# 確認：http://localhost:8000/docs（Swagger UI。ブラウザから API を試せる）

import os
import json
import math
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from database import fetch_all
from reviews import router as reviews_router
from products import router as products_router
from votes import router as votes_router    

load_dotenv()  # .env を読む（DB の接続情報・CORS の許可）

app = FastAPI(title="Giftia Search API（2週目）")

# 人気順・おすすめ検索の購入実績に適用するデモ基準日。
DEMO_REFERENCE_DATE = date(2026, 6, 30)
BAYES_PRIOR_WEIGHT = 10
DEMO_ATTRIBUTES_PATH = Path(__file__).resolve().parent / "data" / "demo_product_attributes.json"

# 評価順・価格順・おすすめ検索は同一の有効口コミ集合を使う。
REVIEW_CTE = """WITH valid_reviews AS (
    SELECT r.product_id AS reviewed_product_id, r.rating AS review_rating
    FROM reviews r JOIN products existing ON existing.product_id = r.product_id
    WHERE r.rating BETWEEN 1 AND 5
), review_stats AS (
    SELECT reviewed_product_id, COUNT(*) AS v, SUM(review_rating) AS rating_sum
    FROM valid_reviews GROUP BY reviewed_product_id
), global_rating AS (
    SELECT AVG(1.0 * review_rating) AS average_c FROM valid_reviews
)"""


def popularity_bounds(period: str) -> tuple[str, str] | None:
    if period == "all":
        return None
    reference = DEMO_REFERENCE_DATE
    starts = {
        "weekly": reference - timedelta(days=6),
        "monthly": reference.replace(day=1),
        "yearly": reference.replace(month=1, day=1),
    }
    return starts[period].isoformat(), (reference + timedelta(days=1)).isoformat()

# ── CORS ───────────────────────────────────────
# 画面（http://localhost:3000）と API（http://localhost:8000）は別のアプリ＝オリジンが違う。
# ブラウザは既定で「別オリジンへの通信」を止めるので、API 側が「この画面からは受け付ける」と宣言する。
# 許可する画面の URL は .env の CORS_ORIGINS に書く（カンマ区切りで複数可）。空なら何も許可しない。
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET","POST"], allow_headers=["*"])
app.include_router(reviews_router)
app.include_router(products_router)
app.include_router(votes_router) 

@app.get("/api/health")
def health():
    """つながっているかの確認。どの DB に何件の商品があるか"""
    row = fetch_all("SELECT DATABASE() AS db, COUNT(*) AS products FROM products")[0]
    return {"status": "ok", "db": row["db"], "products": row["products"]}


@app.get("/api/search")
def search(
    q: str = Query(default="", description="キーワード（空白区切りで複数。すべてを含む商品）"),
    category: str = Query(default="", description="カテゴリー（空ならすべて）"),
    categories: list[str] | None = Query(default=None, description="カテゴリーの複数指定（OR検索。categoryより優先）"),
    indiv_wrap: bool = Query(default=False, description="true なら、説明文に「個包装」とある商品だけ"),
    price_min: int | None = Query(default=None, ge=0, description="価格の下限（以上）"),
    price_max: int | None = Query(default=None, ge=0, description="価格の上限（以下）"),
    limit: int = Query(default=20, ge=1, le=100, description="返す件数"),
    sort: Literal["price_asc", "popular", "rating", "recommend"] | None = Query(default=None, description="未指定は従来の販売数順"),
    popularity_period: Literal["weekly", "monthly", "yearly", "all"] = Query(default="monthly", description="人気順の集計期間"),
    scene: Literal["", "送別", "誕生日", "母の日", "お歳暮", "お中元", "結婚祝い", "父の日", "出産祝い"] = Query(default="", description="実DBで同名タグを確認済みのシーン。未指定はすべて"),
    gift_policy: Literal["classic", "unique"] | None = Query(default=None),
):
    """条件に合う商品を指定順で返す。sort未指定時は従来のsales_count順を維持する。"""
    if sort == "recommend" and (scene != "送別" or gift_policy is None):
        raise HTTPException(status_code=422, detail="おすすめ検索は送別シーンとギフトポリシーが必須です。")
    # ① 条件を WHERE に1つずつ足す（値は %s で渡し、SQL の文字列に直接つなげない）
    where, params = ["stock > 0"], []  # 在庫切れは出さない
    for word in q.split():  # 【穴1】q を空白で区切って1語ずつにする（文字列のメソッド）
        where.append("(product_name LIKE %s OR brand LIKE %s OR description LIKE %s)")
        params += [f"%{word}%"] * 3
    selected_categories = [value for value in (categories or []) if value]
    if selected_categories:
        placeholders = ", ".join(["%s"] * len(selected_categories))
        where.append(f"category IN ({placeholders})")
        params.extend(selected_categories)
    elif category:
        where.append("category = %s")
        params.append(category)  # 【穴2】%s に入れる値（受け取ったカテゴリー）
    if indiv_wrap:
        where.append("description LIKE %s")  # 「個包装」は列がないので、説明文に書いてあるかで見る
        params.append("%個包装%")  # 【穴3】「個包装」をどこかに含む、という LIKE のパターン
    if price_min is not None:
        where.append("price >= %s")
        params.append(price_min)
    if price_max is not None:
        where.append("price <= %s")
        params.append(price_max)
    if scene:
        where.append("EXISTS (SELECT 1 FROM product_scenes ps WHERE ps.product_id = p.product_id AND ps.scene_tag = %s)")
        params.append(scene)
    condition = " AND ".join(where)

    # ② 件数と、人気順の上位 limit 件を取る
    total = fetch_all(f"SELECT COUNT(*) AS n FROM products p WHERE {condition}", tuple(params))[0]["n"]
    if sort == "recommend":
        rows = recommendation_rows(condition, params, scene, gift_policy, limit)
        return {"total": total, "results": rows}
    prefix, joins, sort_params = "", "", []
    rating_order = """CASE WHEN COALESCE(review_stats.v, 0) > 0 THEN 0 ELSE 1 END ASC,
            (1.0 * review_stats.rating_sum + %s * global_rating.average_c)
                / (review_stats.v + %s) DESC,
            COALESCE(review_stats.v, 0) DESC, p.product_id ASC"""
    order_by = {
        None: "p.sales_count DESC, p.product_id ASC",
        "price_asc": f"p.price ASC, {rating_order}",
        "popular": "COALESCE(popularity.sold_quantity, 0) DESC, p.product_id ASC",
        "rating": rating_order,
    }[sort]
    if sort == "popular":
        bounds = popularity_bounds(popularity_period)
        period_condition = "WHERE o.ordered_at >= %s AND o.ordered_at < %s" if bounds else ""
        sort_params.extend(bounds or ())
        joins = f"""LEFT JOIN (
            SELECT oi.product_id AS popularity_product_id, SUM(oi.quantity) AS sold_quantity
            FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
            {period_condition}
            GROUP BY oi.product_id
        ) popularity ON popularity.popularity_product_id = p.product_id"""
    elif sort in ("rating", "price_asc"):
        # 商品テーブルの保存値を使わず、同じ有効口コミ集合からR・v・Cを計算する。
        prefix = REVIEW_CTE
        joins = """LEFT JOIN review_stats ON review_stats.reviewed_product_id = p.product_id
            CROSS JOIN global_rating"""

    ranking_params = (BAYES_PRIOR_WEIGHT, BAYES_PRIOR_WEIGHT) if sort in ("rating", "price_asc") else ()
    rows = fetch_all(
        f"""{prefix} SELECT p.product_id, p.category, p.brand, p.product_name,
                p.price, p.rating, p.review_count
            FROM products p {joins} WHERE {condition}
            ORDER BY {order_by}
            LIMIT %s""",
        (*sort_params, *params, *ranking_params, limit),
    )
    # ③ DB の行を、画面の Gift 型（1週目）に詰め替えて返す
    return {"total": total, "results": [to_gift(r) for r in rows]}


def recommendation_rows(condition, params, scene, policy, limit):
    """全候補を採点してから上限を適用。JSON由来の値もSQLに埋め込まない。"""
    rows = fetch_all(
        f"""{REVIEW_CTE}, scene_sales AS (
            SELECT oi.product_id AS sold_product_id, SUM(oi.quantity) AS quantity
            FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
            JOIN products existing ON existing.product_id = oi.product_id
            WHERE o.gift_purpose = %s AND o.ordered_at < %s
            GROUP BY oi.product_id
        ), maximum_sales AS (
            SELECT COALESCE(MAX(quantity), 0) AS max_quantity FROM scene_sales
        )
        SELECT p.product_id, p.category, p.brand, p.product_name,
            p.price, p.rating, p.review_count,
            COALESCE(scene_sales.quantity, 0) AS purchased_quantity,
            COALESCE(review_stats.v, 0) AS valid_review_count,
            COALESCE(review_stats.rating_sum, 0) AS rating_sum,
            global_rating.average_c, maximum_sales.max_quantity
        FROM products p
        LEFT JOIN scene_sales ON scene_sales.sold_product_id = p.product_id
        LEFT JOIN review_stats ON review_stats.reviewed_product_id = p.product_id
        CROSS JOIN global_rating CROSS JOIN maximum_sales
        WHERE {condition}
        ORDER BY p.product_id ASC""",
        (scene, (DEMO_REFERENCE_DATE + timedelta(days=1)).isoformat(), *params),
    )
    attributes = json.loads(DEMO_ATTRIBUTES_PATH.read_text(encoding="utf-8"))["products"]
    tags = {item["product_id"]: item for item in attributes if item["scene"] == scene}
    ranked = []
    for row in rows:
        tag = tags.get(row["product_id"])
        group = 1 if tag is None else 0 if tag["policy"] == policy else 2
        quantity = max(0, int(row["purchased_quantity"]))
        maximum = max(0, int(row["max_quantity"]))
        v = int(row["valid_review_count"])
        c = float(row["average_c"]) if row["average_c"] is not None else None
        bayes = (float(row["rating_sum"]) + BAYES_PRIOR_WEIGHT * c) / (v + BAYES_PRIOR_WEIGHT) if c is not None else None
        purchase_score = 30 * math.log1p(quantity) / math.log1p(maximum) if maximum else 0.0
        review_score = 20 * (bayes - 1) / 4 if bayes is not None else 0.0
        policy_score = {0: 20, 1: 10, 2: 0}[group]
        score = 30 + policy_score + purchase_score + review_score
        reasons = [{"source": "database", "text": f"{scene}シーンに対応した商品"}]
        if tag is not None and group == 0:
            reasons.append({"source": "demo_curated", "text": tag["reason"]})
        if quantity > 0:
            reasons.append({"source": "database", "text": f"{scene}目的で{quantity:,}個の購入実績があります"})
        if v >= 5 and bayes is not None and bayes >= 4:
            reasons.append({"source": "database", "text": "購入者から高い評価を得ています"})
        gift = to_gift(row)
        gift["recommendation"] = {
            "scene": scene, "policy": policy, "productPolicy": tag["policy"] if tag else None,
            "group": ["match", "untagged", "opposite"][group],
            "score": score, "components": {"scene": 30, "policy": policy_score,
                "purchase": purchase_score, "review": review_score},
            "purchaseQuantity": quantity, "validReviewCount": v, "bayesianRating": bayes,
            "reasons": reasons[:3],
        }
        ranked.append((group, -score, str(row["product_id"]), gift))
    ranked.sort(key=lambda item: item[:3])
    return [item[3] for item in ranked[:limit]]


def to_gift(r: dict) -> dict:
    """DB の列名 → 画面（lib/api.ts の Gift 型）の項目名。画面側は1週目のまま変えない"""
    return {
        "id": r["product_id"],
        "category": r["category"],
        "brand": r["brand"],
        "name": r["product_name"],  # 【穴4】商品名の列名（データ定義.md の products を見る）
        "price": r["price"],
        "rating": float(r["rating"]) if r["rating"] is not None else 0,  # レビューなしは 0
        "reviewCount": r["review_count"],
    }
