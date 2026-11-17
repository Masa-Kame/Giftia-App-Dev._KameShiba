# reviews.py — 口コミAPI（#7 シーン別口コミ取得 ／ #6 口コミ投稿）
# main.py に次の2行を足して読み込む：
#   from reviews import router as reviews_router
#   app.include_router(reviews_router)

from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from database import fetch_all, transaction

router = APIRouter(prefix="/api/products/{product_id}/reviews", tags=["reviews"])

# 利用シーン。product_scenes.scene_tag・画面側（types/review.ts の SCENES）と同じ表記にする
SCENES = ["送別", "誕生日", "父の日", "母の日", "結婚祝い", "出産祝い", "お中元", "お歳暮", "お礼"]

# 画面に返す列（画面側の Review 型と同じ名前）。件数は NULL でも 0 として返す
REVIEW_COLUMNS = """review_id, product_id, user_id, rating, comment, posted_at, scene_tag,
    COALESCE(vote_good_count, 0) AS vote_good_count,
    COALESCE(vote_bad_count, 0) AS vote_bad_count"""

# 一覧用：上と同じ列に、見ている人の評価（my_vote）を足したもの。review_rating と結合するので r. を付ける
LIST_COLUMNS = """r.review_id, r.product_id, r.user_id, r.rating, r.comment, r.posted_at, r.scene_tag,
    COALESCE(r.vote_good_count, 0) AS vote_good_count,
    COALESCE(r.vote_bad_count, 0) AS vote_bad_count,
    rr.vote_type AS my_vote"""


@router.get("")
def list_reviews(
    product_id: str,
    scene: str = Query(default="", description="利用シーン（空ならすべて）"),
    limit: int = Query(default=50, ge=1, le=100, description="返す件数"),
    user_id: str = Query(default="", description="見ている人のユーザーID（その人が押した評価を my_vote で返す）"),
):
    """商品の口コミを新着順で返す。scene を指定すると、そのシーンの口コミだけ返す（#7）
    あわせて、シーンごとの口コミ件数（scene_counts）とすべての件数（all_count）も返す
    user_id を渡すと、口コミごとにその人が押した評価（my_vote：1/2/null）も返す（#10）"""
    where, params = ["r.product_id = %s"], [product_id]
    if scene:
        if scene not in SCENES:
            raise HTTPException(status_code=400, detail=f"利用シーンが正しくありません: {scene}")
        where.append("r.scene_tag = %s")
        params.append(scene)
    condition = " AND ".join(where)

    total = fetch_all(f"SELECT COUNT(*) AS n FROM reviews r WHERE {condition}", tuple(params))[0]["n"]
    rows = fetch_all(
        f"""SELECT {LIST_COLUMNS}
            FROM reviews r
            LEFT JOIN review_rating rr
              ON rr.review_id = r.review_id AND rr.user_id = %s
            WHERE {condition}
            ORDER BY r.posted_at DESC, r.review_id DESC
            LIMIT %s""",
        (user_id, *params, limit),
    )

    # シーンごとの件数(絞り込みボタンに表示する)。選んだシーンに関係なく、その商品の口コミ全体で数える
    count_rows = fetch_all(
        "SELECT scene_tag, COUNT(*) AS n FROM reviews WHERE product_id = %s GROUP BY scene_tag",
        (product_id,),
    )
    scene_counts = {s: 0 for s in SCENES}
    all_count = 0
    for r in count_rows:
        all_count += r["n"]
        if r["scene_tag"] in scene_counts:
            scene_counts[r["scene_tag"]] = r["n"]

    return {"total": total, "results": rows, "scene_counts": scene_counts, "all_count": all_count}


class ReviewCreate(BaseModel):
    """口コミ投稿で画面から受け取るもの"""

    user_id: str = Field(min_length=1, max_length=20)  # ログインがないのでテスト用ユーザーIDを受け取る
    rating: int = Field(ge=1, le=5)  # 星評価
    scene_tag: str  # 利用シーン（#6）
    comment: str = Field(min_length=1, max_length=1000)


@router.post("", status_code=201)
def create_review(product_id: str, body: ReviewCreate):
    """口コミを1件登録する。利用シーンは必須（#6）"""
    if body.scene_tag not in SCENES:
        raise HTTPException(status_code=400, detail="利用シーンを選択してください")
    comment = body.comment.strip()
    if not comment:
        raise HTTPException(status_code=400, detail="口コミを入力してください")
    if not fetch_all("SELECT 1 FROM products WHERE product_id = %s", (product_id,)):
        raise HTTPException(status_code=404, detail="商品が見つかりません")

    with transaction() as cur:
        # 口コミIDは「RV + 7桁」。いまの最大値の次の番号を振る
        cur.execute("SELECT MAX(review_id) AS max_id FROM reviews")
        max_id = cur.fetchone()["max_id"]
        next_no = int(max_id[2:]) + 1 if max_id else 1
        review_id = f"RV{next_no:07d}"

        cur.execute(
            """INSERT INTO reviews
                   (review_id, product_id, user_id, rating, comment, posted_at, scene_tag,
                    vote_good_count, vote_bad_count)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0)""",
            (review_id, product_id, body.user_id, body.rating, comment, date.today(), body.scene_tag),
        )

    return fetch_all(f"SELECT {REVIEW_COLUMNS} FROM reviews WHERE review_id = %s", (review_id,))[0]
