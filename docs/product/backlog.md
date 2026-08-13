# 現在の残課題

最終更新: 2026-08-13

この文書は、未解決事項だけを扱う current SSOT です。完了した内容と判断の経緯は [統合台帳の履歴](./backlog-history-2026-08-13.md) と [回ごとの記録](./backlog-session-notes.md) に保存します。

## 運用ルール

- ID は一度付けたら再利用・変更しない。
- 状態は `ready`（着手可能）、`decision`（事業判断待ち）、`observe`（条件成立待ち）、`blocked`（外部要因待ち）のいずれかとする。
- 完了時はこの文書から除き、根拠とともに履歴へ移す。過去の記述をこの文書へ残さない。
- 実装事実はコードまたは正本仕様へリンクし、この文書へ重複転記しない。

## 制度・評価ルール

| ID | 状態 | 現在の論点 | 着手トリガー | 次アクション | 根拠 |
|---|---|---|---|---|---|
| POLICY-001 | decision | 昇格に必要な行動指針点は仮値 | 制度責任者が区間別の値を承認 | `/admin/masters/promotion` で確定値を保存 | [製品仕様](./spec.md) / [旧台帳 A1](./backlog-history-2026-08-13.md) |
| POLICY-002 | decision | 昇格に必要な KPI 点は全区間 100 点の仮値 | 制度責任者が条件を承認 | 区間別の確定値を保存 | [製品仕様](./spec.md) / [旧台帳 A2](./backlog-history-2026-08-13.md) |
| POLICY-003 | decision | A〜E の換算比率と半期の分布基準が仮値 | 初回半期データのレビュー | 分布を確認し制度値を承認または修正 | [旧台帳 A4・C4](./backlog-history-2026-08-13.md) |
| POLICY-004 | decision | 等級別昇給額・賞与配分は仮値 | 制度責任者が金額を承認 | `/admin/raises` で確定し計算結果を再確認 | [旧台帳 A5・C2](./backlog-history-2026-08-13.md) |
| POLICY-005 | decision | 事業所 KGI 達成係数は仮値 | 制度責任者が係数を承認 | `/admin/kgi` で確定値を保存 | [旧台帳 A6](./backlog-history-2026-08-13.md) |
| POLICY-006 | decision | 「新規（素案）」由来の KPI 項目が仮置き | 制度責任者が各項目を査定 | 項目を承認・修正し仮表示を外す | [旧台帳 A7](./backlog-history-2026-08-13.md) |
| POLICY-007 | decision | 等級別の半期目標上限 `targetCap` が仮値 | 運用責任者が上限を承認 | 等級マスタで確定値を保存 | [旧台帳 A9](./backlog-history-2026-08-13.md) |
| POLICY-008 | decision | AM I・II に行動指針を出す現行方針が暫定 | 元資料の不一致を制度責任者が裁定 | `/admin/behavior` の会社別設定を確定 | [旧台帳 A10](./backlog-history-2026-08-13.md) |
| POLICY-009 | observe | KPI ランクは A〜E の 5 段固定 | 5 段以外を必要とする会社が現れる | 配点・集計を含めた可変段数の仕様を決める | [回ごとの記録 G2](./backlog-session-notes.md) |
| POLICY-010 | decision | 等級別に異なる KPI ランク基準を持つか未決定 | 制度責任者が必要性を判断 | データモデル・画面・計算影響を仕様化 | [旧台帳 UX83](./backlog-history-2026-08-13.md) |

## 機能

