-- 02_create_tables.sql
-- 口コミ評価・商品推薦で使うテーブルを作る(要件定義書 5章・ER図に対応)
--
-- 使い方:手順0で今あるテーブルを確認し、まだないテーブルの手順だけを1つずつ選択して実行する
--        すでにあるテーブルの CREATE は実行しない(構造が違う場合は相談)


-- ────────────────────────────────────────────
-- 手順0:今あるテーブルを確認する
-- ────────────────────────────────────────────
SHOW TABLES FROM giftia_t105;


-- ────────────────────────────────────────────
-- 手順1:口コミ評価の履歴(#9)
-- 誰が・どの口コミに・参考になった/ならなかったを押したか
-- 主キーを (review_id, user_id) にして、1人が1つの口コミに評価できるのは1回だけにする
-- ────────────────────────────────────────────
CREATE TABLE giftia_t105.review_rating (
  review_id VARCHAR(12) NOT NULL,          -- reviews.review_id と同じ型
  user_id   VARCHAR(20) NOT NULL,          -- reviews.user_id と同じ型
  vote_type TINYINT     NOT NULL,          -- 1:参考になった 2:参考にならなかった
  vote_date DATE        NOT NULL,          -- 評価した日
  PRIMARY KEY (review_id, user_id),
  CONSTRAINT fk_review_rating_review
    FOREIGN KEY (review_id) REFERENCES giftia_t105.reviews(review_id),
  CONSTRAINT chk_review_rating_vote_type
    CHECK (vote_type IN (1, 2))
);


-- ────────────────────────────────────────────
-- 手順2:商品の対象年代・性別(商品推薦)
-- 1商品に複数の年代・性別を持てるよう、3つの列すべてを主キーにする
-- 例:30代・40代の男女向け → 4行(30代×男性、30代×女性、40代×男性、40代×女性)
--     性別を問わない商品は「指定なし」の1行でもよい
-- ※ 1つの欄に「30代,40代」とカンマ区切りで入れない
-- ────────────────────────────────────────────
CREATE TABLE giftia_t105.product_targets (
  product_id    VARCHAR(10) NOT NULL,      -- products.product_id と同じ型
  target_age    VARCHAR(10) NOT NULL,
  target_gender VARCHAR(10) NOT NULL,
  PRIMARY KEY (product_id, target_age, target_gender),
  INDEX idx_product_targets_search (target_age, target_gender),
  CONSTRAINT fk_product_targets_product
    FOREIGN KEY (product_id) REFERENCES giftia_t105.products(product_id),
  CONSTRAINT chk_product_targets_age
    CHECK (target_age IN ('10代', '20代', '30代', '40代', '50代', '60代以上')),
  CONSTRAINT chk_product_targets_gender
    CHECK (target_gender IN ('男性', '女性', '指定なし'))
);


-- ────────────────────────────────────────────
-- 手順3:好みタグのマスタ(商品推薦)
-- 選べる好みの一覧。カテゴリでまとめる(例:味 → 甘い・苦い)
-- ────────────────────────────────────────────
CREATE TABLE giftia_t105.preference_tags (
  preference_tag_id   VARCHAR(10) NOT NULL,   -- 例:PT001
  preference_category VARCHAR(20) NOT NULL,   -- 例:味、デザイン
  preference_tag      VARCHAR(50) NOT NULL,   -- 例:甘い、シンプル
  PRIMARY KEY (preference_tag_id),
  UNIQUE KEY uq_preference_tags (preference_category, preference_tag)
);

-- 初期データ(要件定義書 5.2 の例。班で決めた一覧に書き換えてよい)
INSERT INTO giftia_t105.preference_tags
  (preference_tag_id, preference_category, preference_tag)
VALUES
  ('PT001', 'デザイン', 'シンプル'),
  ('PT002', 'デザイン', '奇抜'),
  ('PT003', '味',       '甘い'),
  ('PT004', '味',       '苦い');


-- ────────────────────────────────────────────
-- 手順4:商品と好みタグの紐づけ(商品推薦)
-- 1商品に複数の好みタグを付けられる
-- ※ 手順3のあとに実行する(preference_tags を参照するため)
-- ────────────────────────────────────────────
CREATE TABLE giftia_t105.product_preference (
  product_id        VARCHAR(10) NOT NULL,
  preference_tag_id VARCHAR(10) NOT NULL,
  PRIMARY KEY (product_id, preference_tag_id),
  INDEX idx_product_preference_tag (preference_tag_id),
  CONSTRAINT fk_product_preference_product
    FOREIGN KEY (product_id) REFERENCES giftia_t105.products(product_id),
  CONSTRAINT fk_product_preference_tag
    FOREIGN KEY (preference_tag_id) REFERENCES giftia_t105.preference_tags(preference_tag_id)
);


-- ────────────────────────────────────────────
-- 手順5(任意):口コミのシーンに決まった値しか入らないようにする
-- ────────────────────────────────────────────
ALTER TABLE giftia_t105.reviews
  ADD CONSTRAINT chk_reviews_scene
  CHECK (scene_tag IS NULL OR scene_tag IN
    ('送別', '誕生日', '父の日', '母の日', '結婚祝い', '出産祝い', 'お中元', 'お歳暮', 'お礼'));


-- ────────────────────────────────────────────
-- 手順6:できたか確認する
-- ────────────────────────────────────────────
SHOW TABLES FROM giftia_t105;
DESCRIBE giftia_t105.review_rating;
DESCRIBE giftia_t105.product_targets;
DESCRIBE giftia_t105.preference_tags;
DESCRIBE giftia_t105.product_preference;
