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

import type { FormKpiDiff } from "./form-sync";
import { pointGroupLabel, type GradeLike } from "./grade-label";
import { schemeStepPath } from "./scheme-steps";

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
  return gaps;
}

/**
 * 評価セットとアンケートのずれ（form-sync.ts の diffFormKpiItems の結果）。
 * 欠落と余分をそれぞれ1件にする。nameOf は項目名の引き当て。
 * 回答済みのアンケートは書き換えないので、直し方は「作り直す」か「新しい版」のどちらか。
 */
export function formSyncGaps(diff: FormKpiDiff, nameOf: (id: string) => string, formId: string): SetupGap[] {
  const names = (ids: readonly string[]) => ids.map((id) => `「${nameOf(id)}」`).join("・");
  const gaps: SetupGap[] = [];
  if (diff.missing.length > 0) {
    gaps.push({
      what: `${names(diff.missing)}を評価に使うKPIに選んでいますが、このアンケートでは実績を聞いていません。このままでは判定外になり、配点ぶんの点が付きません。`,
      how: "回答がまだ無い下書きなら、設問を作り直すと揃います。公開後のアンケートは書き換えないため、新しい版を作って公開してください。",
      href: formPath(formId),
      linkLabel: "このアンケートを開く",
    });
  }
  if (diff.extra.length > 0) {
    gaps.push({
      what: `${names(diff.extra)}を聞いていますが、いまの評価セットでは使いません。`,
      how: "回答がまだ無い下書きなら、設問を作り直すと外れます。公開後のアンケートは書き換えないため、次の版で外してください。",
      href: formPath(formId),
      linkLabel: "このアンケートを開く",
    });
  }
  return gaps;
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