| ID | 状態 | 現在の論点 | 着手トリガー | 次アクション | 根拠 |
|---|---|---|---|---|---|
| FEATURE-001 | ready | ログイン不要の閲覧専用フォーム URL がない | 公開閲覧の要件を優先 | トークン・期限・公開範囲を決めて実装 | [旧台帳 B1](./backlog-history-2026-08-13.md) |
| FEATURE-002 | ready | 設問・回答へのコメント欄がない | 評価者間の補足共有を優先 | 閲覧権限と保持期間を決めて実装 | [旧台帳 B2](./backlog-history-2026-08-13.md) |
| FEATURE-003 | blocked | Google OAuth は未導入 | OAuth の資格情報と運用責任者が揃う | Better Auth 設定・callback・疎通を追加 | [旧台帳 B3](./backlog-history-2026-08-13.md) |
| FEATURE-004 | ready | アンケート設問の並べ替えが上下ボタンだけ | 編集 UX の改善を優先 | キーボード操作を含む DnD を設計 | [旧台帳 B4](./backlog-history-2026-08-13.md) |
| FEATURE-005 | ready | 行動指針セット・項目の並べ替えがない | 並び順運用が頻発 | 並び順の保存契約と操作を実装 | [旧台帳 B5・B6](./backlog-history-2026-08-13.md) |
| FEATURE-006 | ready | 評価結果の PDF・Excel 出力がない | 外部共有・保管要件を優先 | 出力範囲と個人情報の扱いを定義 | [旧台帳 B7](./backlog-history-2026-08-13.md) |
| FEATURE-007 | ready | 未回答者への自動リマインドがない | 通知チャネルと期限運用を確定 | 冪等な送信ジョブと監査ログを実装 | [旧台帳 B8・UX81](./backlog-history-2026-08-13.md) |
| FEATURE-008 | ready | 複数評価者の合議・平均化に未対応 | 360 度評価等の方式を採用 | 評価者構成と集約規則を仕様化 | [旧台帳 B9](./backlog-history-2026-08-13.md) |
| FEATURE-009 | ready | メンバーからマネージャーへの評価がない | 上向き評価を制度採用 | 匿名性・閲覧範囲・集約を仕様化 | [旧台帳 B10](./backlog-history-2026-08-13.md) |
| FEATURE-010 | ready | CSV 取込で未知の等級・事業所を自動作成しない | 大量初期登録を優先 | typo 対策を含む確認フローを設計 | [旧台帳 D2](./backlog-history-2026-08-13.md) |
| FEATURE-011 | ready | 参考ポイント CSV の区分は手動選択 | 異なる区分の一括取込を優先 | 自動判別規則と競合時 UI を設計 | [旧台帳 D3](./backlog-history-2026-08-13.md) |
| FEATURE-012 | ready | 参考ポイント取込の取り消しがない | 誤取込の復旧を優先 | 取込単位の監査 ID と取消処理を追加 | [旧台帳 D4](./backlog-history-2026-08-13.md) |
| FEATURE-013 | ready | 仮の全体評価結果を途中表示できない | 期中レビューを制度採用 | 未評価項目の扱いを定義し表示を追加 | [旧台帳 D7](./backlog-history-2026-08-13.md) |
| FEATURE-014 | ready | 他の CSV 取込に取り消し機能がない | 取消要求が運用上発生 | 取込イベント単位の復旧方式を統一 | [旧台帳 D8](./backlog-history-2026-08-13.md) |
| FEATURE-015 | ready | 下書きはブラウザ保存のみ | 複数端末・長期保存が必要 | サーバー保存の権限・競合・期限を設計 | [旧台帳 D9](./backlog-history-2026-08-13.md) |
| FEATURE-016 | ready | 評価期限の管理画面がない | 会社ごとの期限運用を開始 | 期限設定・表示・通知の契約を統合 | [旧台帳 D10](./backlog-history-2026-08-13.md) |
| FEATURE-018 | ready | 昇給候補は手動登録 | 自動算出を制度責任者が承認 | POLICY-004 確定後に候補算出を実装 | [旧台帳 C6](./backlog-history-2026-08-13.md) |
| FEATURE-019 | ready | 他等級閲覧の絞り込みと状態確認が弱い | 候補探索の利用が増える | 等級・状態フィルターを追加 | [回ごとの記録 F1・F2](./backlog-session-notes.md) |
| FEATURE-020 | observe | アーカイブ済みイベントの UI が限定的 | 一覧・復元要求が発生 | 読み取り専用一覧と復元権限を設計 | [回ごとの記録 V2](./backlog-session-notes.md) |
| FEATURE-021 | observe | 等級の変遷は評価行からしか辿れず、評価のない期の昇格は推移に出ない | 期中昇格の可視化が要求される | 等級履歴を独立して持つか、評価行からの導出のままとするかを決める | [実装](../../src/lib/domain/evaluation-trend.ts) |

