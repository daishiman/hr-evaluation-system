/**
 * 設定不足の示し方（S9・A8）。
 *
 * 準備の確認・制度の手順・公開や受付開始の 409 の理由・アンケートの同期は、文1つではなく
 * 「何が足りないか（what）」「どう直すか（how）」「直す画面（href と linkLabel）」の組で返す。
 * 文だけだと、読んだ人がどの画面で何を直せばよいかを探すことになるため。
 *
 * リンク先は台帳（system-spec/route-ledger.json）にある画面に限る。パスは画面ごとに書き起こさず、
 * 手順のパスは scheme-steps.ts の schemeStepPath から作る。
 * 区分（pointGroup）の英語名は文に出さず、等級名の呼び名（grade-label.ts）で言う。
 */

import { comparisonGapOf, REBUILD_LABEL, type ComparisonGap, type ComparisonGapInput } from "./comparison-gap";
import type { StaleAsking } from "./form-sync";
import { pointGroupLabel, type GradeLike } from "./grade-label";
import { kpiItemPath, schemeStepPath } from "./scheme-steps";

export interface SetupGap {
  /** 何が足りないか */
  what: string;
  /** どう直すか */
  how: string;
  /** 直す画面のパス（台帳にある画面） */
  href: string;
  /** リンクの文字。リンク先で何をするかが分かる言葉にする */
  linkLabel: string;
}

/** 評価セットの手順の進み具合（computeGroupProgress の一部） */
export interface SchemeGroupState {
  pointGroup: string;
  selectionDone: boolean;
  criteriaDone: boolean;
  /** 手順の画面が出す「次にやること」。あれば直し方に使う */
  nextAction?: string;
}

const SCHEME_PATH = "/admin/scheme";
const SCHEME_LINK = "KPI・評価セットを開く";

/** 評価セットの準備で足りないもの。等級の区分ごとに、いま止まっている手順を1件ずつ出す */
export function schemeGaps(
  input: { hasScheme: boolean; groups: readonly SchemeGroupState[] },
  grades: readonly GradeLike[],
): SetupGap[] {
  if (!input.hasScheme) {
    return [
      {
        what: "有効な評価セットがありません。",
        how: "評価セットは会社の初期データから作られます。初期データの投入が済んでいるかを確かめてください。",
        href: SCHEME_PATH,
        linkLabel: SCHEME_LINK,
      },
    ];
  }
  if (input.groups.length === 0) {
    return [
      {
        what: "等級ごとの配点ルールがありません。",
        how: "配点ルールは会社の初期データから作られます。初期データの投入が済んでいるかを確かめてください。",
        href: SCHEME_PATH,
        linkLabel: SCHEME_LINK,
      },
    ];
  }
  return input.groups.flatMap((group): SetupGap[] => {
    if (group.criteriaDone) return [];
    const label = pointGroupLabel(group.pointGroup, grades);
    if (!group.selectionDone) {
      return [
        {
          what: `${label}の評価に使うKPIを選び終わっていません。`,
          how: group.nextAction ?? "決まりどおりの件数と配点の合計になるようにKPIを選び、保存してください。",
          href: schemeStepPath(group.pointGroup, "select"),
          linkLabel: `${label}のKPIを選ぶ`,
        },
      ];
    }
    return [
      {
        what: `${label}で選んだKPIに、基準（A〜E）が決まっていない項目があります。`,
        how: `${group.nextAction ?? ""}選んだ項目ごとに、実績値の範囲でA〜Eを決めて保存してください。`,
        href: schemeStepPath(group.pointGroup, "criteria"),
        linkLabel: `${label}の基準を決める`,
      },
    ];
  });
}

/** 回答の受付を始める前に足りないもの。評価セットの不足はそのまま引き継ぐ */
export function cycleOpenGaps(input: {
  schemeGaps: readonly SetupGap[];
  publishedFormCount: number;
  /** 分かっていれば、その評価期間のアンケートを開くリンクにする */
  cycleId?: string;
}): SetupGap[] {
  const gaps = [...input.schemeGaps];
  if (input.publishedFormCount < 1) {
    gaps.push({
      what: "公開しているアンケートがありません。",
      how: "アンケートを作り、内容を確かめて1件以上公開してください。そのあとで受付を始めます。",
      href: input.cycleId ? `/admin/forms?cycle=${encodeURIComponent(input.cycleId)}` : "/admin/forms",
      linkLabel: "アンケートを開く",
    });
  }
  return gaps;
}

