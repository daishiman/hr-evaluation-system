/**
 * 利用者プロフィールの「誰が何を変えてよいか」を1箇所で決める。
 *
 * 設計の柱:
 *  1. 画面とAPIが同じ表を見る — 画面で入力欄を隠すだけでは、APIを直接叩かれたときに素通りする。
 *     画面（出す／出さない）とAPI（受ける／弾く）を必ずこのモジュール経由で揃える。
 *  2. 昇格の経路を作らない — 役割・等級・上長は「設定で本人に開放できる項目」に入れない。
 *     設定ミスで自分を管理者にできる状態が生まれないよう、型のレベルで分ける。
 *  3. 見るのは自由、変えるのは制限 — 自分の情報はすべて本人が見られる。
 *     制限がかかるのは「変更」だけ（人物メモだけは評価者の所見なので本人に出さない）。
 */

/** 会社ごとに「本人にも開放するか」を切り替えられる項目。 */
export const SELF_EDITABLE_FIELDS = ["name", "department", "employeeCode", "hiredAt"] as const;
export type SelfEditableField = (typeof SELF_EDITABLE_FIELDS)[number];

/** 会社の管理者しか変えられない項目（設定でも開放しない）。 */
export const MANAGED_ONLY_FIELDS = ["role", "gradeId", "managerId", "isActive"] as const;
export type ManagedOnlyField = (typeof MANAGED_ONLY_FIELDS)[number];

export type ProfileField = SelfEditableField | ManagedOnlyField;

export interface ProfileFieldSpec {
  key: ProfileField;
  /** 画面に出す名前。利用者の言葉で書く */
  label: string;
  /** 何のための欄かを、開いたときだけ出す一文 */
  hint: string;
  /** 意味を絵で先に伝えるためのアイコン名（src/components/Icon.tsx のキー） */
  icon: string;
  /** 本人に開放できるか。false のものは会社の設定でも変えられない */
  configurable: boolean;
  /** 設定が無いときの既定。氏名だけ本人に開き、記録として管理する項目は会社の管理者に寄せる */
  selfEditableByDefault: boolean;
}

/**
 * 画面に並べる順番＝この配列の順番。
 * 「本人のもの（氏名）→ 会社が管理する記録（所属・社員番号・入社日）→ 制度上の位置づけ（役割・等級・上長）」
 * の順に並べ、下にいくほど本人の手を離れることが並びだけで伝わるようにする。
 */
export const PROFILE_FIELDS: ProfileFieldSpec[] = [
  {
    key: "name",
    label: "氏名",
    hint: "画面や評価シートに出る名前です。旧姓・通称に直したいときはここを変えます。",
    icon: "user",
    configurable: true,
    selfEditableByDefault: true,
  },
  {
    key: "department",
    label: "所属",
    hint: "いま所属している部署・チームです。異動したら変えます。",
    icon: "building",
    configurable: true,
    selfEditableByDefault: false,
  },
  {
    key: "employeeCode",
    label: "社員番号",
    hint: "給与・勤怠と突き合わせるための番号です。会社が採番します。",
    icon: "hash",
    configurable: true,
    selfEditableByDefault: false,
  },
  {
    key: "hiredAt",
    label: "入社日",
    hint: "在籍年数の計算に使います。評価の対象期間の判定にも関わります。",
    icon: "calendar",
    configurable: true,
    selfEditableByDefault: false,
  },
  {
    key: "role",
    label: "役割",
    hint: "見える画面と操作できる範囲が変わります。本人には開放しません。",
    icon: "shield",
    configurable: false,
    selfEditableByDefault: false,
  },
  {
    key: "gradeId",
    label: "等級",
    hint: "配点と昇給額の土台になります。本人には開放しません。",
    icon: "layers",
    configurable: false,
    selfEditableByDefault: false,
  },
  {
    key: "managerId",
    label: "上長",
    hint: "この方が評価を確定します。本人には開放しません。",
    icon: "users",
    configurable: false,
    selfEditableByDefault: false,
  },
  {
    key: "isActive",
    label: "在籍の状態",
    hint: "退職された方は「利用停止」にします。過去の評価は残ります。",
    icon: "power",
    configurable: false,
    selfEditableByDefault: false,
  },
];

/** 会社の設定で切り替えられる項目だけを並べる（設定画面用）。 */
export const CONFIGURABLE_FIELDS = PROFILE_FIELDS.filter((f) => f.configurable);

export function findProfileField(key: string): ProfileFieldSpec | null {
  return PROFILE_FIELDS.find((f) => f.key === key) ?? null;
}

export function isSelfEditableField(key: string): key is SelfEditableField {
  return (SELF_EDITABLE_FIELDS as readonly string[]).includes(key);
}

/** DBから読んだ設定行（未登録の項目は行が無い）。 */
export interface PolicyRow {
  field: string;
  selfEditable: boolean;
}

/** 項目キー → 本人が変更してよいか、を全項目ぶん埋めた表。 */
export type SelfEditMap = Record<SelfEditableField, boolean>;

/**
 * 会社の設定行から「本人が変更してよい項目」の表を作る。
 *
 * 判断したこと:
 *  - 戻り値には必ず全キーを入れる。呼び出し側（画面・API）で「行が無い」場合の
 *    分岐を書かせない。分岐を許すと、書き忘れた画面だけ既定が変わる。
 *  - 知らないキーの行は黙って無視する。項目名を変えたあとに古い行が残っていても、
 *    設定画面と本人の画面が落ちないようにする（設定の取りこぼしより停止の方が困る）。
 *  - 同じ項目の行が2つあったら、後の行を採る。DBの一意制約（uq_pfp_company_field）で
 *    起きない想定だが、決めておかないと読む順で結果が変わる。
 */
export function resolveSelfEditMap(rows: PolicyRow[]): SelfEditMap {
  const map = Object.fromEntries(
    PROFILE_FIELDS.filter((f) => isSelfEditableField(f.key)).map((f) => [f.key, f.selfEditableByDefault]),
  ) as SelfEditMap;

  for (const row of rows) {
    if (!isSelfEditableField(row.field)) continue;
    map[row.field] = row.selfEditable;
  }
  return map;
}

/**
 * 実所属会社を含めて本人編集可否を解決する。
 * 会社に属さない利用者にはポリシーの適用元がないため、会社向けの既定値も適用しない。
 */
export function resolveSelfEditMapForCompany(companyId: string | null, rows: PolicyRow[]): SelfEditMap {
  if (companyId) return resolveSelfEditMap(rows);
  return Object.fromEntries(SELF_EDITABLE_FIELDS.map((field) => [field, false])) as SelfEditMap;
}

/**
 * 本人が自分の情報として変更してよい項目の一覧。
 * APIはこの結果に含まれない項目を受け取った要求を拒否する。
 */
export function selfEditableFieldsFor(rows: PolicyRow[]): SelfEditableField[] {
  const map = resolveSelfEditMap(rows);
  return SELF_EDITABLE_FIELDS.filter((f) => map[f]);
}

/** 実所属会社がある場合だけ、その会社の本人編集ポリシーを適用する。 */
export function selfEditableFieldsForCompany(
  companyId: string | null,
  rows: PolicyRow[],
): SelfEditableField[] {
  const map = resolveSelfEditMapForCompany(companyId, rows);
  return SELF_EDITABLE_FIELDS.filter((field) => map[field]);
}
