import { describe, expect, it } from "vitest";
import {
  DISCARD_REASONS,
  DISPOSITION_ACTIONS,
  IMPROVEMENT_SORTS,
  IMPROVEMENT_VIEWS,
  REJECT_REASONS,
  bulkDispositionConfirm,
  canDisposeImprovements,
  dispositionActionLabel,
  dispositionConfirm,
  dispositionNeedsReason,
  dispositionReasonError,
  filterImprovementsByView,
  improvementEventActor,
  improvementDisplayState,
  improvementDisplayStateLabel,
  improvementDisplayStateTone,
  improvementEventLabel,
  improvementSortLabel,
  improvementViewLabel,
  isDispositionAction,
  isImprovementSort,
  isImprovementView,
  reasonChoices,
  reasonCodeLabel,
  reasonText,
  sortImprovements,
} from "@/lib/domain/improvement-disposition";
import type { ImprovementStatus } from "@/lib/domain/improvement";

const row = (
  over: Partial<{ status: ImprovementStatus; discarded: boolean; duplicateOfId: string | null; createdAt: Date }> = {},
) => ({
  status: "open" as ImprovementStatus,
  discarded: false,
  duplicateOfId: null as string | null,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  ...over,
});

describe("画面に出す状態", () => {
  it("廃棄が最優先、次が重複、どちらでもなければ対応状況", () => {
    expect(improvementDisplayState(row({ discarded: true, duplicateOfId: "ir_1", status: "done" }))).toBe("discarded");
    expect(improvementDisplayState(row({ duplicateOfId: "ir_1", status: "done" }))).toBe("duplicate");
    expect(improvementDisplayState(row({ status: "doing" }))).toBe("doing");
  });

  it("見送りは「対応しない」と読ませる（送った人に伝わる言葉にする）", () => {
    expect(improvementDisplayStateLabel("discarded")).toBe("廃棄");
    expect(improvementDisplayStateLabel("duplicate")).toBe("重複");
    expect(improvementDisplayStateLabel("dropped")).toBe("対応しない");
    expect(improvementDisplayStateLabel("open")).toBe("未対応");
    expect(improvementDisplayStateLabel("doing")).toBe("対応中");
    expect(improvementDisplayStateLabel("done")).toBe("対応済み");
  });

  it("色は状態ごとに1つに決まる", () => {
    expect(improvementDisplayStateTone("open")).toBe("required");
    expect(improvementDisplayStateTone("doing")).toBe("active");
    expect(improvementDisplayStateTone("done")).toBe("done");
    expect(improvementDisplayStateTone("discarded")).toBe("closed");
    expect(improvementDisplayStateTone("dropped")).toBe("dropped");
    expect(improvementDisplayStateTone("duplicate")).toBe("dropped");
  });
});

describe("操作の種類", () => {
  it("知らない操作名は受け付けない", () => {
    expect(isDispositionAction("discard")).toBe(true);
    expect(isDispositionAction("delete")).toBe(false);
  });

  it("すべての操作に画面の言葉がある", () => {
    for (const a of DISPOSITION_ACTIONS) expect(dispositionActionLabel(a).length).toBeGreaterThan(0);
    expect(dispositionActionLabel("reject")).toBe("対応しない");
    expect(dispositionActionLabel("duplicate")).toBe("重複");
    expect(dispositionActionLabel("discard")).toBe("廃棄");
    expect(dispositionActionLabel("restore")).toBe("元に戻す");
  });

  it("理由が要るのは、要望を落とす3つだけ", () => {
    expect(dispositionNeedsReason("reject")).toBe(true);
    expect(dispositionNeedsReason("duplicate")).toBe(true);
    expect(dispositionNeedsReason("discard")).toBe(true);
    expect(dispositionNeedsReason("restore")).toBe(false);
  });
});

describe("落とす理由", () => {
  it("操作ごとに選べる理由が変わる", () => {
    expect(reasonChoices("discard")).toEqual(DISCARD_REASONS);
    expect(reasonChoices("reject")).toEqual(REJECT_REASONS);
    expect(reasonChoices("duplicate")).toHaveLength(1);
    expect(reasonChoices("restore")).toEqual(REJECT_REASONS);
  });

  it("理由コードは画面の言葉に直す。知らないコードは黙らせない", () => {
    expect(reasonCodeLabel("discard", "test")).toBe("テスト投稿");
    expect(reasonCodeLabel("discard", "unknown")).toBe("理由の記録なし");
  });

  it("理由を選ばなければ落とせない", () => {
    expect(dispositionReasonError("discard", "", "")).toBe("落とす理由を選んでください。");
    expect(dispositionReasonError("reject", "spam", "")).toBe("落とす理由を選んでください。");
  });

  it("その他を選んだときだけ、自由記述を必須にする", () => {
    expect(dispositionReasonError("reject", "other", "   ")).toBe("「その他」を選んだときは理由を書いてください。");
    expect(dispositionReasonError("reject", "other", "次の版で直します")).toBeNull();
    expect(dispositionReasonError("reject", "by-design", "")).toBeNull();
  });

  it("理由の要らない操作は、何も選ばなくても通る", () => {
    expect(dispositionReasonError("restore", "", "")).toBeNull();
  });

  it("履歴に残す1行は、定型と自由記述をつなぐ", () => {
    expect(reasonText("discard", "mistake", "")).toBe("誤送信");
    expect(reasonText("discard", "mistake", " 二重に送られました ")).toBe("誤送信：二重に送られました");
    expect(reasonText("restore", "", "")).toBe("元に戻す");
    expect(reasonText("restore", "", "作り直します")).toBe("元に戻す：作り直します");
  });
});

