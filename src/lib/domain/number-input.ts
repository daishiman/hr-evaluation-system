/**
 * 数値入力の正規化。
 *
 * 方針は「打っている間は寛容に、確定したときに整える」。
 * 打っている途中の「-」だけ・「1.」までを弾くと入力そのものができなくなるため、
 * **打っている間は形を見ない**（`normalizeWhileTyping`）。
 * 数値として読むのは、欄から離れたとき・保存するときだけ（`parseNumberInput`）。
 *
 * 「半角で入力してください」と叱る作りにはしない。全角で打たれても黙って半角にする。
 * 実務では表計算ソフトから貼り付ける場面が多く、そこにカンマや空白が混ざるのも普通なので、
 * それも黙って落とす。
 */

/** 全角数字・全角記号・見た目だけ違うマイナス記号を、半角の対応する文字に置き換える */
const WIDE_TO_NARROW: Record<string, string> = {
  "．": ".",
  "。": ".",
  "，": ",",
  "、": ",",
  "＋": "+",
  "－": "-", // 全角ハイフンマイナス
  "ー": "-", // 長音符（テンキーの隣を押し間違えた場合）
  "−": "-", // 数学のマイナス記号
  "―": "-", // ダッシュ
  "‐": "-", // ハイフン
  "％": "%",
  "　": " ", // 全角空白
};

/**
 * 全角を半角に直し、意味を持たない文字（カンマ・空白・単位の%）を落とす。
 *
 * ここでは**数値として妥当かどうかは見ない**。
 * 「-」だけ、「1.」まで、「あ」などもそのまま残す（打っている途中かもしれないため）。
 */
export function normalizeNumericText(raw: string): string {
  let s = "";
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    // 全角数字（０-９）→ 半角数字
    if (code >= 0xff10 && code <= 0xff19) {
      s += String.fromCharCode(code - 0xfee0);
      continue;
    }
    s += WIDE_TO_NARROW[ch] ?? ch;
  }
  // 桁区切りのカンマ・空白・単位の % は、貼り付けで混ざりやすいので黙って落とす
  return s.replace(/[,\s%]/g, "");
}

/**
 * 打っている間に当てる正規化。
 *
 * 全角→半角だけを行い、形の判定はしない。
 * 変換後の文字数が変わらない置き換えしかしないので、カーソルの位置がずれない
 * （文字を足したり削ったりする処理は確定時にだけ行う）。
 */
export function normalizeWhileTyping(raw: string): string {
  let s = "";
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code >= 0xff10 && code <= 0xff19) {
      s += String.fromCharCode(code - 0xfee0);
      continue;
    }
    s += WIDE_TO_NARROW[ch] ?? ch;
  }
  return s;
}

export type NumberFieldPolicy = {
  /** マイナスを許すか（行動指針の点数のように -1 がある欄は true） */
  allowNegative?: boolean;
  /** 小数を許すか（既定は許す。件数・人数など整数だけの欄は false） */
  allowDecimal?: boolean;
  /** 下限・上限（あれば確定時に知らせる。勝手に丸めない） */
  min?: number;
  max?: number;
};

export type ParsedNumber =
  /** 空欄。0 とは意味が違うので、必ず区別して扱う */
  | { kind: "empty" }
  | { kind: "ok"; value: number; text: string }
  | { kind: "invalid"; reason: string };

/**
 * 確定時（欄から離れたとき・保存するとき）に数値として読む。
 *
 * **空欄は 0 にしない。** この仕組みでは空欄が「制限なし」を意味する欄があるため、
 * 0 に変換すると「0以上」という別の意味になってしまう。
 */
