# エレガントさ再検証レポート（2026-08-13）

- プロジェクトID: `elegant-review`
- 対象: `3d43639` を起点とするワークツリー、現行仕様・実装・CI/CD・履歴
- 思考リセット: 既存成果物は削除せず、起点の差分と結論をいったん前提にしないで再読した
- GitHub確認: 開始時のワークツリーはclean、`HEAD = origin/main`、open PRは0件。直近のmerge済みPRは #56（容量実測値の補正）、#55（容量ゲート追加）
- 実行順: 俯瞰 → 3カテゴリ並列分析 → 改善 → 再検証。改善サイクルは1回で全ゲートを通過した

## 30種の思考法と反映結果

| # | 思考法 | 検証で得た論点 | 改善への反映 |
|---:|---|---|---|
| 1 | 批判的思考 | README、台帳、コードコメントの「現在」という主張を実装と照合すると不一致があった | READMEを実体へ合わせ、イベントストアという過大な主張を監査ジャーナルへ修正 |
| 2 | 演繹思考 | 「mainだけを配る」「未適用migrationが0件」「同時作成でも版が一意」という不変条件から必要なgateを導いた | branch gate、D1 parity gate、一意制約限定retryを追加 |
| 3 | 帰納的思考 | 完了履歴と現行課題を同じ台帳へ追記するたび、古い記述が残る傾向が繰り返されていた | current backlogと履歴を分離 |
| 4 | アブダクション | 文書の個別誤記より、寿命の違う情報を同じ場所へ置くことが最もよくdriftを説明した | current / stable spec / history / CI evidenceへ責務分離 |
| 5 | 垂直思考 | release事故の根をたどると、機械的不変条件を説明文と人の実行順へ委ねていた | Deploy自身が同一checkoutを検査し、migration未適用時はfail-closed |
| 6 | 要素分解 | 対象を文書、release、D1保存、版系譜、監査契約へ分解した | 独立変更を並列化し、最後に統合テスト |
| 7 | MECE | currentとhistory、現在版と過去版、準備と書込みの境界に重複・漏れがあった | backlog責務、版分類、フォームbatchをそれぞれ一意にした |
| 8 | 2軸思考 | 影響度×変更リスクで改善候補を比較した | 高影響・低〜中リスクのrelease gate、文書SSOT、版分類、フォーム原子化を優先 |
| 9 | プロセス思考 | CI、migration、deployが同じmainに対して独立し、順序がproseだけだった | test → build → migration parity → deployをDeploy内で強制し、Migrate後も再照会 |
| 10 | メタ思考 | レビューの問題は誤記発見だけでなく、誤記を再生産する管理方法だった | 文書drift検査をCIへ追加 |
| 11 | 抽象化思考 | 文書情報は「現在の仕事・安定仕様・完了履歴・実測証跡」の4寿命に分かれる | 各寿命の正本を分け、可変な容量値はworkflow logへ委譲 |
| 12 | ダブル・ループ思考 | 「完了説明をcurrentへ残す」前提そのものがcurrentを読みにくくしていた | 完了時は内容を失わずhistoryへ移す運用に変更 |
| 13 | ブレインストーミング | Markdown分離、Issues正本化、構造化データ生成などを比較した | 現規模ではMarkdown current + history + 軽量CI gateを採用 |
| 14 | 水平思考 | proseを増やす代わりに、文書をコードのように検査できると考えた | stable ID、状態、必須列、リンク、旧sentinel、見出し番号を検査 |
| 15 | 逆説思考 | 履歴をcurrentから減らす方が、情報を削除せず現在を正確にできる | 旧台帳全文を日付付き履歴へ保存し、currentを未解決63件へ縮約 |
| 16 | 類推思考 | backlog=queue、history=changelog、README=manifest、drift gate=compilerと捉えた | 文書の役割と依存方向を単純化 |
| 17 | if思考 | 同時フォーム作成、CI失敗、migration未適用、別branch手動Deploy、別isolateを仮定した | 原子的batch/retry、同一checkout test、D1 gate、main gateを追加。分散rate limitは課題として保持 |
| 18 | 素人思考 | 初見READMEから、何を入れ、何を実行し、どの文書を読むか分からなかった | 最短setup、品質コマンド、文書地図、本番注意へ再構成 |
| 19 | システム思考 | release、schema、保存、監査、文書が相互に影響する1システムだった | 各境界に機械gateを置き、残る非原子監査を正本から外した |
| 20 | 因果関係分析 | main push → CI/Deploy競走、MAX+1 → 競合、別statement → 監査欠落を確認した | 因果の直前にtest/parity/batch/retryを配置 |
| 21 | 因果ループ | 手順依存 → 失敗 → 手動再実行 → 状態不明 → さらに手順依存、という増幅を確認した | migration適用後の再照会とDeploy前の再照会で状態を観測可能にした |
| 22 | トレードオン思考 | 安全性と速度を二者択一にせず、配布checkoutの自己完結検証なら再現性も上がる | Deployに必要gateを集約。未知のWrangler出力は安全側で停止 |
| 23 | プラスサム思考 | exact checkout、原子的保存、短いcurrentは利用者・開発者・運用者すべての手戻りを減らす | 同じ改善で安全性、説明可能性、保守性を同時に向上 |
| 24 | 価値提案思考 | 人事評価の価値には正しい算出だけでなく、変更理由と配布状態の説明可能性が必要 | 監査契約を正直に定義し、release証拠と履歴を残した |
| 25 | 戦略的思考 | 事故半径が大きいrelease/D1、再発しやすいSSOT、局所重複の順に優先すべきだった | release安全性 → 保存不変条件 → 文書/版SSOTの順で統合 |
| 26 | why思考 | なぜ順序事故が可能かを5回掘ると、「人が守る説明」を「機械が守る不変条件」とみなしていた | 説明だけの順序を実行gateへ昇格 |
| 27 | 改善思考 | 小さく閉じられる再発防止点を抽出した | docs checker、migration parser、domain helper、narrow retryを実装 |
| 28 | 仮説思考 | CI/test失敗、pending migration、同時版採番、複数等級途中失敗を失敗仮説にした | parser fixture、並行integration、全体rollback testで反証可能にした |
| 29 | 論点思考 | 真の論点は機能数でなく、正本と不変条件をどこで強制するかだった | 正本をコード・spec・current backlog・CI evidenceへ明示 |
| 30 | KJ法 | 発見をRelease safety、D1 consistency、Governance/SSOTの3群へ集約した | 3群を独立実装し、最後に全体gateで再結合 |

