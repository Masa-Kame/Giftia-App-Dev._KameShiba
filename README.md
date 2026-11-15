# Giftia-App-Dev._KameShiba

## チーム開発ルール

開発を始める前に、[チーム共通ルール（AGENTS.md）](./AGENTS.md)を確認してください。
作業対象のディレクトリにAGENTS.mdがある場合は、その内容も確認してください。

## 検索APIのカテゴリー指定

`GET /api/search` は `categories=食品&categories=飲料` の繰り返しクエリで、いずれかのカテゴリーに該当する商品を検索できます。キーワード・価格・在庫条件とはANDで組み合わせます。

- `categories` と `category` がともに未指定・空文字のみの場合は、カテゴリーの絞り込みを行いません。
- 従来の `category=食品` も使用できます。
- 空文字以外の `categories` がある場合は、`category` より優先します。
- 該当件数 `total` は取得上限 `limit` によらず、全該当件数を返します。

検索APIのテストは、リポジトリ直下で次を実行します。FastAPIとhttpxが必要です。環境変数ファイルや実DBは使用せず、SQLiteのインメモリDBで検証します。

```powershell
python -B -m unittest discover -s backend/tests -v
```
