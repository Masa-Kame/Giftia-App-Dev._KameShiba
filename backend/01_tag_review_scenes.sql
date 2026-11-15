-- 01_tag_review_scenes.sql
-- 既存の口コミに、コメントのキーワードから利用シーン(scene_tag)を一括で付ける
--
-- 方針
--   ・コメントにキーワードがある口コミだけにシーンを付ける
--   ・コメントがない口コミ、キーワードに当たらない口コミは NULL のまま(推測で付けない)
--   ・すでにシーンが入っている口コミ(投稿時に選んだもの)は上書きしない
--   ・複数のキーワードに当たる場合は、具体的なシーンを優先する(母の日 → … → お礼 の順)
--
-- 使い方:手順1〜4を、上から1つずつ選択して実行する。手順5はやり直したいときだけ。


-- ────────────────────────────────────────────
-- 手順1:バックアップ(今のシーンを別テーブルに保存する)
-- ※ 2回目に実行すると「already exists」エラーになるが、1回目のバックアップが残っているので問題ない
-- ────────────────────────────────────────────
CREATE TABLE giftia_t105.reviews_scene_backup AS
SELECT review_id, scene_tag FROM giftia_t105.reviews;


-- ────────────────────────────────────────────
-- 手順2:事前確認(DBは変わらない)
-- 各シーンに何件付くかを表示する。「(該当なし)」は NULL のまま残る件数
-- ────────────────────────────────────────────
SELECT
  COALESCE(
    CASE
      WHEN comment REGEXP '母の日'                              THEN '母の日'
      WHEN comment REGEXP '父の日'                              THEN '父の日'
      WHEN comment REGEXP '出産|赤ちゃん|ベビー|ご誕生|誕生祝'  THEN '出産祝い'
      WHEN comment REGEXP '結婚|新婚|ウェディング|ブライダル'   THEN '結婚祝い'
      WHEN comment REGEXP '送別|退職|異動|転勤|餞別|お別れ'     THEN '送別'
      WHEN comment REGEXP '中元'                                THEN 'お中元'
      WHEN comment REGEXP '歳暮'                                THEN 'お歳暮'
      WHEN comment REGEXP '誕生日|バースデー|バースデイ'        THEN '誕生日'
      WHEN comment REGEXP 'お礼|御礼|お返し|感謝'               THEN 'お礼'
    END,
    '(該当なし)'
  ) AS scene,
  COUNT(*) AS 件数
FROM giftia_t105.reviews
WHERE scene_tag IS NULL
  AND comment IS NOT NULL
  AND comment <> ''
GROUP BY scene
ORDER BY 件数 DESC;


-- ────────────────────────────────────────────
-- 手順3:一括タグ付け(ここで初めてDBが変わる)
-- ※ 下の3文は「まとめて選択して」1回で実行する
--    (Workbench の安全モードを一時的に外し、終わったら戻している)
-- ────────────────────────────────────────────
SET SQL_SAFE_UPDATES = 0;

UPDATE giftia_t105.reviews
SET scene_tag =
  CASE
    WHEN comment REGEXP '母の日'                              THEN '母の日'
    WHEN comment REGEXP '父の日'                              THEN '父の日'
    WHEN comment REGEXP '出産|赤ちゃん|ベビー|ご誕生|誕生祝'  THEN '出産祝い'
    WHEN comment REGEXP '結婚|新婚|ウェディング|ブライダル'   THEN '結婚祝い'
    WHEN comment REGEXP '送別|退職|異動|転勤|餞別|お別れ'     THEN '送別'
    WHEN comment REGEXP '中元'                                THEN 'お中元'
    WHEN comment REGEXP '歳暮'                                THEN 'お歳暮'
    WHEN comment REGEXP '誕生日|バースデー|バースデイ'        THEN '誕生日'
    WHEN comment REGEXP 'お礼|御礼|お返し|感謝'               THEN 'お礼'
  END
WHERE scene_tag IS NULL
  AND comment IS NOT NULL
  AND comment <> '';

SET SQL_SAFE_UPDATES = 1;


-- ────────────────────────────────────────────
-- 手順4:結果確認(DBは変わらない)
-- シーンごとにランダムで5件ずつ表示する。コメントとシーンが合っているか目で確かめる
-- ────────────────────────────────────────────
SELECT scene_tag, comment
FROM (
  SELECT
    scene_tag,
    comment,
    ROW_NUMBER() OVER (PARTITION BY scene_tag ORDER BY RAND()) AS rn
  FROM giftia_t105.reviews
  WHERE scene_tag IS NOT NULL
) t
WHERE rn <= 5
ORDER BY scene_tag;


-- ────────────────────────────────────────────
-- 手順5:元に戻す(手順4でおかしかったときだけ実行する)
-- ※ 下の3文は「まとめて選択して」1回で実行する
-- ────────────────────────────────────────────
-- SET SQL_SAFE_UPDATES = 0;
--
-- UPDATE giftia_t105.reviews r
-- JOIN giftia_t105.reviews_scene_backup b ON b.review_id = r.review_id
-- SET r.scene_tag = b.scene_tag;
--
-- SET SQL_SAFE_UPDATES = 1;
