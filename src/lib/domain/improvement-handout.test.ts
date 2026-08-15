import { describe, expect, it } from "vitest";
import {
  HANDOUT_HISTORY_MAX,
  handoutCountText,
  handoutEventWho,
  handoutHistoryNote,
  handoutViaLabel,
  bulkActionLabel,
  bulkActionTone,
  bulkSummaryText,
  changedFieldLabels,
  improvementFingerprint,
  handoutNote,
  handoutState,
  handoutStateLabel,
  handoutStateTone,
  plannedAction,
  summarizeBulk,
  type FingerprintParts,
  type HandoutSnapshot,
} from "@/lib/domain/improvement-handout";

const base: FingerprintParts = {
  kind: "bug",
  screenLabel: "評価一覧",
  path: "/admin/evaluations?year=2026",
  routePattern: "/admin/evaluations",
  body: "保存を押しても戻ってこない",
  expected: "保存できてほしい",
  status: "open",
  handledNote: null,
};

const handout = (over: Partial<HandoutSnapshot> = {}): HandoutSnapshot => ({
  contentFingerprint: improvementFingerprint(base),
  handedOutAt: new Date("2026-08-15T03:00:00Z"),
  ...over,
});

describe("内容の指紋", () => {
  it("同じ内容なら同じ指紋、1文字でも違えば違う指紋になる", () => {
    expect(improvementFingerprint(base)).toBe(improvementFingerprint({ ...base }));
    expect(improvementFingerprint({ ...base, body: `${base.body}。` })).not.toBe(improvementFingerprint(base));
  });

  it("記入なし（null）と空文字は同じ扱いにする", () => {
    const empty = improvementFingerprint({ ...base, expected: null, handledNote: null });
    expect(improvementFingerprint({ ...base, expected: "", handledNote: "" })).toBe(empty);
  });

  it("画面の呼び名・URL・URLの形は、まとめて「画面」1項目として数える", () => {
    const moved = improvementFingerprint({ ...base, path: "/admin/evaluations?year=2025" });
    expect(changedFieldLabels(improvementFingerprint(base), moved)).toEqual(["画面"]);
  });

  it("空の本文でも指紋を作れる（送信直後の下書きでも落ちない）", () => {
    expect(improvementFingerprint({ ...base, body: "" })).toMatch(/^body=[0-9a-f]{8};/);
  });
});

describe("変わった項目の読み取り", () => {
  it("変わった項目だけを、読む順で日本語にして返す", () => {
    const after = improvementFingerprint({ ...base, body: "別の話", status: "doing", handledNote: "見ています" });
    expect(changedFieldLabels(improvementFingerprint(base), after)).toEqual(["要望の本文", "対応状況", "対応メモ"]);
  });

  it("何も変わっていなければ空になる", () => {
    expect(changedFieldLabels(improvementFingerprint(base), improvementFingerprint(base))).toEqual([]);
  });

  it("前回の指紋が無いときは、変わっていない扱いにする", () => {
    // 渡したときの内容が残っていないのに「変更あり」とすると、
    // 中身が同じ指示文を何度も渡すことになる。
    expect(changedFieldLabels("", improvementFingerprint(base))).toEqual([]);
  });

  it("読めない形が混じっていても落ちず、欠けた項目は変わったものとして出す", () => {
    // 古い形の指紋（項目が足りない・区切りが壊れている）を後から読む場面。
    expect(changedFieldLabels("body=00000000;こわれた", improvementFingerprint(base))).toContain("要望の本文");
    expect(changedFieldLabels("body=00000000", improvementFingerprint(base))).toContain("対応状況");
    // 比べる相手（今の指紋）のほうが欠けている場合も、欠けた項目を変化として出す。
    expect(changedFieldLabels(improvementFingerprint(base), "body=00000000")).toContain("対応状況");
  });
});

describe("払い出しの状態", () => {
  it("控えが無ければ未払い出し", () => {
    expect(handoutState(null, improvementFingerprint(base))).toBe("none");
  });

  it("指紋が一致していれば払い出し済み", () => {
    expect(handoutState(handout(), improvementFingerprint(base))).toBe("handed");
  });

  it("渡したあとに内容が変わっていれば更新あり", () => {
    expect(handoutState(handout(), improvementFingerprint({ ...base, status: "done" }))).toBe("changed");
  });

  it("3つの状態すべてに、言葉・色・渡したときの動きがある", () => {
    expect(handoutStateLabel("none")).toBe("未払い出し");
    expect(handoutStateLabel("handed")).toBe("払い出し済み");
    expect(handoutStateLabel("changed")).toBe("更新あり");
    expect(handoutStateTone("none")).toBe("closed");
    expect(handoutStateTone("handed")).toBe("done");
    expect(handoutStateTone("changed")).toBe("active");
    expect(plannedAction("none")).toBe("handout");
    expect(plannedAction("handed")).toBe("skip");
    expect(plannedAction("changed")).toBe("rehandout");
  });

  it("どの状態にも理由が出る（無言の行を作らない）", () => {
    expect(handoutNote("none")).toContain("まだ指示文を渡していません");
    expect(handoutNote("changed")).toContain("内容が変わりました");
    expect(handoutNote("handed")).toContain("渡した内容のまま");
  });
});