export function parseNumberInput(raw: string, policy: NumberFieldPolicy = {}): ParsedNumber {
  const s = normalizeNumericText(raw).trim();
  if (s === "") return { kind: "empty" };

  // 「+5」は「5」と同じ意味として受ける（表計算からの貼り付けに混ざる）
  const body = s.startsWith("+") ? s.slice(1) : s;
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(body)) {
    return { kind: "invalid", reason: "数字で入力してください。" };
  }

  const value = Number(body);
  if (!Number.isFinite(value)) return { kind: "invalid", reason: "数字で入力してください。" };

  if (value < 0 && !policy.allowNegative) {
    return { kind: "invalid", reason: "0以上の数字を入力してください。" };
  }
  if (policy.allowDecimal === false && !Number.isInteger(value)) {
    return { kind: "invalid", reason: "小数のない数字（整数）を入力してください。" };
  }
  if (policy.min !== undefined && value < policy.min) {
    return { kind: "invalid", reason: `${policy.min} 以上の数字を入力してください。` };
  }
  if (policy.max !== undefined && value > policy.max) {
    return { kind: "invalid", reason: `${policy.max} 以下の数字を入力してください。` };
  }

  /* 表示に戻す文字。「1.」「01」「.5」のような打ち方を数値として読み直した形にそろえる。
     Number 経由にすると 0.1+0.2 のような誤差は生まれない（文字を読むだけなので）。 */
  return { kind: "ok", value, text: String(value) };
}

/**
 * 欄から離れたときに表示へ戻す文字。
 *
 * 数値として読めなかったときは**打った内容をそのまま残す**（勝手に消さない）。
 * 消してしまうと、打ち間違いを直す手がかりごと失われる。
 */
export function formatOnBlur(raw: string, policy: NumberFieldPolicy = {}): string {
  const parsed = parseNumberInput(raw, policy);
  if (parsed.kind === "ok") return parsed.text;
  if (parsed.kind === "empty") return "";
  return normalizeNumericText(raw);
}

/**
 * KPIマスタの「入力チェック」の文言から、整数だけの設問かどうかを読む。
 *
 * 制度の正本はマスタ側の文言（「0以上の整数」「1以上の整数」「0より大きい数値」など）で、
 * そこには**もともと整数かどうかが書かれていた**。ただし文章として書かれていただけで、
 * 入力を止める力は持っていなかった。ここでその文言を判定に変える。
 *
 * 単位では判定しない。「円」は整数だが「%」は小数が要る（「0より大きい数値」）ため、
 * 単位で機械的に決めると、達成率のような小数が必要な設問を巻き込む。
 *
 * 読み取れないときは null を返す（勝手に整数だと決めない）。
 */
export function integerFromValidation(validation: string | null | undefined): boolean | null {
  const v = validation ?? "";
  if (v.includes("整数")) return true;
  // 「0より大きい数値」「小数」など、整数と書いていないものは小数を許す側に倒す
  if (v.includes("数値") || v.includes("小数")) return false;
  return null;
}

/**
 * 単位から「数え上げる欄かどうか」を推し量る（**最後の手段**）。
 *
 * マスタの文言が無い、手で作った設問のための既定値でしかない。
 * 分からない単位は false（小数を許す）に倒す。分からないものを止めると、
 * 打てるはずの値が打てなくなり、原因も画面から読み取れないため。
 */
const COUNTING_UNITS = ["件", "人", "回", "個", "日", "項目", "人日", "名", "台", "枚", "冊", "円", "箇所", "か所"];

export function unitImpliesInteger(unit: string | null | undefined): boolean {
  const u = (unit ?? "").trim();
  if (u === "") return false;
  return COUNTING_UNITS.includes(u);
}

/**
 * 設問を作るときの「整数だけ」の既定値。
 * マスタの文言が正、無ければ単位から推し量る。どちらでも決まらなければ小数を許す。
 */
export function defaultIntegerFlag(source: { validation?: string | null; unit?: string | null }): boolean {
  const fromText = integerFromValidation(source.validation);
  if (fromText !== null) return fromText;
  return unitImpliesInteger(source.unit);
}

/**
 * アンケートの設問から、その欄の数値の決まりを作る。
 *
 * 画面と受け口（サーバー）の両方でこれを使う。別々に書くと、画面では通るのに
 * 保存されない（またはその逆の）ずれが生まれるため。
 */
