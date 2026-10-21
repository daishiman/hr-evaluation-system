import { describe, expect, it } from "vitest";
import {
  contentEditRefusal,
  formTransitions,
  isPastDeadline,
  operationRefusal,
  statusChangeRefusal,
  type FormDeadline,
  type FormStatus,
  type FormTransitions,
} from "./form-transitions";

/**
 * アンケートの状態ごとに許す操作（qa-y10-y16 の16）。
 *
 * 画面のボタンと API の受け付けが同じ答えを使うので、ここで全部の組（状態 × 締切の前後 × 回答の有無）を固定する。
 * 締切は「その日いっぱい」（form-deadline.ts と同じ）。日本時間で日付を読む。
 */

const CLOSES = "2026-09-30";
/** 日本時間 9/30 23:59（締切日の当日。まだ締切前） */
const BEFORE: FormDeadline = { closesAt: CLOSES, now: new Date("2026-09-30T14:59:00Z") };
/** 日本時間 10/1 00:00（締切日の翌日） */
const AFTER: FormDeadline = { closesAt: CLOSES, now: new Date("2026-09-30T15:00:00Z") };

const OPS: (keyof FormTransitions)[] = ["publish", "close", "extend", "remind", "share", "editPeriod", "editContent", "newVersion"];

/** 許す操作の名前だけを並べる（読みやすさのため） */
const allowedOf = (t: FormTransitions) => OPS.filter((op) => t[op]);

describe("formTransitions 状態 × 締切の前後 × 回答の有無", () => {
  it.each([
    // 下書き：公開と回答期間はいつでも。内容は回答が無いときだけ直せ、回答があれば新しい版を作る
    { state: "draft", deadline: "前", responses: false, allowed: ["publish", "editPeriod", "editContent"] },
    { state: "draft", deadline: "前", responses: true, allowed: ["publish", "editPeriod", "newVersion"] },
    { state: "draft", deadline: "後", responses: false, allowed: ["publish", "editPeriod", "editContent"] },
    { state: "draft", deadline: "後", responses: true, allowed: ["publish", "editPeriod", "newVersion"] },
    // 公開中：締め切る・延長・配布URL・回答期間・新しい版。催促は締切前だけ（文面に過ぎた期限を書かない）
    { state: "published", deadline: "前", responses: false, allowed: ["close", "extend", "remind", "share", "editPeriod", "newVersion"] },
    { state: "published", deadline: "前", responses: true, allowed: ["close", "extend", "remind", "share", "editPeriod", "newVersion"] },
    { state: "published", deadline: "後", responses: false, allowed: ["close", "extend", "share", "editPeriod", "newVersion"] },
    { state: "published", deadline: "後", responses: true, allowed: ["close", "extend", "share", "editPeriod", "newVersion"] },
    // 締め切り済み：新しい版だけ。公開中に戻す・延長・催促・回答期間の変更は出さない
    { state: "closed", deadline: "前", responses: false, allowed: ["newVersion"] },
    { state: "closed", deadline: "前", responses: true, allowed: ["newVersion"] },
    { state: "closed", deadline: "後", responses: false, allowed: ["newVersion"] },
    { state: "closed", deadline: "後", responses: true, allowed: ["newVersion"] },
  ])("$state・締切$deadline・回答あり=$responses → $allowed", ({ state, deadline, responses, allowed }) => {
    expect(allowedOf(formTransitions(state, deadline === "前" ? BEFORE : AFTER, responses))).toEqual(allowed);
  });

  it("期限が決まっていない公開中は、いつでも催促の文面を出す", () => {
    const t = formTransitions("published", { closesAt: null, now: new Date("2030-01-01T00:00:00Z") }, false);
    expect(t.remind).toBe(true);
  });

  it("評価期間が終了していれば、延長・催促・新しい版を出さない（締め切る・配布URL・回答期間は残す）", () => {
    const closedCycle = { ...BEFORE, cycleStatus: "closed" };
    expect(allowedOf(formTransitions("published", closedCycle, true))).toEqual(["close", "share", "editPeriod"]);
    expect(allowedOf(formTransitions("closed", closedCycle, true))).toEqual([]);
    expect(allowedOf(formTransitions("draft", closedCycle, true))).toEqual(["publish", "editPeriod"]);
    // 受付中・準備中・未指定は、終了していない扱い
    for (const cycleStatus of ["open", "planning", null, undefined]) {
      expect(formTransitions("closed", { ...BEFORE, cycleStatus }, false).newVersion).toBe(true);
    }
  });

  it("知らない状態は何も許さない（fail-closed）", () => {
    expect(allowedOf(formTransitions("archived", BEFORE, false))).toEqual([]);
    expect(allowedOf(formTransitions("", AFTER, true))).toEqual([]);
  });

  it("返す値は呼ぶたびに別のもの（片方を書き換えても、ほかの呼び出しに漏れない）", () => {
    const a = formTransitions("archived", BEFORE, false);
    a.publish = true;
    expect(formTransitions("archived", BEFORE, false).publish).toBe(false);
  });
});

