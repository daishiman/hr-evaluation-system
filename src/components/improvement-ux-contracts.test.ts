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

  it("鍵の置き場所の名前は1か所で決め、案内する場所すべてが同じものを指す", () => {
    const name = "AGENT_API_KEY";
    expect(read("src/lib/domain/agent-api.ts")).toContain(`AGENT_KEY_NAME = "${name}"`);
    for (const path of ["README.md", "docs/deploy-notes.md", ".dev.vars.example"]) {
      expect(read(path)).toContain(name);
    }
  });

  it("設問の直後追加は位置と自由設問であることを画面上でも明示する", () => {
    const source = read("src/components/FormBuilder.tsx");
    expect(source).toContain("この下に追加");
    expect(source).toContain("この下に自由設問を追加");
    expect(source).toContain("自由設問（評価集計には使いません）");
  });
});

/* ═══════════ 一覧からのまとめ払い出し ═══════════
 *
 * 2026-08-15、依頼者から「一覧表で一覧を送信できるようにしてほしい」という指摘。
 * 1件ずつ詳細を開いて押す作りでは、20件で20往復になっていた。
 * ここで固定するのは、その作り直しで壊れると危ないところだけ。
 */
describe("一覧からまとめて指示文を払い出す", () => {
  it("払い出せるのはシステム全体管理者だけ（画面で隠すだけにしない）", () => {
    // ボタンを隠すのは見た目の話。誰でも直接呼べるので、入口でも役割を確かめる。
    const api = read("src/app/api/improvements/route.ts");
    expect(api).toContain('apiViewer("SUPER_ADMIN")');
    const page = read("src/app/admin/improvements/page.tsx");
    expect(page).toContain('canHandOut={viewer.role === "SUPER_ADMIN"}');
  });

  it("鍵が無ければ、要望の中身は1文字も返さない", () => {
    // ここが崩れると、利用者の生の声と技術情報が誰でも読める形で外に出る。
    const guard = read("src/lib/agent-api.ts");
    const route = read("src/app/api/improvements/route.ts");
    expect(guard).toContain("agentAuth(");
    // 受け取った鍵は、突き合わせる前にハッシュへ変える（生のまま比べる先を作らない）
    expect(guard).toContain("await hashAgentKey(given)");
    // 判定を通す前に何かを返す道を作らない
    expect(route).toContain("const gate = await guardAgentRequest(req);");
    expect(route).toContain("if (gate.denied) return gate.denied;");
    const get = route.slice(route.indexOf("export async function GET"));
    expect(get.indexOf("guardAgentRequest(req)")).toBeLessThan(get.indexOf("agentDocuments("));
    expect(get.indexOf("guardAgentRequest(req)")).toBeLessThan(get.indexOf("agentList("));
  });

  it("回数の数え上げは、鍵を確かめるより先に行う", () => {
    // 後にすると、鍵を当てにくる相手は外れた回を数えられずに何度でも試せる。
    const guard = read("src/lib/agent-api.ts");
    expect(guard.indexOf("consumeRateLimit(")).toBeLessThan(guard.indexOf("agentAuth("));
  });

  it("画面に本物の鍵を描かない（背後から見える・写しに残る）", () => {
    const panel = read("src/components/ImprovementHandoutPanel.tsx");
    const domain = read("src/lib/domain/agent-api.ts");
    expect(panel).not.toContain("AGENT_API_KEY");
    expect(domain).toContain("$${AGENT_KEY_SHELL_VAR}");
  });

  it("まとめて払い出すときも、1件ずつ順番に処理する", () => {
    const table = read("src/components/ImprovementBulkTable.tsx");
    // for ... of の逐次実行。Promise.all で並べて投げない
    expect(table).toContain("for (const id of targets)");
    expect(table).not.toContain("Promise.all");
    // どこまで進んだかが見える
    expect(table).toContain("件目）");
  });

  it("失敗しても、済んだ分は確定し、失敗した行だけやり直せる", () => {
    const table = read("src/components/ImprovementBulkTable.tsx");
    expect(table).toContain("setResults([...collected])");
    expect(table).toContain("send(failed.map((r) => r.id))");
    expect(table).toContain("件をやり直す");
  });

  it("最初は1件も選ばれていない", () => {
    const table = read("src/components/ImprovementBulkTable.tsx");
    expect(table).toContain("useState<ReadonlySet<string>>(new Set())");
    // 選んでいないうちは操作バー自体が出ない（押しても何も起きない、を作らない）
    expect(table).toContain("selectable && selected.size > 0");
  });

  it("行ごとに、払い出すとどうなるかの理由が出る（無言の行を作らない）", () => {
    const table = read("src/components/ImprovementBulkTable.tsx");
    expect(table).toContain("{r.handoutNote}");
    expect(table).toContain("handoutStateLabel");
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

  it("廃棄したものは払い出さない（画面の絞り込みだけに頼らない）", () => {
    expect(read("src/lib/improvement-handout-write.ts")).toContain("if (item.discarded)");
    // API から直に取りにきた分も、問い合わせの段階で外す
    expect(read("src/lib/queries.ts")).toContain("isNull(s.improvementRequests.discardedAt)");
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

/* ═══════════ 受け取り用の鍵を画面から発行する ═══════════
 *
 * 2026-08-15、依頼者から「API の鍵はどこで設定できるのか」という質問。
 * それまで鍵はサーバーの設定にしか置けず、ターミナルを開かないと
 * 使い始められなかった。ここで固定するのは、画面から出せるようにした結果
 * 鍵が余計な場所へ残ってしまう道を作っていないこと。
 */
describe("Claude Code 連携の鍵", () => {
  it("発行できるのはシステム全体管理者だけ（画面でもサーバー側でも確かめる）", () => {
    expect(read("src/app/api/agent-keys/route.ts")).toContain('apiViewer("SUPER_ADMIN")');
    expect(read("src/app/system/agent-keys/page.tsx")).toContain('requireRole("SUPER_ADMIN")');
  });

  it("生の鍵は保存しない（保管場所に入るのはハッシュと先頭数文字だけ）", () => {
    const store = read("src/lib/agent-keys.ts");
    expect(store).toContain("keyHash: await hashAgentKey(raw)");
    expect(store).not.toMatch(/keyRaw|rawKey|key: raw/);
    // 鍵を書き出す道を作らない（ログに出れば、保存していないことの意味がなくなる）
    expect(store).not.toContain("console.");
    expect(read("src/app/api/agent-keys/route.ts")).not.toContain("console.");
  });

  it("突き合わせは、長さで早く抜けない比べ方を通す", () => {
    // 1文字ずつ抜けると、当てにくる側が「どこまで合っているか」を時間で測れる。
    expect(read("src/lib/domain/agent-api.ts")).toContain("keysMatch(");
    expect(read("src/lib/agent-api.ts")).toContain("hashAgentKey(given)");
  });

  it("鍵を出すのは発行の直後だけ。閉じたら出せないことを同じ場所で言う", () => {
    const panel = read("src/components/AgentKeyPanel.tsx");
    expect(panel).toContain("AGENT_KEY_ONCE_NOTICE");
    // 手元に残す道を作らない（残せば、画面を閉じたあとも読めてしまう）
    expect(panel).not.toContain("localStorage");
    expect(panel).not.toContain("sessionStorage");
    // 記録の一覧に生の鍵を渡さない
    expect(read("src/app/system/agent-keys/page.tsx")).not.toContain("issued");
  });

  it("止める操作は、押す前に何が止まるかを出す", () => {
    const panel = read("src/components/AgentKeyPanel.tsx");
    // 止まるのは押した1本だけ。残り何本が動き続けるかを、確認文に入れる。
    expect(panel).toContain("agentKeyRevokeConfirmText(k.name, activeKeys.length - 1)");
    expect(panel).toContain("<ConfirmButton");
  });

  /* 2026-08-15、依頼者から「鍵を1本ずつ配れるようにしてほしい」。
     1本しか持てないと、端末を増やすたびに前の鍵が止まっていた。 */
  it("発行しても他の鍵は止めない（発行のついでに止まる道を作らない）", () => {
    const store = read("src/lib/agent-keys.ts");
    const issue = store.slice(store.indexOf("export async function issueAgentKey"));
    const revoke = issue.indexOf("export async function revokeAgentKey");
    expect(issue.slice(0, revoke)).not.toContain("revokedAt: new Date()");
  });

  it("上限は画面の表示だけに頼らず、入口でも断る", () => {
    const store = read("src/lib/agent-keys.ts");
    expect(store).toContain("if (!canIssueAgentKey(active.length)) throw new HttpError(400, AGENT_KEY_CAP_MESSAGE);");
  });

  it("画面の鍵を全部止めても残る設定値の鍵を、画面から止められる", () => {
    // ここが無いと「止めたはずなのに受け取れる」が起きる（v51 の残課題）。
    expect(read("src/lib/agent-api.ts")).toContain("envKeyEnabled: await envKeyEnabled(db)");
    expect(read("src/lib/domain/agent-api.ts")).toContain("if (!source.envKeyEnabled) return \"\";");
    const panel = read("src/components/AgentKeyPanel.tsx");
    expect(panel).toContain("envKeyToggleLabel(envEnabled)");
    // 完全に消す手順も同じ場所に出す（画面で止めるのは取り消しがきく方の手段）。
    expect(panel).toContain("AGENT_ENV_KEY_DELETE_COMMAND");
  });
});

/* ═══════════ 払い出しの履歴 ═══════════
 *
 * 2026-08-15、依頼者から「何度・いつ・誰が・どの鍵で払い出したかを残してほしい」。
 * それまでは最後の1回分の控えだけで、渡し直しの経緯が読めなかった。
 */
describe("払い出しの履歴", () => {
  it("画面からのコピーと、Claude Code からの取得を区別して積む", () => {
    const write = read("src/lib/improvement-handout-write.ts");
    expect(write).toContain("insert(s.improvementHandoutEvents)");
    expect(write).toContain('via: source.via');
    expect(read("src/app/api/improvements/route.ts")).toContain('{ via: "api", ...caller }');
    expect(write).toContain('{ via: "screen", actorId: viewer.id }');
  });

  it("通算の回数は履歴の行数から数えない（古い分は丸めるため）", () => {
    const write = read("src/lib/improvement-handout-write.ts");
    expect(write).toContain("handoutCount: sql`${s.improvementHandouts.handoutCount} + 1`");
  });

  it("履歴は要望1件ごとに上限を持ち、あふれた古い行を落とす", () => {
    const write = read("src/lib/improvement-handout-write.ts");
    expect(write).toContain("HANDOUT_HISTORY_MAX");
    expect(write).toContain("delete(s.improvementHandoutEvents)");
  });

  it("残っている件数と通算が食い違うことを画面で言う（無言の欠落を作らない）", () => {
    expect(read("src/app/admin/improvements/[id]/page.tsx")).toContain("handoutHistoryNote(");
  });

  it("鍵が無いときの案内から、発行する画面へ辿れる", () => {
    const domain = read("src/lib/domain/agent-api.ts");
    expect(domain).toContain("AGENT_KEY_PAGE_PATH");
    // メニューからも開ける（URLを知っている人だけの画面にしない）
    expect(read("src/lib/nav.ts")).toContain("/system/agent-keys");
  });
});
