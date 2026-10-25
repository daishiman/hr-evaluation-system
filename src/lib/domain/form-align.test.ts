import { describe, expect, it } from "vitest";
import {
  alignDirection,
  alignPlanKey,
  alignPreviewMessage,
  alignResultMessage,
  matchToSettings,
  unmatchedQuestionReason,
  type AlignKeyEntry,
  type AlignQuestion,
} from "./form-align";

/**
 * 設定とずれた下書きをまとめてそろえるときの判定（DD-028 の6）。
 *
 * 向きを取り違えると、後から直した方が古い方で上書きされて消える。
 * 対応の取り方を誤ると、設定の文の直しが別の項目に写るか、使っている項目が外れる。
 */

const free = (id: string, title: string) => ({ id, title, section: "自由記述", questionType: "text" });
const guideline = (title: string, id = "g1") => ({ behaviorGuidelineId: id, title, section: "行動指針", questionType: "scale" });
const kpi = (title: string, key: string) => ({ kpiItemId: "k1", kpiQuestionKey: key, title, section: "KPI", questionType: "number" });

describe("alignDirection（どちらを正にするか）", () => {
  it("設定の方が新しければ、下書きを作り直す", () => {
    expect(alignDirection({ settingsAt: 20, questionsAt: 10, questionCount: 3 })).toBe("toForm");
  });

  it("下書きの方が新しければ、下書きの直しを設定へ写す", () => {
    expect(alignDirection({ settingsAt: 10, questionsAt: 20, questionCount: 3 })).toBe("toSettings");
  });

  it("同じ時刻は、設定を変えない側（作り直す）に倒す", () => {
    expect(alignDirection({ settingsAt: 10, questionsAt: 10, questionCount: 3 })).toBe("toForm");
  });

  it("設問が0問の下書きは、新しくても作り直す（写すと設定の項目がすべて外れる）", () => {
    expect(alignDirection({ settingsAt: 10, questionsAt: 20, questionCount: 0 })).toBe("toForm");
  });
});

describe("matchToSettings（下書きを設定へ写す形に組み直す）", () => {
  it("紐づけが同じ設問どうしを対応させ、保存済みの側は下書きの id と設定の文になる", () => {
    const current = [{ id: "q1", ...guideline("挑戦する姿勢") }];
    const rebuilt: AlignQuestion[] = [guideline("挑戦")];
    const match = matchToSettings(current, rebuilt);
    expect(match).toEqual({
      ok: true,
      submitted: [
        {
          id: "q1",
          title: "挑戦する姿勢",
          section: "行動指針",
          questionType: "scale",
          gradeRequirementId: null,
          promotionRequirementId: null,
          behaviorGuidelineId: "g1",
          kpiItemId: null,
          kpiQuestionKey: null,
          isGate: false,
        },
      ],
      ids: ["keep"],
      stored: [expect.objectContaining({ id: "q1", title: "挑戦", behaviorGuidelineId: "g1" })],
    });
  });

  it("紐づかない設問は、下書きの文のまま保存済みの側にも置く（設定へは何も写らない）", () => {
    const match = matchToSettings([free("q9", "自由にお書きください")], []);
    expect(match).toMatchObject({ ok: true, ids: ["keep"], stored: [{ id: "q9", title: "自由にお書きください" }] });
  });

  it("下書きに無い設定の設問は、保存済みの側に残り、外しになる", () => {
    const match = matchToSettings([{ id: "q1", ...guideline("挑戦") }], [guideline("挑戦"), guideline("協調", "g2")]);
    expect(match.ok && match.stored.map((q) => [q.id, q.behaviorGuidelineId])).toEqual([
      ["q1", "g1"],
      ["align:1", "g2"],
    ]);
  });

  it("同じ紐づけの設問が2つあれば、1対1で順に対応させる", () => {
    const current = [
      { id: "q1", ...kpi("件数を何件？", "count") },
      { id: "q2", ...kpi("件数を何件？（再）", "count") },
    ];
    const both = matchToSettings(current, [kpi("件数", "count"), kpi("件数", "count")]);
    expect(both.ok && both.stored.map((q) => q.id)).toEqual(["q1", "q2"]);

    const one = matchToSettings(current, [kpi("件数", "count")]);
    expect(one).toEqual({ ok: false, title: "件数を何件？（再）" });
  });

  it("紐づけの違う設問とは対応させず、対応の無い紐づいた設問で断る", () => {
    const current = [{ id: "q1", ...kpi("件数", "count") }];
    expect(matchToSettings(current, [kpi("件数", "amount")])).toEqual({ ok: false, title: "件数" });
  });

  it("昇格の必須要件の印だけの設問も、紐づいた設問として扱う（null と省略は同じ）", () => {
    const gate = { id: "q1", title: "必須", section: "昇格", questionType: "yesno", isGate: true, kpiItemId: undefined };
    expect(matchToSettings([gate], [{ title: "必須", section: "昇格", questionType: "yesno", isGate: true, kpiItemId: null }]))
      .toMatchObject({ ok: true, stored: [{ id: "q1", isGate: true }] });
    expect(matchToSettings([gate], [])).toEqual({ ok: false, title: "必須" });
  });
});

