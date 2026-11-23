# products.py — 商品詳細API（商品詳細画面の「商品情報」「購入エリア」に表示する）
# main.py に次の2行を足して読み込む：
#   from products import router as products_router
#   app.include_router(products_router)

from fastapi import APIRouter, HTTPException

from database import db_cursor

router = APIRouter(prefix="/api/products", tags=["products"])


def _to_bool(value):
    """tinyint（1/0）を true/false に。値がなければ null"""
    return None if value is None else bool(value)


@router.get("/{product_id}")
def get_product(product_id: str):
    """商品1件の情報と、付いているシーン・対象・好みタグを返す"""
    # 4本の SELECT を1回の接続でまとめて実行する（接続のやり直しを減らして速くする）
    with db_cursor() as cur:
        cur.execute("SELECT * FROM products WHERE product_id = %s", (product_id,))
        p = cur.fetchone()
        if p is None:
            raise HTTPException(status_code=404, detail="商品が見つかりません")

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
        "stock": p.get("stock"),
        "registered_at": p.get("registered_at"),
        "scenes": [r["scene_tag"] for r in scenes],
        "target_ages": sorted({r["target_age"] for r in targets}),
        "target_genders": sorted({r["target_gender"] for r in targets}),
        "preferences": [r["preference_tag"] for r in preferences],
    }
