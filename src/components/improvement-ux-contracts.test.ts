import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("改善した画面の回復経路と用語", () => {
  it("会社切替はlabel内にブロック要素を入れず、失敗を読み上げる", () => {
    const source = read("src/components/CompanyScopeSwitcher.tsx");
    expect(source).toContain('htmlFor="company-scope"');
    expect(source).toContain('id="company-scope"');
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="assertive"');
    expect(source).not.toMatch(/<label[\s\S]*<select[\s\S]*<div[\s\S]*<\/label>/);
  });

  it("利用者0件の案内は、追加欄の上下位置に依存しない", () => {
    const source = read("src/app/system/users/page.tsx");
    expect(source).toContain('body="別の会社を選ぶか、「新しい利用者を作る」から追加してください。"');
    expect(source).not.toContain("下から追加してください");
  });

  it("評価状態は一覧でも確認中に統一し、未確定は作業件数の表現だけに使う", () => {
    const source = read("src/app/manager/cycles/page.tsx");
    expect(source).toContain("確認中（{drafts.length}件）");
    expect(source).not.toContain("確認待ち（{drafts.length}件）");
  });

  it("利用者追加の入口を一覧より先に置き、空状態はその入口名を案内する", () => {
    const source = read("src/app/system/users/page.tsx");
    expect(source.indexOf("新しい利用者を作る")).toBeLessThan(source.indexOf("会社でしぼる"));
    expect(source).toContain("「新しい利用者を作る」から追加してください");
  });

  it("パスワード変更画面では、全画面バナーと同じ仮パスワード案内を重ねない", () => {
    const source = read("src/app/account/password/page.tsx");
    expect(source).not.toContain("<ReasonNote>");
    expect(source).not.toContain("viewer.mustChangePassword &&");
    expect(source).toContain("<PasswordChangeForm />");
  });

  it("設定が要りますの案内は、取得先を押せる形で出す（外部サイトなので新しいタブ）", () => {
    const source = read("src/components/ImprovementIssueForm.tsx");
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
    // URL は案内の正本（domain/github-setup.ts）だけが持つ。画面へ書き写さない
    expect(source).not.toContain("https://github.com/settings");
  });

  it("トークンの取得先URLは1か所で決め、案内する場所すべてが同じものを指す", () => {
    const url = "https://github.com/settings/personal-access-tokens/new";
    expect(read("src/lib/domain/github-setup.ts")).toContain(url);
    for (const path of ["README.md", "docs/deploy-notes.md", ".dev.vars.example", "wrangler.jsonc"]) {
      expect(read(path)).toContain(url);
    }
  });

  it("設問の直後追加は位置と自由設問であることを画面上でも明示する", () => {
    const source = read("src/components/FormBuilder.tsx");
    expect(source).toContain("この下に追加");
    expect(source).toContain("この下に自由設問を追加");
    expect(source).toContain("自由設問（評価集計には使いません）");
  });
});

/* ═══════════ 一覧からのまとめ送り（記録票） ═══════════
 *
 * 2026-08-15、依頼者から「一覧表で一覧を送信できるようにしてほしい」という指摘。
 * 1件ずつ詳細を開いて押す作りでは、20件で20往復になっていた。
 * ここで固定するのは、その作り直しで壊れると危ないところだけ。
 */
