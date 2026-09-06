# 6. RBAC設計

ロールベース。権限は **resource.action** のコードで持ち、画面や「役職名」でハードコードしない。

Organization ごとにロールを追加・権限セットを変更できる。システム定義ロールはシードし、Org が複製してカスタム化してもよい。

## システムロール

| コード | 名前 | 想定ユーザー | 既定の視界 |
|--------|------|----------------|------------|
| `owner` | Owner | 契約者 | 全データ・セキュリティ設定 |
| `executive` | Executive | 経営者 | 全案件の判断・財務。設定の一部は不可 |
| `manager` | Manager | 管理職 | 担当範囲または全社案件の運営（Org設定で切替） |
| `supervisor` | Supervisor | 現場監督 | 担当案件の記録・確認・工程 |
| `worker` | Worker | 現場担当者・職人 | Today と担当現場のみ |
| `office` | Office | 事務 | 顧客・インポート・書類。現場操作は弱く、財務は Org 設定 |
| `partner` | Partner | 協力会社 | 割当案件の現場情報のみ。財務なし |
| `guest` | Guest | 発注者など | 読取中心、最小 |

零細企業の初期: Owner 1 + Worker 複数。Branch もカスタムロールも不要。

## 権限カタログ（抜粋）

| コード | 意味 |
|--------|------|
| `org.manage` | 会社設定、Branch/Dept（任意機能） |
| `org.security` | セキュリティ設定 |
| `member.manage` | 招待・ロール変更 |
| `role.manage` | カスタムロール |
| `project.create` / `project.update` / `project.read_all` | 案件 |
| `project.close` | 完工 |
| `finance.read` / `finance.write` | 請負・原価・粗利 |
| `capture.create` / `capture.confirm` | 撮る・話す・確定 |
| `photo.create` | 写真 |
| `knowledge.read` / `knowledge.write` | ノウハウ |
| `signal.read_management` | 経営向け注意 |
| `signal.feedback` | 採用/却下 |
| `import.manage` | 乗り換え |
| `audit.read` | 監査 |
| `catalog.manage` | 工種・材料マスタ |

未定義の権限は拒否（fail closed）。

## 既定マトリクス

R = 読取、W = 作成/更新、— = なし、S = スコープ内（割当案件）のみ。

| 権限 | Owner | Exec | Mgr | Sup | Worker | Office | Partner | Guest |
|------|:-----:|:----:|:---:|:---:|:------:|:------:|:-------:|:-----:|
| org.manage | W | — | — | — | — | — | — | — |
| org.security | W | — | — | — | — | — | — | — |
| member.manage | W | R | W* | — | — | W | — | — |
| project.read_all | R | R | R | — | — | R | — | — |
| 案件（スコープ） | W | R | W | W | S | R | S | S(R) |
| finance | W | R | R/W* | — | — | R* | — | — |
| capture.create | W | — | W | W | W | — | W | — |
| capture.confirm | W | — | W | W | W | — | W | — |
| knowledge | W | R | W | W | R | R | — | — |
| signal 現場注意 | R | R | R | R | S | R | S | — |
| signal 経営 | R | R | R | — | — | R* | — | — |
| import | W | — | W | — | — | W | — | — |
| audit | R | R | — | — | — | — | — | — |

\* は `organization_settings` で緩める/締める。Manager を「自 Branch のみ」にもできる。

## カスタムロール

```
roles
  organization_id  NULL = システム定義
  code             owner, site_lead, ...
  is_system        true なら削除不可。権限セットは Org が role_permissions で上書き可
```

例: 「安全担当」= Worker 相当 + `knowledge.write` + 全現場の注意読取。

Owner だけは `org.security` を外せない（ロックアウト防止）。

## 画面シェルとの対応

権限でシェルを選ぶ。ロール名で分岐しすぎない。

| 条件 | ホーム |
|------|--------|
| `capture.create` かつ not `signal.read_management` | 現場 Today |
| `signal.read_management` | Management Today（PC既定）。スマホでは要約 + 現場切替 |
| Partner | 現場 Today（財務なし） |
| Guest | 読取用案件ビュー |

1人が監督かつ管理職の場合はシェルを切り替えられる。ログイン直後は **最後に使ったシェル**、未設定なら現場権限があれば Today（現場を先に使うため）。

## API での強制

`packages/authz` の `assertPermission({ orgId, code, projectId? })` を Server Action の入口で呼ぶ。RLS は最後の網、BFF は最初の網。

## 拡張

- 将来: 属性ベース（ABAC）は `membership_project_access` と Branch スコープで足りる間は導入しない
- SCIM は memberships / roles の外部同期として Phase 3