## 実施した改善

1. 文書をcurrent/historyへ分離し、README・Deploy注意を現行化。stable ID、リンク、重複見出しを検査する `check:docs` をCI/Deployへ追加した。
2. 複数等級のフォームと全設問を1つのD1 batchで保存し、フォーム版の一意制約競合だけを1回再試行するようにした。
3. Deployをmain限定・同一checkoutのcoverage test必須・本番D1未適用0件必須にし、Migrateは適用後に同じDBを再確認するようにした。
4. 現在版の判定を `currentVersionRows` 起点のdomain helperへ統一し、UIの重複ロジックを除いた。
5. `constitution_events` を現在状態の正本ではなく監査ジャーナルと明文化し、原子化前の完全性を仮定しない契約へそろえた。

## 再検証

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | 重複していた製品仕様の章番号を修正し、README・台帳・Deploy注意・監査契約を実装へ一致させた |
| 漏れなし | PASS | 30思考法を本表で追跡し、直さない既知課題も安定ID付きcurrent backlogへ残した |
| 整合性あり | PASS | current/history、版分類、監査の正本、フォーム保存単位を統一した |
| 依存関係整合 | PASS | 同一checkoutのtest、D1 migration parity、原子的フォームbatchを機械的に強制した |

PASSは「既知課題が0件」という意味ではない。未解決の製品判断や、分散rate limit、監査記録の原子化などはcurrent backlogへ明示し、実装済みと誤認しない状態を含めて整合と判定する。