## UX・アクセシビリティ

| ID | 状態 | 現在の論点 | 着手トリガー | 次アクション | 根拠 |
|---|---|---|---|---|---|
| UX-001 | ready | 実機スマートフォンで全画面を通した確認がない | リリース候補ごと | 主要 20 画面を実機で確認し結果を記録 | [旧台帳 D5・UX88・UX89](./backlog-history-2026-08-13.md) |
| UX-002 | ready | 見た目の回帰は人手確認に依存 | レイアウト変更が継続 | 代表画面のスクリーンショット比較を CI へ追加 | [旧台帳 D6・UX31・UX66](./backlog-history-2026-08-13.md) |
| UX-003 | ready | メンバー一覧のフィルター状態を保存しない | 再設定の負担が顕在化 | URL またはユーザー設定への保存方式を決める | [旧台帳 UX52](./backlog-history-2026-08-13.md) |
| UX-004 | ready | スマートフォンの評価入力体験を専用最適化していない | モバイル入力を主要経路にする | 実機計測後に入力・固定領域を再設計 | [旧台帳 UX55](./backlog-history-2026-08-13.md) |
| UX-005 | ready | 複数人の一括確定がない | 評価対象数が増える | 誤操作防止と部分失敗の扱いを設計 | [旧台帳 UX56](./backlog-history-2026-08-13.md) |
| UX-006 | observe | ランク基準の最大値を画面に常時表示しない | 上限の誤認が発生 | 入力文脈に最大値を表示 | [旧台帳 UX79](./backlog-history-2026-08-13.md) |
| UX-007 | observe | 一部環境で固定ヘッダーが重なる可能性 | 実機で再現 | safe-area とスクロール領域を修正 | [回ごとの記録 M1](./backlog-session-notes.md) |
| UX-008 | observe | 小さい文字のユーザー別拡大設定がない | 読みづらさの申告 | ブラウザ拡大との役割を整理して設定を追加 | [回ごとの記録 K1](./backlog-session-notes.md) |
| UX-009 | observe | 長いユーザー入力は登録後に省略される | 入力時確認の要望 | 文字数警告と全文確認 UI を追加 | [回ごとの記録 T1](./backlog-session-notes.md) |
| UX-010 | ready | 評価待ち結果の公開予定と問い合わせ先が弱い | 従業員向け案内を整備 | 予定日・回答導線・ホーム表示を一体で設計 | [回ごとの記録 S1〜S3](./backlog-session-notes.md) |
| UX-011 | decision | 昇格不可理由へ上位等級の要件を表示する範囲が未決定 | 情報公開方針を裁定 | 表示文言と権限を確定 | [回ごとの記録 Q2](./backlog-session-notes.md) |
| UX-012 | observe | グラフを含む画面で初回描画時にサーバーとブラウザの内容が一致せず、React が描き直している | 表示のちらつきが申告される | `ssr: false` の遅延読み込みと場所取りの出し方を見直す | [実装](../../src/components/LazyCharts.tsx) |
| UX-013 | observe | 20 年規模では等級変更の縦線が右端に密集し、線同士が重なって本数を数えられない | 長期在籍者の実データで読みにくさが出る | 密集時の間引き規則、または等級区間の一覧表示への切り替えを設計 | [実装](../../src/components/Charts.tsx) |
| UX-014 | observe | 641〜1024px でサイドバーをアイコンのみに縮める案を見送った | メニューにアイコン運用を導入する判断が出る | アイコンだけで分類が伝わるかを検証してから縮小幅を決める。現状は 1024px 未満でオフキャンバスに切り替える挙動を維持 | [実装](../../src/components/AppSidebar.tsx) |
| UX-015 | observe | モバイルの下部固定タブバー化を見送り、既存の引き出しメニューを維持した | 主要導線を 5 件以内に絞る合意ができる | 20 画面超のナビゲーション構造を作り直す規模になるため、導線の優先順位を決めてから設計する。今回はセーフエリア対応のみ追加 | [トークン](../../src/app/globals.css) |
| UX-017 | ready | 番号の印を丸で描く箇所が 2 つ残っている（制度設定ガイド・管理ホームの手順）。`StepMark` に寄せていない | 番号の印の大きさを 1 つに決める判断が出る | 制度設定ガイドは 32px、`StepMark` は 26px で、寄せると見た目が変わる。印の大きさを 2 段（カードの頭用・段の中用）にするか 1 つに揃えるかを決めてから統一する | [実装](../../src/app/admin/setup/SetupGuide.tsx) |
| UX-018 | ready | カテゴリ名などの「見出しの代わりの小さな段落」が一覧側に残っている（選べる項目・配点の比較ほか） | 見出しの階層を読み上げまで通す判断が出る | 順番のない分類の見出しに使う器（`StepBlock` ではない）を決めてから、`ui.tsx` に 1 つ足して寄せる | [仕様 §5-6](./spec.md) |
| UX-019 | ready | ランク A〜E を色で見分けられない（`RankMark` は A だけ塗り、B〜E は同じ灰色） | 良い順を一目で読みたい要望が出る | 色相を増やさない方針（[仕様 §5-6](./spec.md)）を保つため、濃淡だけで 5 段を作れるか、または割合の棒を印の横に添えるかを検証してから決める | [実装](../../src/components/ui.tsx) |
| UX-020 | observe | 検索で出す人は上位 8 件までで、9 件目以降へ進む導線が無い | 同じ姓の社員が多い会社で「出てこない」と申告される | 窓の最下段に「この語で一覧を絞る」導線を足すか、会社・等級で絞る欄を足すかを決める。名簿を丸ごと返す方向には広げない | [仕様 §25-3](./spec.md) / [実装](../../src/app/api/search/route.ts) |
| UX-021 | observe | 検索で探せるのは画面と人だけ。等級・評価期間・KPI 項目・設問は対象外 | 「項目名で探したい」要望が出る | 単体で開ける URL を持たない候補は出さない方針（[仕様 §25-3](./spec.md)）を保つため、まず該当画面へ絞り込み付きで開く URL を作るかを決める | [実装](../../src/lib/domain/search.ts) |