describe("一覧からまとめて記録票へ送る", () => {
  it("送れるのはシステム全体管理者だけ（画面で隠すだけにしない）", () => {
    // ボタンを隠すのは見た目の話。誰でも直接呼べるので、入口でも役割を確かめる。
    const api = read("src/app/api/improvements/route.ts");
    expect(api).toContain('apiViewer("SUPER_ADMIN")');
    const page = read("src/app/admin/improvements/page.tsx");
    expect(page).toContain('canPush={viewer.role === "SUPER_ADMIN"}');
  });

  it("同じ要望に2つ目の記録票を作らない（席を取ってから GitHub を呼ぶ）", () => {
    // 二度押し・同時押しでも重複が生まれないよう、先に行を1つだけ立てる。
    // 画面側の二度押し防止だけに頼らない。
    const sync = read("src/lib/improvement-issue-sync.ts");
    expect(sync).toContain("onConflictDoNothing");
    expect(sync).toContain("issueNumber: 0");
    // すでにある記録票は作り直さず、同じものを書き換える
    expect(sync).toContain("updateGithubIssue");
    expect(sync).toContain("commentOnGithubIssue");
  });

  it("閉じている記録票を、こちらから開き直さない", () => {
    const github = read("src/lib/github-issue.ts");
    const update = github.slice(github.indexOf("export async function updateGithubIssue"));
    expect(update.slice(0, update.indexOf("\n}"))).not.toContain("state:");
  });

  it("まとめて送るときも、1件ずつ順番に送る（受付上限で全部落とさない）", () => {
    const table = read("src/components/ImprovementBulkTable.tsx");
    // for ... of の逐次実行。Promise.all で並べて投げない
    expect(table).toContain("for (const id of targets)");
    expect(table).not.toContain("Promise.all");
    // どこまで進んだかが見える
    expect(table).toContain("件目）");
  });

  it("失敗しても、送れた分は確定し、失敗した行だけ送り直せる", () => {
    const table = read("src/components/ImprovementBulkTable.tsx");
    expect(table).toContain("setResults([...collected])");
    expect(table).toContain("send(failed.map((r) => r.id))");
    expect(table).toContain("件を送り直す");
  });

  it("最初は1件も選ばれていない（外へ出る操作は未選択から始める）", () => {
    const table = read("src/components/ImprovementBulkTable.tsx");
    expect(table).toContain("useState<ReadonlySet<string>>(new Set())");
    // 選んでいないうちは操作バー自体が出ない（押しても何も起きない、を作らない）
    expect(table).toContain("selectable && selected.size > 0");
  });

  it("行ごとに、送るとどうなるかの理由が出る（無言の行を作らない）", () => {
    const table = read("src/components/ImprovementBulkTable.tsx");
    expect(table).toContain("{r.syncNote}");
    expect(table).toContain("issueSyncStateLabel");
  });

});

/* ═══════════ 誤って届いたもの・対応しないものの片付け ═══════════
 *
 * 2026-08-15、依頼者から「誤って作成したものや対応しないもの、廃棄も
 * 管理できるようにしてほしい」という指摘。ここで固定するのは、
 * 消えたら困るもの（履歴・戻せること・権限）だけ。
 */
describe("要望を落とす・戻す", () => {
  it("消すのは見た目だけ。行そのものは残す（物理削除を作らない）", () => {
    const server = read("src/lib/improvement-disposition.ts");
    expect(server).not.toContain("delete(s.improvementRequests)");
    expect(server).toContain("discardedAt: new Date()");
  });

  it("落とす操作は理由なしでは通らない（画面で隠すだけにしない）", () => {
    const server = read("src/lib/improvement-disposition.ts");
    expect(server).toContain("dispositionReasonError(input.action, input.reasonCode, input.reasonNote)");
    expect(server).toContain('throw new HttpError(400, reasonError)');
  });

  it("誰がいつ何をしたかは上書きせず積み上げる", () => {
    const server = read("src/lib/improvement-disposition.ts");
    expect(server).toContain("insert(s.improvementStatusEvents)");
    expect(server).not.toContain("update(s.improvementStatusEvents)");
  });

  it("記録票を閉じるのに失敗しても、アプリ側の判断は残す", () => {
    const server = read("src/lib/improvement-disposition.ts");
    // 先にアプリ側を確定し、GitHub の失敗は理由に書き足すだけにする
    expect(server.indexOf("await addEvent(db, id, {")).toBeLessThan(server.indexOf("closeGithubIssue(settings"));
    expect(server).toContain("} catch (error) {");
  });

  it("閉じるときの理由は not planned にする（直したことにしない）", () => {
    expect(read("src/lib/github-issue.ts")).toContain('state_reason: "not_planned"');
  });

  it("廃棄したものは記録票へ送らない", () => {
    expect(read("src/lib/improvement-issue-sync.ts")).toContain("if (item.discarded)");
  });

  it("落とす・戻すもシステム全体管理者だけ", () => {
    expect(read("src/app/api/improvements/route.ts")).toContain('apiViewer("SUPER_ADMIN")');
    expect(read("src/app/admin/improvements/page.tsx")).toContain("canDispose={canDisposeImprovements(viewer.role)}");
  });

  it("一覧の既定では、終わったもの・廃棄したものを出さない", () => {
    const page = read("src/app/admin/improvements/page.tsx");
    expect(page).toContain('isImprovementView(sp.view) ? sp.view : "active"');
    expect(page).toContain("filterImprovementsByView(all, view)");
  });
});
