# KenSapo 設計ドキュメント

設計の正本です。工程 1〜6 の実装はこの内容に従っています。

| # | 項目 | ドキュメント |
|---|------|----------------|
| 1 | 推奨ディレクトリ構成 | [01-directory-structure.md](./01-directory-structure.md) |
| 2 | システムアーキテクチャ | [02-system-architecture.md](./02-system-architecture.md) |
| 3 | DBテーブル一覧 | [03-database.md](./03-database.md) |
| 4 | ER構造 | [04-er.md](./04-er.md) |
| 5 | RLS設計 | [05-rls.md](./05-rls.md) |
| 6 | RBAC設計 | [06-rbac.md](./06-rbac.md) |
| 7 | MVP機能一覧 | [07-mvp.md](./07-mvp.md) |
| 8 | Phase 2機能 | [08-phase-2.md](./08-phase-2.md) |
| 9 | Phase 3機能 | [09-phase-3.md](./09-phase-3.md) |
| 10 | AI Service Layer設計 | [10-ai-service-layer.md](./10-ai-service-layer.md) |
| 11 | Construction Graph設計 | [11-construction-graph.md](./11-construction-graph.md) |
| 12 | Decision Engine設計 | [12-decision-engine.md](./12-decision-engine.md) |
| 13 | Zero Input UXの画面遷移 | [13-zero-input-ux.md](./13-zero-input-ux.md) |
| 14 | PC/スマートフォン双方の主要画面一覧 | [14-screens.md](./14-screens.md) |
| 15 | ANDPAD/KANNAと正面衝突しない差別化 | [15-differentiation.md](./15-differentiation.md) |

関連:

- [設計上の決定事項](./decisions.md)
- [スキーマ草案 SQL](./schema-draft.sql)

## 判断基準（全フェーズ共通）

新しい入力欄を足す前に、人間が入力する必要があるかを問う。  
新しい画面を足す前に、既存画面で完結できないかを問う。  
チャットを足す前に、質問される前に提示できないかを問う。  
データを保存する前に、将来どの判断に使うかを問う。
