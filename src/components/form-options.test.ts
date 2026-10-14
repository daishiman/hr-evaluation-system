import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { duplicateOptionValues, duplicateOptionMessage } from "@/lib/form-build";
import { nextOptionValue } from "@/components/form-builder-model";

/*
 * 選択肢の値の重複（S12・A11）。
 *
 * 値が重なると、回答画面で2つの選択肢が一緒に光り、押した方が選ばれたように見えない。
 * 組み立て画面は重ならない値を作り、保存はサーバーで重複を断る（画面の検査だけに頼らない）。
 */

describe("duplicateOptionValues", () => {
  it("重なっている値を1回ずつ返す（前後の空白は同じ値とみなす）", () => {
    expect(
      duplicateOptionValues([
        { value: "1", label: "a" },
        { value: "3", label: "b" },
        { value: "3", label: "c" },
        { value: " 3", label: "d" },
        { value: "2", label: "e" },
        { value: "2", label: "f" },
      ]),
    ).toEqual(["3", "2"]);
  });

  it("重なりが無ければ空", () => {
    expect(duplicateOptionValues([{ value: "1", label: "a" }, { value: "2", label: "b" }])).toEqual([]);
    expect(duplicateOptionValues([])).toEqual([]);
  });

  it("断るときの文は、どの設問のどの選択肢かを言う", () => {
    const message = duplicateOptionMessage("今期の取り組み", ["3"]);
    expect(message).toContain("今期の取り組み");
    expect(message).toContain("3");
    expect(message).toMatch(/重な/);
  });
});

describe("nextOptionValue（組み立て画面で選択肢を足すとき）", () => {
  it("今ある数字の値の最大＋1にする（消してから足しても重ならない）", () => {
    expect(nextOptionValue([{ value: "1" }, { value: "3" }])).toBe("4");
    expect(nextOptionValue([])).toBe("1");
  });

  it("数字でない値は数えず、重ならない値を作る", () => {
    expect(nextOptionValue([{ value: "a" }, { value: "2" }])).toBe("3");
    expect(nextOptionValue([{ value: "a" }])).toBe("1");
  });
});

describe("保存の入口が重複を断る", () => {
  it("アンケートの設問の保存（forms.ts）と組み立て（form-build.ts）が重複の検査を通す", () => {
    const actions = readFileSync(path.join(process.cwd(), "src/actions/forms.ts"), "utf8");
    expect(actions).toMatch(/duplicateOptionValues/);
    const builder = readFileSync(path.join(process.cwd(), "src/components/FormBuilder.tsx"), "utf8");
    expect(builder).toMatch(/nextOptionValue/);
    expect(builder).not.toMatch(/String\(r\.options\.length \+ 1\)/);
  });
});
