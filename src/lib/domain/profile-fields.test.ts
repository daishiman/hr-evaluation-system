import { describe, expect, it } from "vitest";
import {
  CONFIGURABLE_FIELDS,
  PROFILE_FIELDS,
  SELF_EDITABLE_FIELDS,
  isSelfEditableField,
  resolveSelfEditMap,
  resolveSelfEditMapForCompany,
  selfEditableFieldsFor,
  selfEditableFieldsForCompany,
} from "@/lib/domain/profile-fields";

describe("プロフィール項目の定義", () => {
  it("役割・等級・上長・在籍は、会社の設定でも本人に開放できない", () => {
    for (const key of ["role", "gradeId", "managerId", "isActive"]) {
      const spec = PROFILE_FIELDS.find((f) => f.key === key);
      expect(spec?.configurable, `${key} は開放不可であるべき`).toBe(false);
      expect(isSelfEditableField(key)).toBe(false);
    }
  });

  it("設定画面に出るのは、切り替えてよい項目だけ", () => {
    expect(CONFIGURABLE_FIELDS.map((f) => f.key)).toEqual([...SELF_EDITABLE_FIELDS]);
  });
});

describe("resolveSelfEditMap", () => {
  it("設定が1件も無ければ、既定（氏名だけ本人可）になる", () => {
    expect(resolveSelfEditMap([])).toEqual({
      name: true,
      department: false,
      employeeCode: false,
      hiredAt: false,
    });
  });

  it("設定行があれば既定より優先される", () => {
    const map = resolveSelfEditMap([
      { field: "name", selfEditable: false },
      { field: "department", selfEditable: true },
    ]);
    expect(map.name).toBe(false);
    expect(map.department).toBe(true);
    // 行が無い項目は既定のまま
    expect(map.hiredAt).toBe(false);
  });

  it("知らないキーの行は無視する（役割を混ぜられても表に現れない）", () => {
    const map = resolveSelfEditMap([{ field: "role", selfEditable: true }]);
    expect(Object.keys(map).sort()).toEqual([...SELF_EDITABLE_FIELDS].sort());
    expect((map as Record<string, boolean>).role).toBeUndefined();
  });

  it("戻り値は必ず全キーを持つ", () => {
    const map = resolveSelfEditMap([{ field: "name", selfEditable: true }]);
    for (const f of SELF_EDITABLE_FIELDS) expect(map).toHaveProperty(f);
  });
});

describe("selfEditableFieldsFor", () => {
  it("本人が変更してよい項目だけを、定義の順番で返す", () => {
    const fields = selfEditableFieldsFor([
      { field: "hiredAt", selfEditable: true },
      { field: "department", selfEditable: true },
    ]);
    expect(fields).toEqual(["name", "department", "hiredAt"]);
  });

  it("すべて禁止なら空", () => {
    const fields = selfEditableFieldsFor(SELF_EDITABLE_FIELDS.map((f) => ({ field: f, selfEditable: false })));
    expect(fields).toEqual([]);
  });
});

describe("実所属会社を含めた本人編集可否", () => {
  it("会社に属していなければ、会社向けの既定値も適用しない", () => {
    expect(resolveSelfEditMapForCompany(null, [])).toEqual({
      name: false,
      department: false,
      employeeCode: false,
      hiredAt: false,
    });
    expect(selfEditableFieldsForCompany(null, [])).toEqual([]);
  });

  it("実所属会社があれば、設定行がない項目には会社向けの既定値を適用する", () => {
    expect(selfEditableFieldsForCompany("cmp_a", [])).toEqual(["name"]);
  });
});