## セキュリティ・信頼性

| ID | 状態 | 現在の論点 | 着手トリガー | 次アクション | 根拠 |
|---|---|---|---|---|---|
| SECURITY-001 | ready | アカウント設定と会社管理 API の重点監査が残る | 次のセキュリティ確認 | 認可・CSRF・漏えいをテスト付きで監査 | [回ごとの記録 E7・V3](./backlog-session-notes.md) |
| SECURITY-002 | ready | ログインのレート制限が isolate 内メモリに依存 | 本番の分散防御を強化 | Durable Object または KV 等の共有方式を選定 | [旧台帳 UX95](./backlog-history-2026-08-13.md) |
| SECURITY-003 | observe | ログイン以外の操作別レート制限は暫定値 | 429 率または負荷の実測が得られる | 操作別に閾値を調整 | [旧台帳 UX97](./backlog-history-2026-08-13.md) |
| SECURITY-004 | ready | 2 段階認証がない | 認証強化を優先 | 対象ロール・復旧手段を含めて導入 | [旧台帳 UX35](./backlog-history-2026-08-13.md) |
| SECURITY-005 | ready | 仮パスワードに期限がない | 招待運用を本格化 | 発行・期限・失効・再発行を実装 | [旧台帳 UX36](./backlog-history-2026-08-13.md) |
| SECURITY-006 | decision | 管理者が回答下書きを見られる範囲が未定 | プライバシー方針を裁定 | 権限表と監査ログ要件を確定 | [旧台帳 UX43](./backlog-history-2026-08-13.md) |
| SECURITY-007 | decision | ロールは 4 種固定 | 権限分離の追加要件が出る | ロール追加ではなく権限集合として再設計 | [旧台帳 UX98](./backlog-history-2026-08-13.md) |
| SECURITY-008 | ready | 依存関係監査の moderate 指摘が残る | 互換性を確認できる更新窓 | 影響を確認して依存を更新 | [旧台帳 UX87](./backlog-history-2026-08-13.md) |
| SECURITY-009 | ready | CSP は nonce 方式ではない | inline script をさらに制限 | Next.js・OpenNext の制約を確認して nonce 化 | [旧台帳 UX99](./backlog-history-2026-08-13.md) |
| RELIABILITY-001 | ready | Route Handler の統合テストが薄い | API 変更前 | 認証・DB を含む代表経路を追加 | [回ごとの記録 H4・J4](./backlog-session-notes.md) |
| RELIABILITY-002 | observe | 安全側の代替表示が発生しても運用で気づきにくい | 発生率を観測可能にする | 構造化ログ・通知閾値を追加 | [回ごとの記録 Q4](./backlog-session-notes.md) |
| RELIABILITY-003 | ready | 制度マスタ本体の更新と監査記録が同じ原子的保存単位ではない | 完全な監査証跡を要件化 | 全更新 command と監査 INSERT を同じ D1 batch に統合し、実体内の順序をDB制約で保証 | [システム仕様](../../system-spec/master-settings.md) / [実装](../../src/lib/domain/constitution-events.ts) |
| RELIABILITY-004 | ready | 昇格制約の翻訳ロジックが画面に近い | 次の条件追加前 | ドメイン関数へ移し境界値テストを追加 | [回ごとの記録 U3](./backlog-session-notes.md) |

