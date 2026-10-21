# CSV一括取込と運用readiness

## CSV一括取込

- 回答/社員CSVは全行を事前検証する。1行でも不正ならHTTP 409で全件を保存しない。
- 回答CSVは同一form ID×CSV本文のdry-run署名tokenを本取込の前提とする。
- 全業務変更と`import_batches`の対象ID・変更前snapshot・SHA-256・actorは1つのD1 batchへ入れる。任意statement失敗は全件rollbackする。
- 1.5MBのsnapshotまたは500 statementを超える入力は413で止め、transactionを分割して部分commitしない。
- 社員CSVで新しく作る人は、`users` の行と所属の行（`company_memberships`。会社ごとの値の正本、D-004 ②）を同じ batch で書く。権限の記録（`account_security_events`、入口 `member_import`、`operation_id` は `import_batches.id`）も同じ batch に入れ、dry-run では書かない。直す前に所属の行を持たずに作られた人は、移行 0036 が取り込みの記録から足す（冪等）。

## readiness

- `computeGroupProgress`を全等級区分へ適用し、全区分のKPI件数/100点/基準設定が完了したときだけ評価セットをreadyとする。
- 評価期間作成・アンケート作成にはreadyな評価セットが必要。
- 評価期間openにはreadyな評価セットと1件以上の公開中アンケートが必要。
- アンケート公開にはreadyな評価セット、planning/openの評価期間、1問以上の設問が必要。
- setup、dashboard、管理画面、APIは`setup-readiness.ts` / `scheme-readiness.ts`の同じ結果を使う。
- 評価期間に使う評価セットは `src/lib/domain/scheme-resolution.ts` の `resolveSchemeForCycle` だけが決める。順は、期間に付いた評価セット → 会社の使用中の評価セット → 無し（先頭の行で代えない）。公開・受付開始の判定と設問の古さの判定は `src/lib/cycle-scheme.ts`（`schemeIdForCycle` / `schemeIdsForCycles`）を通して同じ答えを受け、アンケートの作成（`form-build.ts`）と点数の計算（`evaluate.ts`）も同じ関数を呼ぶ。評価レポートは評価に保存した値を読み、評価セットを選び直さない（[DD-024](../docs/product/design-decisions.md)）。
