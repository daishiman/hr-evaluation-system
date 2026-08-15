import { describe, expect, it } from "vitest";
import {
  bulkActionLabel,
  bulkActionTone,
  bulkSummaryText,
  changedFieldLabels,
  improvementFingerprint,
  issueSyncNote,
  issueSyncState,
  issueSyncStateLabel,
  issueSyncStateTone,
  issueUpdateComment,
  plannedAction,
  summarizeBulk,
  type FingerprintParts,
  type IssueLinkSnapshot,
} from "@/lib/domain/improvement-sync";

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

const link = (over: Partial<IssueLinkSnapshot> = {}): IssueLinkSnapshot => ({
  issueNumber: 12,
  linkState: "ok",
  contentFingerprint: improvementFingerprint(base),
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
    // 記録票を作ったときの内容が残っていないのに「変更あり」とすると、
    // 中身が同じ記録票へコメントだけが積み上がる。
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

describe("記録票の状態", () => {
  it("控えが無ければ未起票", () => {
    expect(issueSyncState(null, improvementFingerprint(base))).toBe("none");
  });

  it("指紋が一致していれば起票済み", () => {
    expect(issueSyncState(link(), improvementFingerprint(base))).toBe("synced");
  });

  it("作ったあとに内容が変わっていれば更新あり", () => {
    expect(issueSyncState(link(), improvementFingerprint({ ...base, status: "done" }))).toBe("changed");
  });

  it("GitHub 側に無い控え・作りかけの控えは、どちらも送れない状態にする", () => {
    expect(issueSyncState(link({ linkState: "missing" }), improvementFingerprint(base))).toBe("broken");
    expect(issueSyncState(link({ issueNumber: 0 }), improvementFingerprint(base))).toBe("broken");
  });

  it("4つの状態すべてに、言葉・色・送ったときの動きがある", () => {
    expect(issueSyncStateLabel("none")).toBe("未起票");
    expect(issueSyncStateLabel("synced")).toBe("起票済み");
    expect(issueSyncStateLabel("changed")).toBe("更新あり");
    expect(issueSyncStateLabel("broken")).toBe("送信できない");
    expect(issueSyncStateTone("none")).toBe("closed");
    expect(issueSyncStateTone("synced")).toBe("done");
    expect(issueSyncStateTone("changed")).toBe("active");
    expect(issueSyncStateTone("broken")).toBe("alert");
    expect(plannedAction("none")).toBe("create");
    expect(plannedAction("synced")).toBe("skip");
    expect(plannedAction("changed")).toBe("update");
    expect(plannedAction("broken")).toBe("recreate");
  });

  it("どの状態にも理由が出る（無言の行を作らない）", () => {
    expect(issueSyncNote("none", null)).toContain("まだ記録票を作っていません");
    expect(issueSyncNote("changed", link())).toContain("内容が変わりました");
    expect(issueSyncNote("synced", link())).toContain("何も変わりません");
    expect(issueSyncNote("broken", link({ linkState: "missing" }))).toContain("GitHub 側に記録票がありません");
    expect(issueSyncNote("broken", link({ issueNumber: 0 }))).toContain("途中で終わりました");
    expect(issueSyncNote("broken", null)).toContain("途中で終わりました");
  });
});

describe("一括送信の結果", () => {
  it("4つの実行内容に、言葉と色がある", () => {
    expect(bulkActionLabel("created")).toBe("新規に作成");
    expect(bulkActionLabel("updated")).toBe("内容を更新");
    expect(bulkActionLabel("skipped")).toBe("スキップ");
    expect(bulkActionLabel("failed")).toBe("失敗");
    expect(bulkActionTone("created")).toBe("done");
    expect(bulkActionTone("updated")).toBe("active");
    expect(bulkActionTone("skipped")).toBe("closed");
    expect(bulkActionTone("failed")).toBe("alert");
  });

  it("件数のまとめは、実行内容ごとに数え上げる", () => {
    const counts = summarizeBulk([
      { action: "created" },
      { action: "created" },
      { action: "updated" },
      { action: "skipped" },
      { action: "failed" },
    ]);
    expect(counts.created).toBe(2);
    expect(counts.updated).toBe(1);
    expect(counts.skipped).toBe(1);
    expect(counts.failed).toBe(1);
    // 0件のものは書かない。数えた実行内容だけを並べる（0件が並ぶと読み飛ばされる）。
    expect(bulkSummaryText(counts)).toBe("新規に作成2件／内容を更新1件／スキップ1件／失敗1件");
  });

  it("落とす・戻す操作も同じまとめに数える", () => {
    const counts = summarizeBulk([{ action: "discarded" }, { action: "restored" }, { action: "rejected" }]);
    expect(bulkSummaryText(counts)).toBe("対応しない1件／廃棄1件／元に戻した1件");
    expect(bulkActionLabel("duplicated")).toBe("重複");
    expect(bulkActionLabel("unlinked")).toBe("ひも付け解除");
    expect(bulkActionLabel("closed")).toBe("記録票を閉じた");
    expect(bulkActionLabel("refreshed")).toBe("状態を取り込んだ");
    expect(bulkActionTone("discarded")).toBe("dropped");
    expect(bulkActionTone("restored")).toBe("done");
    expect(bulkActionTone("rejected")).toBe("dropped");
    expect(bulkActionTone("duplicated")).toBe("dropped");
    expect(bulkActionTone("unlinked")).toBe("closed");
    expect(bulkActionTone("closed")).toBe("closed");
    expect(bulkActionTone("refreshed")).toBe("active");
  });

  it("1件も無ければ、0件の羅列ではなく「対象がありません」と言う", () => {
    expect(bulkSummaryText(summarizeBulk([]))).toBe("対象がありません");
  });
});

describe("記録票へ足すコメント", () => {
  const at = new Date("2026-08-15T03:00:00Z");

  it("いつ・何が変わったか・本文を置き換えたことを書く", () => {
    const text = issueUpdateComment(["要望の本文", "対応状況"], at, false);
    expect(text).toContain("2026-08-15 12:00 JST");
    expect(text).toContain("- 要望の本文");
    expect(text).toContain("- 対応状況");
    expect(text).toContain("最新の内容へ置き換えました");
    expect(text).not.toContain("閉じられています");
  });

  it("閉じている記録票では、勝手に開き直していないことを書き添える", () => {
    const text = issueUpdateComment(["対応状況"], at, true);
    expect(text).toContain("閉じられています");
    expect(text).toContain("開き直すことはしていません");
  });
});