describe("isPastDeadline 締切の当日と翌日", () => {
  it("締切日の当日（日本時間 23:59）はまだ過ぎていない", () => {
    expect(isPastDeadline(BEFORE)).toBe(false);
  });
  it("締切日の翌日（日本時間 0:00）は過ぎている", () => {
    expect(isPastDeadline(AFTER)).toBe(true);
  });
  it("期限なしは過ぎない", () => {
    expect(isPastDeadline({ closesAt: null, now: new Date("2099-01-01T00:00:00Z") })).toBe(false);
  });
});

describe("statusChangeRefusal 状態の変更", () => {
  const refusalOf = (from: string, to: FormStatus) => statusChangeRefusal(from, to, formTransitions(from, BEFORE, false));

  it("通すのは 下書き→公開中 と 公開中→締め切り済み だけ", () => {
    expect(refusalOf("draft", "published")).toBeNull();
    expect(refusalOf("published", "closed")).toBeNull();
  });

  it("締め切り済み→公開中 は断り、新しい版と、締め切らずに延ばす道を案内する", () => {
    const message = refusalOf("closed", "published");
    expect(message).toContain("公開中に戻せません");
    expect(message).toContain("新しい版を作って公開してください");
    expect(message).toContain("締め切らずに回答一覧から本人ごとに期限を延ばします");
  });

  it("下書き→締め切り済み は断る（公開していないものは締め切れない）", () => {
    expect(refusalOf("draft", "closed")).toBe(
      "まだ公開していないアンケートは締め切れません。配らないときは、下書きのまま置いておけます。",
    );
  });

  it("公開済み・締め切り済みから下書きへは戻さない", () => {
    expect(refusalOf("published", "draft")).toContain("公開済みのアンケートは下書きに戻せません");
    expect(refusalOf("closed", "draft")).toContain("締め切ったアンケートは下書きに戻せません");
  });

  it("同じ状態への変更は、すでにその状態だと伝える", () => {
    expect(refusalOf("draft", "draft")).toBe("このアンケートはすでに下書きです。");
    expect(refusalOf("published", "published")).toBe("このアンケートはすでに公開中です。");
    expect(refusalOf("closed", "closed")).toBe("このアンケートはすでに締め切っています。");
  });

  it("断る文は、画面に無い操作（公開中に戻す）を案内しない", () => {
    const states: FormStatus[] = ["draft", "published", "closed"];
    for (const from of states) {
      for (const to of states) {
        expect(refusalOf(from, to) ?? "").not.toContain("公開中に戻してください");
      }
    }
  });

  it("知らない状態からは、どこへも変えない", () => {
    expect(refusalOf("archived", "published")).toContain("このアンケートの状態（archived）では");
    expect(refusalOf("archived", "closed")).toContain("読み込み直してください");
  });

  it("渡された許す操作が断っているのに文の表に行き先が無い組は、読み込み直しを案内して断る（文の表の漏れの受け皿）", () => {
    // 公開中→締め切り済み は文の表に無い（ふつうは通す組）。許す操作が何も無いときに渡されたら、黙って通さない
    const none = formTransitions("archived", BEFORE, false);
    expect(statusChangeRefusal("published", "closed", none)).toContain("このアンケートの状態（published）では");
  });
});