describe("まとめ操作の結果", () => {
  it("払い出しの実行内容に、言葉と色がある", () => {
    expect(bulkActionLabel("handed")).toBe("払い出し");
    expect(bulkActionLabel("rehanded")).toBe("再払い出し");
    expect(bulkActionLabel("skipped")).toBe("スキップ");
    expect(bulkActionLabel("failed")).toBe("失敗");
    expect(bulkActionTone("handed")).toBe("done");
    expect(bulkActionTone("rehanded")).toBe("active");
    expect(bulkActionTone("skipped")).toBe("closed");
    expect(bulkActionTone("failed")).toBe("alert");
  });

  it("件数のまとめは、実行内容ごとに数え上げる", () => {
    const counts = summarizeBulk([
      { action: "handed" },
      { action: "handed" },
      { action: "rehanded" },
      { action: "skipped" },
      { action: "failed" },
    ]);
    expect(counts.handed).toBe(2);
    expect(counts.rehanded).toBe(1);
    expect(counts.skipped).toBe(1);
    expect(counts.failed).toBe(1);
    // 0件のものは書かない。数えた実行内容だけを並べる（0件が並ぶと読み飛ばされる）。
    expect(bulkSummaryText(counts)).toBe("払い出し2件／再払い出し1件／スキップ1件／失敗1件");
  });

  it("落とす・戻す操作も同じまとめに数える", () => {
    const counts = summarizeBulk([{ action: "discarded" }, { action: "restored" }, { action: "rejected" }]);
    expect(bulkSummaryText(counts)).toBe("対応しない1件／廃棄1件／元に戻した1件");
    expect(bulkActionLabel("duplicated")).toBe("重複");
    expect(bulkActionLabel("discarded")).toBe("廃棄");
    expect(bulkActionLabel("restored")).toBe("元に戻した");
    expect(bulkActionLabel("rejected")).toBe("対応しない");
    expect(bulkActionTone("discarded")).toBe("dropped");
    expect(bulkActionTone("restored")).toBe("done");
    expect(bulkActionTone("rejected")).toBe("dropped");
    expect(bulkActionTone("duplicated")).toBe("dropped");
  });

  it("1件も無ければ、0件の羅列ではなく「対象がありません」と言う", () => {
    expect(bulkSummaryText(summarizeBulk([]))).toBe("対象がありません");
  });
});

/* 2026-08-15、依頼者から「何度・いつ・誰が・どの鍵で払い出したかを残してほしい」。
   最後の1回分の控えだけでは、渡し直しの経緯が読めなかった。 */
describe("払い出しの履歴", () => {
  it("画面からのコピーと、Claude Code の取得を別の言葉で言う", () => {
    expect(handoutViaLabel("screen")).toBe("画面からコピー");
    expect(handoutViaLabel("api")).toBe("Claude Code が取得");
  });

  it("誰が渡したかは、経路によって人か鍵のどちらかで言う", () => {
    expect(handoutEventWho({ via: "screen", actorName: "青木", keyName: null })).toBe("青木");
    // 退職して行が消えても、無言にしない
    expect(handoutEventWho({ via: "screen", actorName: null, keyName: null })).toBe("退職された方");
    expect(handoutEventWho({ via: "api", actorName: null, keyName: "自宅" })).toBe("鍵「自宅」");
    // サーバーの設定値で通ったときは鍵の行が無い
    expect(handoutEventWho({ via: "api", actorName: null, keyName: null })).toBe("サーバーの設定値の鍵");
  });

  it("一覧には回数と最終の日時を1行で出す", () => {
    expect(handoutCountText(0, null)).toBe("まだ渡していません");
    expect(handoutCountText(3, null)).toBe("まだ渡していません");
    expect(handoutCountText(3, "2026年8月15日 10:00")).toBe("3回・最終 2026年8月15日 10:00");
  });

  it("古い記録を丸めたことを黙って隠さない", () => {
    expect(HANDOUT_HISTORY_MAX).toBeGreaterThan(0);
    expect(handoutHistoryNote(HANDOUT_HISTORY_MAX)).toContain("新しい順に並びます");
    expect(handoutHistoryNote(HANDOUT_HISTORY_MAX + 1)).toContain("古い記録は消えています");
  });
});
