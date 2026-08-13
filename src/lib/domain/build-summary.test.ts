import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FINALIZED_SKIP_MESSAGE, summarizeBuildResults } from "./build-summary";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("集計し直しの結果の要約", () => {
  it("作れた人数を出す", () => {
    const msg = summarizeBuildResults([
      { employeeName: "田中", ok: true, message: "" },
      { employeeName: "佐藤", ok: true, message: "" },
    ]);
    expect(msg).toContain("2人ぶんの評価を作りました。");
    expect(msg).not.toContain("据え置");
  });

  it("確定済みで据え置いた人数を必ず言う（黙って飛ばさない）", () => {
    const msg = summarizeBuildResults([
      { employeeName: "田中", ok: true, message: "" },
      { employeeName: "佐藤", ok: false, message: FINALIZED_SKIP_MESSAGE },
    ]);
    expect(msg).toContain("1人ぶんの評価を作りました。");
    expect(msg).toContain("確定済みの1人ぶんは、判定した当時の基準のまま据え置きました。");
  });

  it("作れなかった人は名前と理由を出す", () => {
    const msg = summarizeBuildResults([
      { employeeName: "田中", ok: false, message: "等級区分「AM」の評価セットが未設定です。" },
    ]);
    expect(msg).toContain("1人ぶんは作れませんでした");
    expect(msg).toContain("田中：等級区分「AM」の評価セットが未設定です。");
  });

  it("対象が0件のときは「動かなかった」と区別できる文を返す", () => {
    expect(summarizeBuildResults([])).toContain("集計できる回答がありませんでした");
  });

  it("据え置きの判定に使う文言は集計処理と同じ定数を共有する", () => {
    const evaluate = read("src/lib/evaluate.ts");
    expect(evaluate).toContain("message: FINALIZED_SKIP_MESSAGE");
    expect(evaluate).toContain('from "@/lib/domain/build-summary"');
  });
});

describe("集計し直しの受け口（/api/evaluations/build）", () => {
  const route = read("src/app/api/evaluations/build/route.ts");

  it("既存の集計処理を呼ぶ（計算をここに書き直さない）", () => {
    expect(route).toContain('import { buildEvaluationsForCycle } from "@/lib/evaluate"');
    expect(route).toContain("await buildEvaluationsForCycle(");
    // 集計の中身をコピーしていないこと
    expect(route).not.toContain("judgeOverall");
    expect(route).not.toContain("s.evaluationItems");
  });

  it("マネージャー以上でなければ実行できない（サーバー側で判定）", () => {
    expect(route).toContain('apiViewer("MANAGER")');
  });

  it("会社の境界を守る（サイクルを自社に絞ってから集計する）", () => {
    expect(route).toContain("eq(s.evaluationCycles.companyId, viewer.companyId)");
    expect(route).toContain("buildEvaluationsForCycle(viewer.companyId,");
    const cycleCheck = route.indexOf("eq(s.evaluationCycles.companyId");
    const build = route.indexOf("await buildEvaluationsForCycle(");
    expect(cycleCheck).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(cycleCheck);
  });

  it("他社のサイクルIDを渡されたら404で止める", () => {
    expect(route).toContain('new HttpError(404, "その評価期間は見つかりませんでした。")');
  });

  it("結果の要約を返し、画面がそのまま出せるようにする", () => {
    expect(route).toContain("summarizeBuildResults(results)");
  });
});

describe("確定済みの評価は集計し直しで上書きされない", () => {
  const evaluate = read("src/lib/evaluate.ts");

  it("確定済みなら計算にも保存にも進まない", () => {
    const guard = evaluate.indexOf('existing?.status === "finalized"');
    const del = evaluate.indexOf("db.delete(s.evaluations)");
    const insert = evaluate.indexOf("db.insert(s.evaluations).values(evaluationRow)");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(del).toBeGreaterThan(guard);
    expect(insert).toBeGreaterThan(guard);
    // 確定済みの分岐は continue で抜ける（下の削除・保存に落ちない）
    const block = evaluate.slice(guard, del);
    expect(block).toContain("continue;");
  });

  it("作り直した評価は必ず確認中（draft）で保存する", () => {
    expect(evaluate).toContain('status: "draft",');
  });

  it("既存の評価を読むときも会社とサイクルで絞る（他社・他期の評価を消さない）", () => {
    expect(evaluate).toContain("eq(s.evaluations.companyId, companyId)");
    expect(evaluate).toContain("eq(s.evaluations.cycleId, cycleId)");
  });
});

describe("画面の3つのボタン", () => {
  it("すべて /api/evaluations/build を呼び、実行前の確認文がある", () => {
    for (const path of ["src/app/manager/cycles/page.tsx", "src/app/manager/evaluations/[id]/page.tsx"]) {
      const page = read(path);
      const blocks = page.split("<ActionButton").filter((b) => b.includes("/api/evaluations/build"));
      expect(blocks.length).toBeGreaterThan(0);
      for (const b of blocks) {
        expect(b.slice(0, b.indexOf("/>"))).toContain("confirm=");
      }
    }
  });

  it("確認文で「確定済みは変わらない」ことを伝える", () => {
    expect(read("src/app/manager/cycles/page.tsx")).toContain("確定済みの評価は変わりません");
  });
});
