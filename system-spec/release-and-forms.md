# 配布・マイグレーション・フォーム作成 — システム仕様

- graph_node_id: `chore-release-safety-and-ssot`
- beads: `hr-0p4`
- 正本（運用）: `docs/deploy-notes.md`
- 実装入口: `.github/workflows/` / `src/lib/form-build.ts` / `src/actions/forms.ts` / `scripts/verify-d1-migrations-list.mjs` / `scripts/check-docs-drift.mjs`

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

1. サーバーアクション `createForms` は対象等級すべてを `buildFormDrafts` に渡す。
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

## 6. 回答の自動保存と提出

1. 自動保存中も入力できるが、同じ画面からの保存は応答・描画完了を待って送信順に実行する。新しい回答と補足を古い下書きが後から上書きしない。
2. 入力変更時に「保存済み」の表示を解除し、最新入力の保存成功時だけ表示する。古い入力の成功や最新入力の保存失敗では表示しない。
3. 提出済み・締切後の表示に切り替わったときと画面離脱時は、予約中・待ち行列の自動保存を止める。送信済みの要求はサーバー側で検証する。
4. 既存回答の画面からの保存は、本人・会社・下書き状態を本文の置換と状態更新の同じD1 batchで確認する。並行する提出が先に済んだ場合は、親も回答本文も変更せず競合409として扱う。読取時点ですでに提出済みなら、従来どおり変更を拒否する。
5. 管理者のCSV取込は意図的な上書きとして区別し、提出済み回答も置換できる。保存の条件を共有するためにこの権限を画面の自動保存へ広げない。