describe("unmatchedQuestionReason", () => {
  it("設問の文を名指し、直し方を示す。結果の文の括弧に入れるので句点で終えない", () => {
    const reason = unmatchedQuestionReason("件数");
    expect(reason).toContain("「件数」");
    expect(reason).toContain("アンケートの画面");
    expect(reason.endsWith("。")).toBe(false);
  });
});

describe("alignPlanKey（内容を見たときの一覧の印）", () => {
  const a: AlignKeyEntry = { formId: "f1", outcome: "toForm", questionsAt: 1, settingsAt: 2 };
  const b: AlignKeyEntry = { formId: "f2", outcome: "toSettings", questionsAt: 5, settingsAt: 3 };

  it("8桁の16進で、並びによらず同じになる", () => {
    expect(alignPlanKey([a, b])).toMatch(/^[0-9a-f]{8}$/);
    expect(alignPlanKey([b, a])).toBe(alignPlanKey([a, b]));
  });

  it("時刻・向き・対象のどれかが変われば変わる", () => {
    const key = alignPlanKey([a, b]);
    expect(alignPlanKey([a, { ...b, questionsAt: 6 }])).not.toBe(key);
    expect(alignPlanKey([a, { ...b, settingsAt: 4 }])).not.toBe(key);
    expect(alignPlanKey([a, { ...b, outcome: "failed" }])).not.toBe(key);
    expect(alignPlanKey([a])).not.toBe(key);
  });

  it("設定から作り直せなかった（null）と、時刻0は区別する", () => {
    expect(alignPlanKey([{ ...a, settingsAt: null }])).not.toBe(alignPlanKey([{ ...a, settingsAt: 0 }]));
    expect(alignPlanKey([{ ...a, questionsAt: null }])).not.toBe(alignPlanKey([{ ...a, questionsAt: 0 }]));
  });

  it("対象が無くても印を返す", () => {
    expect(alignPlanKey([])).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("alignPreviewMessage", () => {
  it("ずれが無ければ、無いと言う", () => {
    expect(alignPreviewMessage(0, 0)).toBe("設定とずれた下書きはありません。");
  });

  it("そろえられるものと、そのままではそろえられないものを分けて数える", () => {
    expect(alignPreviewMessage(2, 0)).toBe("設定とずれた下書きが2件あります。");
    expect(alignPreviewMessage(2, 1)).toBe("設定とずれた下書きが2件あります。このほか1件は、そのままではそろえられません。");
    expect(alignPreviewMessage(0, 1)).toBe("設定とずれた下書きが0件あります。このほか1件は、そのままではそろえられません。");
  });
});

describe("alignResultMessage", () => {
  const none = { toSettings: [], toForm: [], failures: [], follow: "" };

  it("何もそろえなかったときは、そう言う", () => {
    expect(alignResultMessage(none)).toBe("そろえる下書きはありませんでした。");
  });

  it("向きごとに名前を並べ、合計を先に言う", () => {
    expect(alignResultMessage({ ...none, toSettings: ["上期 Regular"], toForm: ["下期 Regular", "下期 Senior"] })).toBe(
      "設定とずれた下書きを3件そろえました。" +
        "下書きの直しを設定へ反映しました（1件: 上期 Regular）。" +
        "設定に合わせて作り直しました（2件: 下期 Regular、下期 Senior）。",
    );
  });

  it("そろえられなかった下書きは、理由を括弧に入れて並べ、追従の文を最後に足す", () => {
    expect(
      alignResultMessage({
        ...none,
        toForm: ["下期 Regular"],
        failures: [{ name: "上期 Regular", reason: "計算式が合いません" }],
        follow: "あわせて1件の下書きを作り直しました。",
      }),
    ).toBe(
      "設定とずれた下書きを1件そろえました。" +
        "設定に合わせて作り直しました（1件: 下期 Regular）。" +
        "そろえられなかった下書きがあります（1件: 上期 Regular（計算式が合いません））。" +
        "あわせて1件の下書きを作り直しました。",
    );
  });

  it("失敗だけのときは、そろえた件数を言わない", () => {
    expect(alignResultMessage({ ...none, failures: [{ name: "上期", reason: "x" }] })).toBe(
      "そろえられなかった下書きがあります（1件: 上期（x））。",
    );
  });
});