## 運用・性能・規模

| ID | 状態 | 現在の論点 | 着手トリガー | 次アクション | 根拠 |
|---|---|---|---|---|---|
| OPS-001 | ready | マイグレーション後の認証付きスモークが手動 | 次のスキーマ変更 | 再利用可能なスモーク手順を整備 | [回ごとの記録 E8](./backlog-session-notes.md) / [デプロイ注意](../deploy-notes.md) |
| OPS-003 | observe | サンプル会社は本番運用開始時に削除が必要 | 実会社データの利用開始前 | 専用コマンドで削除し結果を記録 | [製品仕様](./spec.md) / [package scripts](../../package.json) |
| OPS-004 | observe | KPI ランク境界・係数は初回半期後の再調整候補 | 初回半期が終了 | 実分布と端数影響を確認して制度値を見直す | [回ごとの記録 N2・S4](./backlog-session-notes.md) |
| OPS-005 | ready | サーバー描画でクライアント API 混入を検出する専用 CI がない | 同種の回帰を予防 | 静的スキャナーを CI に追加 | [回ごとの記録 T3](./backlog-session-notes.md) |
| PERFORMANCE-001 | observe | 一覧は数百件超でページングが必要 | 対象データが数百件に達する | cursor または keyset 方式を導入 | [旧台帳 D1](./backlog-history-2026-08-13.md) |
| PERFORMANCE-002 | observe | マスタ参照は都度 D1 を読む | 読取負荷・待ち時間が問題化 | キャッシュ範囲と無効化を設計 | [旧台帳 D11](./backlog-history-2026-08-13.md) |
| PERFORMANCE-003 | ready | 本番端末・回線で Core Web Vitals を計測していない | 次の性能確認 | 主要画面を実測し基準超過だけ改善 | [旧台帳 UX101](./backlog-history-2026-08-13.md) |
| SCALE-001 | observe | 管理画面の件数取得は会社数増加時に要確認 | 20 社または高負荷を観測 | クエリ計画を測り必要箇所だけ集約化 | [回ごとの記録 N4・N6](./backlog-session-notes.md) |
| SCALE-002 | decision | フォーム数・KPI 項目数の上限が未定義 | 複数フォーム運用を制度化 | ドメイン上限と超過時の案内を決める | [回ごとの記録 R2・R4](./backlog-session-notes.md) |
| SCALE-003 | observe | ブラウザ下書きの容量上限を実測していない | 大規模フォームを導入 | 想定最大データで容量・復元を検証 | [回ごとの記録 R1](./backlog-session-notes.md) |
