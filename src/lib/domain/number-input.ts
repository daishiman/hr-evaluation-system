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
 * アンケートの設問から、その欄の数値の決まりを作る。
 *
 * 画面と受け口（サーバー）の両方でこれを使う。別々に書くと、画面では通るのに
 * 保存されない（またはその逆の）ずれが生まれるため。
 *
 * **整数だけを求めるかどうかは、いまの設問の作りに存在しない。**
 * 「件」「人」のように数え上げる単位でも小数を止められないので、ここでは小数を許す。
 * （残課題：設問に「整数だけ」の印を持たせる）
 */
export function questionNumberPolicy(question: {
  validationMin: number | null;
  validationMax: number | null;
}): NumberFieldPolicy {
  return {
    // 設問に下限が無いときだけ、マイナスを受け付ける（下限が 0 や 1 なら自動的に断られる）
    allowNegative: question.validationMin === null || question.validationMin < 0,
    min: question.validationMin ?? undefined,
    max: question.validationMax ?? undefined,
  };
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
  rows: { title: string; validationMin: number | null; validationMax: number | null; value: number | null }[],
): { ok: true } | { ok: false; message: string } {
  for (const row of rows) {
    // 未入力はここで見ない（必須かどうかの判定は別に行われている）
    if (row.value === null) continue;
    if (!Number.isFinite(row.value)) {
      return { ok: false, message: `「${row.title}」は数字で入力してください。` };
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
