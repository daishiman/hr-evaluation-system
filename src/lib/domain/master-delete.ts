/**
 * 制度設定の項目を「完全に消してよいか」を決める文言と判定。
 *
 * 制度設定には、利用者が自分で足せる項目がある（行動指針の基準セット・観点、
 * 等級要件、昇格要件）。足せるのに消せないと、試しに作った項目が一覧に残り続ける。
 *
 * ただし何でも消せるようにはできない。公開したアンケートと確定済みの評価は、
 * この項目を指したまま残っている。指されている行を消すと、過去のアンケートと
 * 評価の中身が変わってしまう（=1文字も変えない、という約束が破れる）。
 *
 * そこで線を1本だけ引く:
 *   - 一度もアンケートに出しておらず、評価の記録にも残っていない → 完全に消せる
 *   - 一度でも使った → 消せない。従来どおり「使わない」で今後の出題から外す
 *
 * この判定は必ずサーバー側で行う（画面のボタンの出し分けだけに頼らない）。
 * 画面と API が同じ文言・同じ基準で判断できるよう、ここに集約している。
 */

/** 使っている場所を名指しする件数。全部並べると読めなくなるので先頭2件+件数にする。 */
const NAMED_PLACES = 2;

/** 「アンケート「◯◯」・確定済みの評価 ほか2件」の形にする。 */
export function placesText(usedBy: readonly string[]): string {
  const named = usedBy.slice(0, NAMED_PLACES).join("・");
  const rest = usedBy.length - NAMED_PLACES;
  return rest > 0 ? `${named} ほか${rest}件` : named;
}

/* ───────────── 画面に出す形（引き算してから足し直す） ─────────────
 *
 * 2026-08-12、発注者から赤枠で名指しの指摘。等級要件の一覧の全行に
 * 同じ長い1文が出て、一覧が文字で埋まっていた。元の文はこれ:
 *
 *   アンケート「A」・アンケート「B」ほか2件で使っているため、完全には
 *   消せません。「使わない」なら次のアンケートから外せます。
 *
 * 1文に3つのことが入っている（①使っている場所の列挙 ②消せない理由
 * ③代わりの手段）。しかも②③は**どの行でも全く同じ文**なので、
 * 項目数ぶん繰り返して出す意味が無い。
 *
 * そこで、行にいま要るものだけを残して引き算する:
 *   行に残す … 「使用中（◯件）」という事実だけ（BLOCKED_MARK）
 *   押すと出る … その行がどこで使われているか（行ごとに違う）
 *   1か所にまとめる … 消せない理由と代わりの手段（全行で同じ）
 *
 * 情報は1つも減らしていない。置き場所と、出るきっかけを変えただけ。
 */

/** 行に残す一言。ここだけは畳まない（「消せない」という事実そのものだから）。 */
export function blockedMark(usedBy: readonly string[]): string | null {
  return usedBy.length === 0 ? null : `使用中（${usedBy.length}件）`;
}

/** 全行で同じ内容なので、行ではなくカードの下に1か所だけ置く。 */
export const BLOCKED_WHY = "一度でもアンケートに出した項目は、完全には消せません。";
export const BLOCKED_WHAT = "「使わない」にすると、次のアンケートから外せます。";
export const BLOCKED_KEEP = "公開したアンケートと確定済みの評価を変えないためです。";

/** 畳んだ説明を開く場所の文言（全画面で同じにする）。 */
export const BLOCKED_HELP_LABEL = "「使用中」の項目を消せない理由";

/**
 * 消せないときに API が返す文。消してよいときは null。
 * 画面では上の3つに分けて出すが、サーバーの返事は1本の文字列なので
 * ここで組み立てる。1文ずつが40文字以内に収まっていること。
 */
export function deleteBlockedReason(usedBy: readonly string[]): string | null {
  if (usedBy.length === 0) return null;
  /* 画面では畳む「使っている場所」も、API の返事には残す。
     画面を経由せずに拒否されたときの唯一の手がかりになるため。 */
  return `${BLOCKED_WHY}${BLOCKED_WHAT}使用中：${placesText(usedBy)}。`;
}

/**
 * 基準セットを消せない理由。
 * 等級への割り当てが残っているときは、そちらを先に外す順番を示す
 * （「使用を止める」ときと同じ順番にそろえる）。
 */
export const BAND_SET_ASSIGNED_NEXT = "先に「どの等級に出すか」を変えてから操作してください。";

export function bandSetBlockedReason(gradeNames: readonly string[], usedBy: readonly string[]): string | null {
  if (gradeNames.length > 0) {
    /* 1文に「今どうなっているか」と「何をすればよいか」を詰めない。2文に分ける。

       等級名の並びは、画面では行の中にすでに出ているので繰り返さない
       （画面側は BAND_SET_ASSIGNED_NEXT だけを出す）。
       ここで名前を残しているのは、画面を経由せず API を直に叩いて断られた人のため。
       等級が増えるほどこの1文は伸びるが、読み手は機械ではなく人なので、
       名前を落として「どこかで使われています」だけにするほうが害が大きい。 */
    return `この基準は ${gradeNames.join("・")} に出す設定です。${BAND_SET_ASSIGNED_NEXT}`;
  }
  return deleteBlockedReason(usedBy);
}

/** 消す前の確認文。何が消えて、何が残るかを書く。 */
export function deleteConfirmText(name: string, alsoRemoved?: string): string {
  /* 取り返しのつかない操作の警告なので、ここは畳まない（§22-4）。
     ただし1文に詰めず、①何をするか ②戻せないこと ③何が残るか に分ける。 */
  return (
    `「${name}」を完全に消します。元に戻せません。` +
    (alsoRemoved ? `${alsoRemoved}` : "") +
    "一度もアンケートに出していない項目です。公開したアンケートと確定済みの評価は変わりません。"
  );
}

/** 消せる状態の項目に付けるボタンの文言（全画面で同じにする）。 */
export const DELETE_LABEL = "完全に消す";

/**
 * KPIカテゴリを消せない理由。
 *
 * 観点・要件と違って「一度でもアンケートに出した」ではなく「KPI項目の分類として
 * すでに使われている」が線引きになるため、文言だけ別に持つ。判定そのもの
 * （使っているかどうかの数え方）は master-usage.ts の kpiCategoryUsage が正本。
 */
export const KPI_CATEGORY_BLOCKED_WHY = "すでに使われているカテゴリは、完全には消せません。";
export const KPI_CATEGORY_BLOCKED_KEEP = "確定済みの評価と、すでに組んだ評価セットを変えないためです。";

export function kpiCategoryBlockedReason(usedBy: readonly string[]): string | null {
  if (usedBy.length === 0) return null;
  return `${KPI_CATEGORY_BLOCKED_WHY}使用中：${placesText(usedBy)}。`;
}

/** KPIカテゴリを消す前の確認文。 */
export function kpiCategoryDeleteConfirmText(name: string): string {
  return `「${name}」を完全に消します。元に戻せません。どのKPI項目でも一度も使われていないカテゴリです。`;
}