describe("権限と確認", () => {
  it("落とす・戻すはシステム全体管理者だけ", () => {
    expect(canDisposeImprovements("SUPER_ADMIN")).toBe(true);
    expect(canDisposeImprovements("COMPANY_ADMIN")).toBe(false);
    expect(canDisposeImprovements("EMPLOYEE")).toBe(false);
  });

  it("まとめて実行する確認には、必ず件数を書く", () => {
    expect(bulkDispositionConfirm("discard", 12)).toBe("12件を「廃棄」にします。よろしいですか。");
    expect(dispositionConfirm("reject")).toBe("この要望を「対応しない」にします。");
  });
});

describe("一覧の見え方", () => {
  const rows = [
    row({ status: "open" }),
    row({ status: "doing" }),
    row({ status: "done" }),
    row({ status: "dropped" }),
    row({ status: "open", duplicateOfId: "ir_x" }),
    row({ status: "open", discarded: true }),
  ];

  it("知らない見え方・並べ替えは受け付けない", () => {
    expect(isImprovementView("trash")).toBe(true);
    expect(isImprovementView("deleted")).toBe(false);
    expect(isImprovementSort("state")).toBe(true);
    expect(isImprovementSort("random")).toBe(false);
  });

  it("すべての見え方・並べ替えに画面の言葉がある", () => {
    for (const v of IMPROVEMENT_VIEWS) expect(improvementViewLabel(v).length).toBeGreaterThan(0);
    for (const s of IMPROVEMENT_SORTS) expect(improvementSortLabel(s).length).toBeGreaterThan(0);
    expect(improvementViewLabel("trash")).toBe("廃棄箱");
    expect(improvementSortLabel("new")).toBe("新しい順");
  });

  it("既定では、終わったもの・落としたもの・廃棄したものを出さない", () => {
    expect(filterImprovementsByView(rows, "active")).toHaveLength(2);
  });

  it("すべてを選んでも、廃棄したものは混ぜない", () => {
    const all = filterImprovementsByView(rows, "all");
    expect(all).toHaveLength(5);
    expect(all.every((r) => !r.discarded)).toBe(true);
  });

  it("廃棄箱には、廃棄したものだけが並ぶ", () => {
    const trash = filterImprovementsByView(rows, "trash");
    expect(trash).toHaveLength(1);
    expect(trash[0].discarded).toBe(true);
  });
});

describe("並べ替え", () => {
  const a = row({ createdAt: new Date("2026-08-01T00:00:00Z"), status: "done" });
  const b = row({ createdAt: new Date("2026-08-03T00:00:00Z"), status: "open" });
  const c = row({ createdAt: new Date("2026-08-02T00:00:00Z"), status: "open" });

  it("新しい順・古い順は届いた日時で決まる", () => {
    expect(sortImprovements([a, b, c], "new").map((r) => r.createdAt.getDate())).toEqual([3, 2, 1]);
    expect(sortImprovements([a, b, c], "old").map((r) => r.createdAt.getDate())).toEqual([1, 2, 3]);
  });

  it("状態順は手が要るものから。同じ状態なら新しいものが先", () => {
    const sorted = sortImprovements([a, c, b], "state");
    expect(sorted.map((r) => r.createdAt.getDate())).toEqual([3, 2, 1]);
    const withTrash = sortImprovements(
      [row({ discarded: true }), row({ duplicateOfId: "ir_1" }), row({ status: "dropped" }), b],
      "state",
    );
    expect(withTrash.map(improvementDisplayState)).toEqual(["open", "duplicate", "dropped", "discarded"]);
  });

  it("元の配列は並べ替えない（一覧の他の使い道を壊さない）", () => {
    const src = [a, b, c];
    sortImprovements(src, "old");
    expect(src[0]).toBe(a);
  });
});

describe("操作の履歴に出す言葉", () => {
  it("落とす・戻す操作は、そのままの言葉で出る", () => {
    expect(improvementEventLabel("discard")).toBe("廃棄");
    expect(improvementEventLabel("restore")).toBe("元に戻す");
  });

  it("払い出しの記録も読める", () => {
    expect(improvementEventLabel("handout")).toBe("指示文の払い出し");
  });

  it("前の仕組みで残った記録も、当時の言葉のまま読める", () => {
    // 履歴は消さずに積み上げてあるので、Issue へ送っていた頃の行が残っている。
    expect(improvementEventLabel("sync")).toBe("記録票へ送信");
    expect(improvementEventLabel("close-issue")).toBe("記録票を閉じる");
    expect(improvementEventLabel("unlink")).toBe("ひも付け解除");
    expect(improvementEventLabel("refresh")).toBe("記録票の状態を取り込む");
  });

  it("知らない記録でも無言にしない", () => {
    expect(improvementEventLabel("status")).toBe("対応状況の変更");
    expect(improvementEventLabel("なにか")).toBe("対応状況の変更");
  });
});

describe("履歴を起こしたのが誰か", () => {
  it("人が押した行は、その人の名前で読む", () => {
    expect(improvementEventActor("山田 太郎", null)).toBe("山田 太郎");
  });

  it("鍵が変えた行は、人の操作と読み分けられる", () => {
    expect(improvementEventActor(null, "自宅の Claude Code")).toBe("作業する側（自宅の Claude Code）");
  });

  it("どちらも分からない古い行は、これまでどおり", () => {
    expect(improvementEventActor(null, null)).toBe("退職された方");
  });

  it("作業する側が書き戻した行は、そうと分かる言葉で出す", () => {
    expect(improvementEventLabel("agent-done")).toBe("直して公開（作業する側）");
    expect(improvementEventLabel("agent-failed")).toBe("直しきれず（作業する側）");
  });
});
