# votes.py — 口コミの「参考になった／参考にならなかった」評価API（#10・#11）
# main.py に次の2行を足して読み込む：
#   from votes import router as votes_router
#   app.include_router(votes_router)
#
# ルール
#   ・まだ押していない → 評価を登録する
#   ・同じボタンをもう一度押す → 取り消す
#   ・逆のボタンを押す → 切り替える
#   ・登録・取り消し・切り替えのたびに、review_rating（履歴）から件数を数え直して reviews に保存する
#     （件数の正は履歴。履歴と件数を同じ処理の中で更新するので、ずれない）

from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import transaction

router = APIRouter(prefix="/api/reviews", tags=["votes"])

GOOD, BAD = 1, 2  # review_rating.vote_type の値


class VoteRequest(BaseModel):
    """評価ボタンを押したときに画面から受け取るもの"""

    user_id: str = Field(min_length=1, max_length=20)  # ログインがないのでテスト用ユーザーIDを受け取る
    vote_type: Literal[1, 2]  # 1：参考になった 2：参考にならなかった


@router.post("/{review_id}/votes")
def vote(review_id: str, body: VoteRequest):
    """評価を登録・取り消し・切り替えして、更新後の件数と自分の評価を返す"""
    with transaction() as cur:
        # 口コミがあるか確認。FOR UPDATE で、同じ口コミへの評価が同時に来ても1つずつ処理する
        cur.execute("SELECT review_id FROM reviews WHERE review_id = %s FOR UPDATE", (review_id,))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="口コミが見つかりません")

        # この人の今の評価
        cur.execute(
            "SELECT vote_type FROM review_rating WHERE review_id = %s AND user_id = %s",
            (review_id, body.user_id),
        )
        current = cur.fetchone()

        if current is None:
            # まだ押していない → 登録
            cur.execute(
                """INSERT INTO review_rating (review_id, user_id, vote_type, vote_date)
                   VALUES (%s, %s, %s, %s)""",
                (review_id, body.user_id, body.vote_type, date.today()),
            )
            my_vote = body.vote_type
        elif current["vote_type"] == body.vote_type:
            # 同じボタン → 取り消し
            cur.execute(
                "DELETE FROM review_rating WHERE review_id = %s AND user_id = %s",
                (review_id, body.user_id),
            )
            my_vote = None
        else:
            # 逆のボタン → 切り替え
            cur.execute(
                """UPDATE review_rating SET vote_type = %s, vote_date = %s
                   WHERE review_id = %s AND user_id = %s""",
                (body.vote_type, date.today(), review_id, body.user_id),
            )
            my_vote = body.vote_type

        # 履歴から数え直して、口コミの件数を更新する
        cur.execute(
            """UPDATE reviews SET
                 vote_good_count = (SELECT COUNT(*) FROM review_rating
                                    WHERE review_id = %s AND vote_type = %s),
                 vote_bad_count  = (SELECT COUNT(*) FROM review_rating
                                    WHERE review_id = %s AND vote_type = %s)
               WHERE review_id = %s""",
            (review_id, GOOD, review_id, BAD, review_id),
        )

        cur.execute(
            "SELECT vote_good_count, vote_bad_count FROM reviews WHERE review_id = %s",
            (review_id,),
        )
        counts = cur.fetchone()

    return {
        "review_id": review_id,
        "vote_good_count": counts["vote_good_count"],
        "vote_bad_count": counts["vote_bad_count"],
        "my_vote": my_vote,
    }