describe("operationRefusal 延長・催促・回答期間", () => {
  it("許す組は null（formTransitions と同じ答え）", () => {
    expect(operationRefusal("extend", "published", AFTER, true)).toBeNull();
    expect(operationRefusal("remind", "published", BEFORE, false)).toBeNull();
    expect(operationRefusal("editPeriod", "draft", AFTER, false)).toBeNull();
    expect(operationRefusal("editPeriod", "published", AFTER, true)).toBeNull();
  });

  it("下書きの延長は、公開してからと伝える", () => {
    expect(operationRefusal("extend", "draft", BEFORE, false)).toBe(
      "このアンケートはまだ公開されていません。公開してから期限を延ばしてください。",
    );
  });

  it("締め切り済みの延長は断り、公開中に戻す案内はしない（新しい版を案内する）", () => {
    const message = operationRefusal("extend", "closed", BEFORE, true) ?? "";
    expect(message).toContain("締め切ったアンケートは期限を延ばせません");
    expect(message).toContain("新しい版を作って公開してください");
    expect(message).not.toContain("公開中に戻");
  });

  it("下書き・締め切り済みでは催促の文面を出さない", () => {
    expect(operationRefusal("remind", "draft", BEFORE, false)).toContain("まだ公開していないため");
    expect(operationRefusal("remind", "closed", BEFORE, true)).toContain("締め切ったため");
  });

  it("公開中で締切を過ぎたら、催促の代わりに延長を案内する", () => {
    expect(operationRefusal("remind", "published", AFTER, false)).toContain("回答期限を過ぎたため");
    expect(operationRefusal("remind", "published", AFTER, false)).toContain("回答期限の延長");
  });

  it("締め切り済みは回答期間を変えられない", () => {
    expect(operationRefusal("editPeriod", "closed", AFTER, false)).toContain("回答期間を変えられません");
  });

  it("評価期間が終了していれば、公開中でも延長・催促を断る", () => {
    const closedCycle = { ...BEFORE, cycleStatus: "closed" };
    expect(operationRefusal("extend", "published", closedCycle, false)).toBe("この評価期間は終了しているため、期限を延ばせません。");
    expect(operationRefusal("remind", "published", closedCycle, false)).toBe("この評価期間は終了しているため、催促の文面は出しません。");
    // 状態で断る組は、状態の文を先に出す
    expect(operationRefusal("extend", "closed", closedCycle, false)).toContain("締め切ったアンケートは期限を延ばせません");
  });

  it("回答期間は、評価期間が終わっても公開中なら直せる（延長・催促とは違い、断らない）", () => {
    const closedCycle = { ...BEFORE, cycleStatus: "closed" };
    expect(operationRefusal("editPeriod", "published", closedCycle, false)).toBeNull();
  });

  it("知らない状態は、どの操作も読み込み直しを案内して断る", () => {
    expect(operationRefusal("extend", "archived", BEFORE, false)).toContain("このアンケートの状態（archived）では");
    expect(operationRefusal("remind", "archived", AFTER, false)).toContain("読み込み直してください");
  });
});


describe("終了した評価期間では、実行できない次の操作へ案内しない", () => {
  const deadline = { ...BEFORE, cycleStatus: "closed" };
  it.each(["extend", "editPeriod"] as const)("締め切り済みの%sで新しい版を勧めない", (operation) => {
    const message = operationRefusal(operation, "closed", deadline, true);
    expect(message).toContain("この評価期間は終了しているため");
    expect(message).not.toContain("新しい版を作って公開してください");
  });
  it.each([
    ["published", "draft"], ["closed", "draft"], ["closed", "published"],
  ] as const)("%s→%sで新しい版・期限延長を勧めない", (from, to) => {
    const message = statusChangeRefusal(from, to, formTransitions(from, deadline, true));
    expect(message).toContain("この評価期間は終了しているため");
    expect(message).not.toContain("新しい版を作って公開してください");
    expect(message).not.toContain("本人ごとに期限を延ばします");
  });
});

describe("contentEditRefusal 内容の変更はeditContentの答えに揃える", () => {
  const operations = ["text", "questions", "rebuild"] as const;
  it.each(operations)("%s: 下書き・回答なしだけ許す", (operation) => {
    for (const status of ["draft", "published", "closed", "unexpected"]) {
      for (const responses of [false, true]) {
        const allowed = formTransitions(status, BEFORE, responses);
        const message = contentEditRefusal(operation, { status, title: " 上期アンケート " }, allowed);
        expect(message === null).toBe(allowed.editContent);
        if (status === "unexpected") expect(message).toContain("読み込み直してください");
        if (status === "published" || status === "closed") expect(message).toContain("「上期アンケート」は");
      }
    }
  });
  it.each([
    ["text", "タイトルと説明文を変更できません"],
    ["questions", "設問を変更できません"],
    ["rebuild", "設問を作り直せません"],
  ] as const)("%s: 回答のある下書きには操作別の理由を返す", (operation, reason) => {
    expect(contentEditRefusal(operation, { status: "draft", title: "" }, formTransitions("draft", BEFORE, true))).toContain(reason);
  });
  it("題名が空ならこのアンケートと呼ぶ", () => {
    expect(contentEditRefusal("text", { status: "published", title: " " }, formTransitions("published", BEFORE, false))).toMatch(/^このアンケートは公開中/);
  });
  it.each(["draft", "published", "closed"])("%s: 評価期間が終了したら新しい版を勧めない", (status) => {
    const allowed = formTransitions(status, { ...BEFORE, cycleStatus: "closed" }, true);
    for (const operation of operations) {
      const message = contentEditRefusal(operation, { status, title: "" }, allowed);
      expect(message).toContain("この評価期間は終了しているため");
      expect(message).not.toContain("新しい版を作ってください");
      expect(message).not.toContain("新しい版を作って公開してください");
    }
  });
});
