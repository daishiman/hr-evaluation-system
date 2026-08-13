# 配布・マイグレーション・フォーム作成 — システム仕様

- graph_node_id: `chore-release-safety-and-ssot`
- beads: `hr-0p4`
- 正本（運用）: `docs/deploy-notes.md`
- 実装入口: `.github/workflows/` / `src/lib/form-build.ts` / `src/app/api/forms/route.ts` / `scripts/verify-d1-migrations-list.mjs` / `scripts/check-docs-drift.mjs`

## 1. 本番配布の不変条件

1. Deploy workflow は `refs/heads/main` 以外で開始されたら即失敗する。
2. 配布対象は GitHub Actions のクリーン checkout であり、ローカル作業ツリーを直接配らない。
3. 配布前に同じ checkout で少なくとも次を成功させる。
   - `check:docs`
   - Cloudflare 型生成
   - `typecheck`
   - `test:coverage`
   - `cf:dry-run`（build）
   - `check:bundle-size`
   - 本番 D1 のmigration自動適用後、`migrations list` が「未適用0件」
4. D1 list の判定は `scripts/verify-d1-migrations-list.mjs` が行う。未知出力・認証失敗・矛盾出力はclearとみなさず、適用・配布を止める。

## 2. マイグレーションの不変条件

1. Deploy workflow は検査・テスト・ビルド・容量確認がすべて成功した後に、本番D1の未適用状態を照会する。
2. 未適用がある場合だけバックアップを取得し、取得に失敗したら適用しない。
3. migrationを自動適用した後に同じ本番DBを再照会し、未適用0件を確認する。
4. 順序は「検査・ビルド → バックアップ → migration → parity確認 → deploy」で固定する。
5. 手動Migrate workflowは復旧・先行適用用とし、常に`main`をcheckoutして`APPLY`確認を要求する。
6. Deployと手動Migrateは同じconcurrency groupを使い、本番D1変更と配布を同時実行しない。

## 3. 複数等級フォーム作成

1. `POST /api/forms` は対象等級すべてを `buildFormDrafts` に渡す。
2. 各等級のフォーム本体と設問 INSERT は、1つの D1 `batch` にまとめて実行する。
3. 準備段階（等級不存在など）で1件でも失敗したら、いずれの等級も書き込まない。
4. 実行時にフォーム版の一意制約（`uq_forms_cycle_grade_ver` / `forms.cycle_id,grade_id,version`）だけを再試行対象とし、最大2試行。
5. それ以外のエラーは再試行せず呼び出し元へ返す。再試行尽きた版競合は `409`。

## 4. 文書 drift

1. current backlog は未解決事項のみ。完了表現や取消線を置かない。
2. 安定 ID は一意で、状態は `ready` / `decision` / `observe` / `blocked` のいずれか。
3. `pnpm run check:docs` が必須文書の存在、README の旧説明、current の完了混在、リンク切れを検査する。

## 5. フォーム設問の直後追加

1. 行内の `＋` はその設問の直後へ、同じまとまり・同じ回答方法の自由設問を1件追加し、追加した設問の編集欄を開く。
2. 直前の設問が等級要件・昇格要件・行動指針・KPIと連携していても、連携ID、連携表示名、昇格ゲートを新規設問へ継承しない。
3. React の配列indexを編集対象やkeyの正本にしない。前方追加後も、すでに開いている既存設問と追加した設問を取り違えない安定キーを使う。
4. 自由設問は評価集計へ使わないことを編集欄に明記する。保存APIへは画面内だけの安定キーを送らない。