## 検証証跡

- `pnpm run check:docs`: PASS（current backlog 63件）
- `pnpm run typecheck`: PASS
- `pnpm run test:coverage`: 79 files PASS / 1 skip、1375 tests PASS / 1 skip、全指標100%
- `pnpm run cf:dry-run`: PASS
- `pnpm run check:bundle-size`: PASS（圧縮後 2218.0 KiB、上限の72.2%）
- workflow YAML parse、Node構文検査、`git diff --check`: PASS
- 本番D1への接続、migration適用、deployは実行していない

---

## 追加改善の再検証（`daishiman/wt-3`、2026-08-13）

上の全体レビュー後に積み上がったUI改善を、既存成果物を消さず前提だけをリセットして再検証した。30思考法のうち、今回の修正へ直接効いたまとまりは次のとおり。

- 批判的思考・因果関係分析・仮説思考: `top` / `bottom` が常に空配列になる経路を、domain → API 400 → UI失敗まで再現し、位置ではなく同じidの旧 `seq` と比較するよう修正した。
- システム思考・MECE・依存関係分析: 確定後の次候補を会社全体の `id/status` だけで選ばず、本人・確定済み・MANAGER担当外を除く純関数へ集約した。
- 抽象化思考・メタ思考: FormBuilderの配列indexを「表示順」と「編集中の同一性」の二役にしない。画面内の安定キーだけを加え、全面的な永続ID改修には広げなかった。
- 状態遷移・if思考: コピー結果を `idle / copied / manual` の単一状態にし、成功後に失敗したとき成功表示が残る矛盾をなくした。
- 素人思考・価値提案思考: 設問の `＋` を「この下に追加」と明示し、新規行が自由設問で評価集計に使われないこと、連携IDと昇格ゲートを継承しないことを画面と仕様の両方へ書いた。
- 要素分解・トレードオン思考: 社員検索、会社切替エラー、空状態、用語、KPI導線は共通部品と小さな契約テストで固定し、大きな画面構造変更を避けた。

### 追加改善の4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | `draft` の表示は「確認中」、作業件数は「未確定」へ統一。コピー成功/失敗、自由設問/連携設問も同時成立しない状態へ整理した |
| 漏れなし | PASS | 並べ替え4方向、境界、別区分/種類、過去版、重複・非連続 `seq`、grade/promotion保存、schema/editorをtestで追跡した。既存UI改善にも契約・表示テストを追加した |
| 整合性あり | PASS | domain・API・editor・製品仕様・システム仕様のdirection契約が一致し、次候補と設問追加の判断は小さな純関数を正本にした |
| 依存関係整合 | PASS | MANAGERの次候補は有効な直属メンバー取得に依存し、FormBuilderの画面内キーは保存payloadへ混ぜず、版管理は現行版だけに限定した |

### 追加改善の実測

- TDD RED: `top` / `bottom` domain 3件、API保存2件、次候補3件、FormBuilder / CopyReminder / MembersFilter / UX契約が意図どおり失敗。
- GREEN: 全体 84 files / 1407 tests PASS（既存の任意本番検査 1 file / 1 test skip）。coverageは statements / branches / functions / lines の4指標すべて100%。
- `check:docs`、`typecheck`、OpenNext Cloudflare build、bundle size、`git diff --check`: PASS。圧縮後bundleは 2208.1 KiB（上限の71.9%）。
- Workers previewで4ロール・のべ287画面を認証付き描画し、変更対象8導線とMANAGERの管理画面拒否を追加スモークで確認した。
- launch-security: CRITICAL 0 / HIGH 0。依存監査の既知moderate 1件は current backlog `SECURITY-008` に残っている。判定は変更範囲についてGO。
- アプリ内ブラウザはこのセッションで接続先が無く、desktop / 375pxの目視だけはpreview確認者へ引き継ぐ。本番D1、production deploy、main mergeは実行していない。
