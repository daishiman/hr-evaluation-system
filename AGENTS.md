# エージェント向けの規約

このファイルが Claude Code（`CLAUDE.md` から読み込み）と Codex の共通の正本です。製品の仕様・使い方・運用は [README](./README.md) の「文書の入口」から辿り、ここには再掲しません。

## AIDD エージェントキット

- キットはユーザー全体（`~/.claude` など）ではなく、このリポジトリの project scope（`.claude/` `.agents/skills/` `.codex/agents/`）に置く。このリポジトリでは project scope が正本。
- 編集元は `aidd-agent-kit/`（スキルは `aidd-agent-kit/skills`）。`.claude/skills` `.agents/skills` `.codex/agents` などは sync が作る管理対象の実配置なので、直接書き換えない。直すときは編集元を直して sync する。
- キット付属の `install-*` / `setup-env-*` はユーザー全体へ入れるためのもの。このリポジトリの反映には使わない。
- キットを差し替えるときは、下の「キット更新時の受け入れ確認」に従う。

## 配色とテーマ（キット規範より優先する）

- 正本は [製品仕様](./docs/product/spec.md) の「テーマ契約（全画面共通）」「配色（テーマの系統）」。キットの `jp-web-design` は既存アプリも平賀配色（ライトのみ）へ移すことを既定にしているが、このアプリは移さない。経緯は [design-decisions.md](./docs/product/design-decisions.md) の DD-003。
- 平賀配色への移行をしない。`migrate-legacy-colors.mjs` の `--apply`、`catalog-default.mjs` の `apply`、`--eligibility=eligible` の指定（plan でも）はどれも使わない。判定の dry-run だけは下の受け入れ確認で使う。平賀配色の値は、既定の系統 `indigo` の明るいほうとして `globals.css` に置いてある。暗い表示と系統の選択・保存は残すので移行ではない（DD-003）。
- 移行を通すために、テーマの契約テスト（`src/components/theme-contract.test.ts`・`src/components/palette-contract.test.ts`・`scripts/aidd-kit-boundary.test.mjs`）や、`docs/product/T2-experience-spec.md` §5・`src/app/globals.css` 冒頭の `brand_color_*` 宣言を書き換えない。
- 文字組み・レイアウト・操作領域・a11y・情報設計は `jp-web-design` に従ってよい（spec.md や DD に別の決めがある箇所はそちらが優先）。
- `report-design-system` 系の見本やレポートに実データ（社員名・評価値など）を入れない。公開リポジトリとしての扱いは README「本番運用とデータの注意」に従う。

## キット更新時の受け入れ確認

1. 新しいキットで `aidd-agent-kit/` を丸ごと置き換える。
2. `bash aidd-agent-kit/sync-project-mac.command`
3. `bash aidd-agent-kit/verify-codex-layout.sh` が全項目 OK。
4. `bash aidd-agent-kit/doctor-codex-layout.sh` が errors=0。WARN はユーザー全体（`~/.agents/skills` `~/.codex` など）に置かれた同名のスキル・エージェントとの重複なので、ここでは消さず 9 で一覧ごと本人に知らせる。
5. `node aidd-agent-kit/skills/jp-web-design/scripts/migrate-legacy-colors.mjs src --json` の `eligibility.status` が `report-only`（`source_theme` は `external-brand`）。判定は終了コードではなく `eligibility.status` で見る（report-only のときも終了コードは 1）。リポジトリ直下ではなく必ず `src` を渡す。直下を渡すと、キット複製内のテスト用 T2 と衝突して別の理由の `report-only` になる。
6. `pnpm test`
7. 削除されたキット内ファイルへの参照が `docs/` `src/` に残っていないか確かめる。消えたパスは、sync が作った直近の backup の manifest と新しい manifest の差分で出る。出たパス（スキル名・ファイル名）で `grep -rn <パス> docs src` し、0件にする。

   ```bash
   old="$(ls -d .claude/backup-* | tail -1)/aidd-agent-kit.manifest"
   comm -23 <(cut -d'|' -f2 "$old" | sort -u) <(cut -d'|' -f2 .claude/aidd-agent-kit.manifest | sort -u)
   ```

8. キットの差し替えは単独コミットにする。`aidd-agent-kit/` と実配置に加え、同梱のライセンス文書（`aidd-agent-kit/` の `LICENSE` `NOTICE` `ATTRIBUTION.md` と、`.claude/` `.agents/skills/` `.codex/` に置かれる `aidd-agent-kit.LICENSE` などの写し）も含める。
9. ユーザー全体に古いキットが入っていないか確かめる。`~/.claude/aidd-agent-kit.version`・`~/.codex/aidd-agent-kit.version` があればユーザー全体にも入っている（4 の doctor は Codex 側しか見ない）。`aidd-agent-kit/VERSION` と比べて古ければ、4 の WARN 一覧と合わせて本人に知らせる。ユーザー全体のファイルは勝手に消さない。
10. 7 を済ませてから、sync が作った古い backup（`.claude/backup-*` `.codex/backup-*`。git 管理外）を削除する。

## 改善要望の扱い

- 一覧は [.claude/commands/improvements.md](./.claude/commands/improvements.md)、1件の取り込みは [.claude/commands/improve-request.md](./.claude/commands/improve-request.md) が正本。どちらもこのリポジトリ固有のファイルで、キットの管理対象ではない。
- Codex からも同じ手順ファイルを読んで従う。実装は `$improve-app`（Claude Code では `/improve-app`）に委ねる。
