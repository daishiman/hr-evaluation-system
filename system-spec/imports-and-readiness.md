# CSV一括取込と運用readiness

## CSV一括取込

- 回答/社員CSVは全行を事前検証する。1行でも不正ならHTTP 409で全件を保存しない。
- 回答CSVは同一form ID×CSV本文のdry-run署名tokenを本取込の前提とする。
- 全業務変更と`import_batches`の対象ID・変更前snapshot・SHA-256・actorは1つのD1 batchへ入れる。任意statement失敗は全件rollbackする。
- 1.5MBのsnapshotまたは500 statementを超える入力は413で止め、transactionを分割して部分commitしない。

## readiness

- `computeGroupProgress`を全等級区分へ適用し、全区分のKPI件数/100点/基準設定が完了したときだけ評価セットをreadyとする。
- 評価期間作成・アンケート作成にはreadyな評価セットが必要。
- 評価期間openにはreadyな評価セットと1件以上の公開中アンケートが必要。
- アンケート公開にはreadyな評価セット、planning/openの評価期間、1問以上の設問が必要。
- setup、dashboard、管理画面、APIは`setup-readiness.ts` / `scheme-readiness.ts`の同じ結果を使う。
