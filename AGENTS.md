<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Giftia チーム開発ルール

## 適用範囲

- このルールはリポジトリ全体に適用する。
- 各ディレクトリのAGENTS.mdも確認し、その配下に固有の指示がある場合は併せて従う。
- 既存のNext.js自動生成ルールを保持する。

## 開発フロー

GitHub Flowを採用する。基本の流れは次のとおり。

1. 最新のデフォルトブランチから作業ブランチを作成する。
2. 目的に沿った変更と動作確認を行い、コミットしてpushする。
3. デフォルトブランチを取り込み先とするPull Request（PR）を作成する。
4. レビューへの対応と必要な確認を完了する。
5. 承認後にマージし、使用済みの作業ブランチを削除する。

Gitの操作は原則SourceTreeを使用し、PR作成・レビュー・マージはGitHub上で行う。

## ブランチとコミット

- デフォルトブランチへの直接pushは行わず、PRを経由する。
- ブランチ名は目的が分かる英小文字とハイフンを用いる。
  - feature/<内容>：機能追加
  - fix/<内容>：不具合修正
  - docs/<内容>：ドキュメント更新
  - refactor/<内容>：リファクタリング
  - chore/<内容>：設定や開発環境の整備
- 1つのPRでは1つの目的を扱い、無関係な修正や整形を混在させない。
- コミットは意味のある単位に分け、メッセージに変更内容を記載する。
- AIが生成・変更したコードは、担当者が内容と差分を確認し、理解してからcommitする。
- 他のメンバーの作業や未コミットの変更を、無断で上書き・破棄しない。
- 共有ブランチの履歴を書き換える場合は、利用者と事前に合意する。

## Pull Requestとレビュー

- PRには次の内容を記載する。
  - 変更の目的と概要
  - 関連Issue（存在する場合）
  - 影響範囲
  - 確認した内容と結果
  - 未確認事項や注意点
- UI変更では、必要に応じてスクリーンショットを添付する。
- 作業途中の相談にはDraft PRを利用する。
- 暫定的なチームルールとして、マージには作成者以外のメンバー1名以上の承認を必要とする。
- レビューの修正依頼には、修正または理由の説明で対応する。
- 承認後に動作へ影響する変更を加えた場合は、再レビューを依頼する。

## 検証とマージ

- 変更範囲に応じてlint、build、テスト、手動確認を行う。
- frontendのコード変更では、frontendディレクトリで以下を実行する。
  - npm run lint
  - npm run build
- ドキュメントのみの変更では、内容とリンクを確認する。
- 実行できなかった確認や既存の失敗は、理由と影響をPRに記載する。
- 必須CIが設定されている場合は、その成功をマージ条件とする。
- 必要な承認、検証、レビュー対応が完了し、競合が解消されていることを確認してからマージする。
- マージ後は作業ブランチを削除し、次の作業は最新のデフォルトブランチから開始する。

## 変更時の注意

- 秘密情報、認証情報、個人情報をコミットしない。
- 仕様、設定、開発手順を変更した場合は、関連ドキュメントも更新する。
- AIエージェントもこのルールに従い、依頼された範囲で作業する。
