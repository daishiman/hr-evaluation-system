import { followTargetsOf, type FollowKind } from "@/lib/domain/settings-follow";

/** 保存前の範囲説明。保存後の実績は followMessage に任せ、追従先の判定はドメインと共有する。 */
export function SettingsFollowScope({ kinds }: { kinds: readonly FollowKind[] }) {
  const { forms, evaluations } = followTargetsOf(kinds);
  if (!forms && !evaluations) return null;

  return (
    <div className="grid gap-1">
      {forms && (
        <>
          <p className="m-0">設問に関わる変更は、回答の無い下書きに反映します。</p>
          <p className="m-0">回答のある公開中のアンケートには、次の版の下書きを作ります。内容を確かめてから公開してください。</p>
          <p className="m-0">締め切った期のアンケートは変更しません。</p>
        </>
      )}
      {evaluations && <p className="m-0">配点・判定基準の変更では、確定前の評価を集計し直します。上司のコメントと判断は残ります。</p>}
      <p className="m-0">
        {forms ? "公開済みの設問と確定済みの評価は、そのまま残ります。" : "確定済みの評価は、そのまま残ります。"}
      </p>
      {forms && !evaluations && <p className="m-0">既存の評価は集計し直しません。</p>}
    </div>
  );
}