/** アンケートを公開する前に足りないもの。評価セットの不足を先に出す */
export function formPublicationGaps(input: {
  schemeGaps: readonly SetupGap[];
  cycleStatus: string;
  questionCount: number;
  formId: string;
  /** 版の設問が、いまの計算式の変数をそろえていない項目（form-sync.ts の staleAskingItems） */
  staleAsking: readonly StaleAsking[];
}): SetupGap[] {
  const gaps = [...input.schemeGaps];
  if (input.cycleStatus !== "planning" && input.cycleStatus !== "open") {
    gaps.push({
      what: "この評価期間は締め切り済みのため、アンケートを公開できません。",
      how: "公開するには、評価期間の画面で回答の受付をもう一度始めてください。",
      href: "/admin/cycles",
      linkLabel: "評価期間を開く",
    });
  }
  if (input.questionCount < 1) {
    gaps.push({
      what: "設問が1問もありません。",
      how: "設問を1問以上追加してから公開してください。",
      href: formPath(input.formId),
      linkLabel: "設問を編集する",
    });
  }
  return [...gaps, ...staleAskingGaps(input.staleAsking, input.formId)];
}

/**
 * 版の設問が式と合わない項目（DD-016）。KPI項目で直すものを先に、項目ごとに出す。
 * 作り直せば直るものは、アンケートの画面の1回の操作で済むのでまとめて1件にする。設問の key は人に見せない。
 */
function staleAskingGaps(items: readonly StaleAsking[], formId: string): SetupGap[] {
  const atItem = items.filter((item) => !item.rebuildFixes).map((item) => ({
    what: `「${item.name}」の計算式が、いまの聞き方と合っていません。`,
    how: "作り直しても点が付きません。KPI項目の画面で聞き方か計算式を直し、そのあと設問を作り直してください。",
    href: kpiItemPath(item.kpiItemId),
    linkLabel: `「${item.name}」の聞き方を直す`,
  }));
  const rebuildable = items.filter((item) => item.rebuildFixes).map((item) => item.name);
  if (rebuildable.length === 0) return atItem;
  return [
    ...atItem,
    {
      what: `「${rebuildable.join("」「")}」の設問が、いまの聞き方と合っていません。`,
      how: `このまま公開すると、その項目には点が付きません。アンケートの画面で「${REBUILD_LABEL}」を押してください。`,
      href: formPath(formId),
      linkLabel: "設問を作り直す",
    },
  ];
}

/**
 * 評価セットとアンケートの比べ（DD-012 の6）。
 * 比べる警告は2つのページと直す操作1つの組（ComparisonGap）で返し、SetupGap の形では返さない。
 * 文を書き起こすと、画面ごとに別の言い方の警告が増えるため。中身は comparisonGapOf を呼ぶだけ。
 * 呼ぶのは comparison-gap-loader.ts だけで、3画面はその読み出しを通す（画面からは直接呼ばない）。
 */
export function formSyncGaps(input: ComparisonGapInput): ComparisonGap | null {
  return comparisonGapOf(input);
}

/** 基準を変えたあと集計し直していない評価期間（impact.ts の detectStaleCycles の結果） */
export function staleCycleGaps(
  cycles: readonly { cycleId: string; cycleName: string; recomputable: number; finalized: number }[],
): SetupGap[] {
  return cycles
    .filter((cycle) => cycle.recomputable > 0)
    .map((cycle) => ({
      what:
        `${cycle.cycleName}：確認中 ${cycle.recomputable}件が古い基準のままです` +
        (cycle.finalized > 0 ? `（確定済み ${cycle.finalized}件は当時の基準のまま据え置き）。` : "。"),
      how: "確認中の評価だけを、現在の基準で集計し直せます。",
      href: `/manager/cycles?cycle=${encodeURIComponent(cycle.cycleId)}`,
      linkLabel: "集計し直す",
    }));
}

/**
 * サーバー処理の失敗（{ ok: false, message }）に載せる要約。
 * 応答の形は変えないので、先頭の1件の「何が・どう直す」と、残りの件数を1文にまとめる。
 */
export function gapsMessage(gaps: readonly SetupGap[]): string {
  if (gaps.length === 0) return "";
  const [first] = gaps;
  const rest = gaps.length - 1;
  return `${first.what}${first.how}${rest > 0 ? `（ほかに${rest}件の不足があります）` : ""}`;
}

function formPath(formId: string): string {
  return `/admin/forms/${encodeURIComponent(formId)}`;
}
