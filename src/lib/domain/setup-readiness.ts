type GroupState = { pointGroup: string; done: boolean; nextAction: string };

/** setup/dashboard/APIが同じ評価セット完了条件を使うための正本。 */
export function setupReadiness(input: { hasScheme: boolean; groups: GroupState[] }) {
  const incomplete = input.groups.find((group) => !group.done);
  const schemeReady = input.hasScheme && input.groups.length > 0 && !incomplete;
  return {
    schemeReady,
    schemeMessage: !input.hasScheme
      ? "有効な評価セットがありません。"
      : input.groups.length === 0
        ? "等級区分ごとの配点ルールがありません。"
        : incomplete
          ? `${incomplete.pointGroup}: ${incomplete.nextAction}`
          : "全等級区分のKPI選択と基準設定が完了しています。",
  };
}

export function cycleOpenReadiness(input: { schemeReady: boolean; publishedFormCount: number }) {
  if (!input.schemeReady) return { ready: false, message: "KPI・評価セットの設定を完了してください。" };
  if (input.publishedFormCount < 1) return { ready: false, message: "アンケートを1件以上公開してから回答の受付を始めてください。" };
  return { ready: true, message: "回答の受付を開始できます。" };
}

export function formPublicationReadiness(input: {
  schemeReady: boolean;
  cycleStatus: string;
  questionCount: number;
}) {
  if (!input.schemeReady) return { ready: false, message: "KPI・評価セットの設定を完了してください。" };
  if (input.cycleStatus !== "planning" && input.cycleStatus !== "open") {
    return { ready: false, message: "締め切り済みの評価期間ではアンケートを公開できません。" };
  }
  if (input.questionCount < 1) return { ready: false, message: "設問を1問以上追加してから公開してください。" };
  return { ready: true, message: "アンケートを公開できます。" };
}
