/**
 * 「集計し直したほうがよい」を判定するために見張っている表が、
 * 更新時刻を持っているかどうかの検査。
 *
 * 更新時刻を持たない表を見張りに足すと、いつ変わったのかを引けないまま
 * 画面が落ちる。以前は本体の側に「持っていなければ飛ばす」逃げ道があったが、
 * それだと **見張りに足したのに黙って見張られない** ほうが起きる。
 * 逃げ道を外し、代わりにここで足した時点で気づけるようにした。
 */
import { describe, it, expect } from "vitest";
import { WATCHED } from "./impact";

describe("再集計の判定で見張っている表", () => {
  it("すべて更新時刻（updatedAt）を持っている", () => {
    for (const w of WATCHED) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t: any = w.table;
      expect(t.updatedAt, `${w.label} に updatedAt がありません`).toBeTruthy();
    }
  });

  it("見張る対象が減っていない（基準・配点・計算式・要件・係数）", () => {
    const labels = WATCHED.map((w) => w.label);
    for (const must of [
      "KPIのランク基準（A〜Eの線引き）",
      "評価項目と配点",
      "ランクごとの点数の割合",
      "昇格に必要な点数",
      "KPI項目の計算式",
      "等級要件",
      "昇格要件",
      "達成係数",
    ]) {
      expect(labels).toContain(must);
    }
  });
});
