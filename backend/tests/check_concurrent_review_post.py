# check_concurrent_review_post.py — 口コミIDが同時投稿で重複しないかを確かめるスクリプト
#
# 口コミ投稿API（POST /api/products/{商品ID}/reviews）に、N件を「同時に」送る。
#   ・全件が成功（201）したか
#   ・返ってきた口コミIDに重複がないか
# を表示する。標準ライブラリだけで動く（追加インストール不要）。
#
# 使い方（バックエンドを起動した状態で、backend フォルダで実行）：
#   python tests/check_concurrent_review_post.py
#   python tests/check_concurrent_review_post.py --product G0001 --count 10 --api http://127.0.0.1:8000
#
# ※ 班のDBにテスト用の口コミが入る。本文は「[同時投稿テスト]」で始まるので、確認後に手で消す：
#   DELETE FROM reviews WHERE comment LIKE '[同時投稿テスト]%';

import argparse
import json
import threading
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime

TEST_USER_ID = "U071299"  # 画面と同じテスト用ユーザー（frontend/types/review.ts）


def post_review(api: str, product_id: str, index: int, run_id: str, barrier: threading.Barrier, results: list):
    body = json.dumps({
        "user_id": TEST_USER_ID,
        "rating": 3,
        "scene_tag": "お礼",
        "comment": f"[同時投稿テスト] {run_id} #{index}",
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{api}/api/products/{product_id}/reviews",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    barrier.wait()  # 全スレッドがそろってから一斉に送る
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            data = json.loads(res.read().decode("utf-8"))
            results[index] = (res.status, data.get("review_id"), "")
    except urllib.error.HTTPError as e:
        results[index] = (e.code, None, e.read().decode("utf-8", errors="replace")[:200])
    except Exception as e:  # 接続できない など
        results[index] = (None, None, repr(e))


def main():
    parser = argparse.ArgumentParser(description="口コミ投稿APIの同時投稿チェック")
    parser.add_argument("--api", default="http://127.0.0.1:8000", help="APIのURL")
    parser.add_argument("--product", default="G0001", help="投稿先の商品ID")
    parser.add_argument("--count", type=int, default=10, help="同時に送る件数")
    args = parser.parse_args()

    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    results: list = [None] * args.count
    barrier = threading.Barrier(args.count)
    threads = [
        threading.Thread(target=post_review, args=(args.api, args.product, i, run_id, barrier, results))
        for i in range(args.count)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    print(f"=== 同時投稿チェック（{args.count}件 / 商品 {args.product} / {run_id}）===")
    for i, (status, review_id, error) in enumerate(results):
        print(f"#{i:2d}  status={status}  review_id={review_id}  {error}")

    ok_ids = [rid for status, rid, _ in results if status == 201]
    duplicates = [rid for rid, n in Counter(ok_ids).items() if n > 1]
    failed = args.count - len(ok_ids)

    print("---")
    print(f"成功：{len(ok_ids)}件 / 失敗：{failed}件 / ID重複：{len(duplicates)}件 {duplicates or ''}")
    if failed == 0 and not duplicates:
        print("OK：全件成功し、口コミIDの重複はありません")
    else:
        print("NG：同時投稿で失敗または重複があります")
    print("後片付け（Workbenchで実行）：DELETE FROM reviews WHERE comment LIKE '[同時投稿テスト]%';")


if __name__ == "__main__":
    main()