export function questionNumberPolicy(question: {
  validationMin: number | null;
  validationMax: number | null;
  validationInteger?: boolean | null;
}): NumberFieldPolicy {
  return {
    // 設問に下限が無いときだけ、マイナスを受け付ける（下限が 0 や 1 なら自動的に断られる）
    allowNegative: question.validationMin === null || question.validationMin < 0,
    allowDecimal: question.validationInteger ? false : undefined,
    min: question.validationMin ?? undefined,
    max: question.validationMax ?? undefined,
  };
}

/** 数値の設問の下に出す一言（何を打てばよいかを、押す前に伝える） */
export function numberInputHint(question: {
  validationMin: number | null;
  validationMax: number | null;
  validationInteger?: boolean | null;
}): string {
  const parts: string[] = [];
  if (question.validationMin !== null && question.validationMax !== null) {
    parts.push(`${question.validationMin}以上${question.validationMax}以下`);
  } else if (question.validationMin !== null) {
    parts.push(`${question.validationMin}以上`);
  } else if (question.validationMax !== null) {
    parts.push(`${question.validationMax}以下`);
  }
  parts.push(question.validationInteger ? "の整数を入力してください" : "の数字を入力してください");
  if (parts.length === 1) return question.validationInteger ? "整数を入力してください" : "";
  return parts.join("");
}

/**
 * 提出された数値の回答が、その設問の決まりに収まっているか（受け口の側の検査）。
 *
 * 画面の制限だけでは、画面を通さずに送られたときに素通りする。
 * **入力途中の下書きには当てない。**打っている最中に「保存できません」と言われると、
 * 何が起きたのか分からないまま入力を止めることになるため、提出のときだけ見る。
 *
 * すでに保存済みの回答は読み直さない（この検査は「これから受け取る値」にだけ当てる）。
 */
export function checkAnswerNumbers(
  rows: {
    title: string;
    validationMin: number | null;
    validationMax: number | null;
    validationInteger?: boolean | null;
    unit?: string | null;
    value: number | null;
  }[],
): { ok: true } | { ok: false; message: string } {
  for (const row of rows) {
    // 未入力はここで見ない（必須かどうかの判定は別に行われている）
    if (row.value === null) continue;
    if (!Number.isFinite(row.value)) {
      return { ok: false, message: `「${row.title}」は数字で入力してください。` };
    }
    if (row.validationInteger && !Number.isInteger(row.value)) {
      /* 勝手に丸めない。丸めると、打った値と保存される値が食い違い、
         あとから見たときにどちらが本当なのか誰にも分からなくなる。 */
      const unitNote = row.unit ? `（単位は「${row.unit}」）` : "";
      return {
        ok: false,
        message: `「${row.title}」は小数のない数字（整数）で入力してください${unitNote}。`,
      };
    }
    if (row.validationMin !== null && row.value < row.validationMin) {
      return { ok: false, message: `「${row.title}」は ${row.validationMin} 以上の数字を入力してください。` };
    }
    if (row.validationMax !== null && row.value > row.validationMax) {
      return { ok: false, message: `「${row.title}」は ${row.validationMax} 以下の数字を入力してください。` };
    }
  }
  return { ok: true };
}

/**
 * 下限・上限の組が矛盾していないか。
 *
 * この仕組みでは「下限はその値を含む／上限はその値を含まない」ため、
 * 下限と上限が同じ値だと、当てはまる値が1つも無い空っぽの範囲になる。
 */
export function checkBounds(
  lower: number | null,
  upper: number | null,
): { ok: true } | { ok: false; message: string } {
  if (lower === null || upper === null) return { ok: true };
  if (lower > upper) {
    return { ok: false, message: `下限（${lower}）が上限（${upper}）より大きくなっています。` };
  }
  if (lower === upper) {
    return {
      ok: false,
      message: `下限と上限が同じ（${lower}）です。上限はその値を含まないため、当てはまる値がありません。`,
    };
  }
  return { ok: true };
}
