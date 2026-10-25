import Link from "next/link";
import type { ReactNode } from "react";
import { DefList, Disclosure, PageTitle } from "@/components/ui";
import { SettingsFollowScope } from "@/components/SettingsFollowScope";
import { bandRuns, bandSplits } from "@/lib/domain/behavior-band-range";
import {
  DEFAULT_BEHAVIOR_BAND,
  bandAssignmentName,
  describeBandAssignment,
  type BandAssignmentGrade,
  type BandAssignmentSet,
} from "@/lib/domain/behavior-default-assignment";

/**
 * 行動指針の画面の冒頭（DD-027 の4）。
 *
 * 開いた直後に読ませるのは、1文と、まとまりの状態（数・飛び飛びの有無）の札だけ。
 * 理由・初期設定・点数の決まりは、開く注記の1か所にまとめる。以前は冒頭の3文に加えて、
 * 割り当て・まとまり・観点の部品がそれぞれ反映範囲の説明を繰り返していた。
 *
 * 初期設定の説明は固定の文にせず、いまの割り当てから作る（DD-026 の9）。
 * 既定と違う等級があれば、閉じたままでも札にその数を出し、開けば等級ごとの違いを示す。
 */
export function BehaviorIntro({
  tags,
  grades,
  sets,
}: {
  /** 見出しの札の先頭に置くもの（編集中の等級） */
  tags?: ReactNode;
  /** 会社の等級を全部（使用を止めた等級も） */
  grades: readonly BandAssignmentGrade[];
  /** まとまりは保存した名前のまま、画面の並び順で渡す（bandAssignmentName を参照） */
  sets: readonly BandAssignmentSet[];
}) {
  const summary = describeBandAssignment(grades, sets);
  /* 既定の分け方の文も同じ関数で作る（既定と違う等級だけ、既定のまとまりに置き換える） */
  const asDefault = grades.map((g) =>
    Object.hasOwn(DEFAULT_BEHAVIOR_BAND, g.code) ? { ...g, behaviorBand: DEFAULT_BEHAVIOR_BAND[g.code] } : g,
  );
  const defaultSentence = describeBandAssignment(asDefault, sets).sentence;
  const shown = bandRuns(grades).filter((run) => run.band !== null).length;
  const split = bandSplits(grades).length > 0;
  const hasGrades = grades.some((g) => g.isActive);

  return (
    <>
      <PageTitle
        title="行動指針"
        lede="アンケートで問う行動指針と、出す等級を決めます。"
        tags={
          <>
            {tags}
            {hasGrades && (
              <>
                <span className="tag">まとまり {shown}つ</span>
                <span className="tag">{split ? "飛び飛びあり" : "飛び飛びなし"}</span>
              </>
            )}
          </>
        }
      />
      <div className="mb-3">
        <Disclosure
          summary="行動指針の決まりと初期設定"
          meta={summary.matchesDefault ? "既定どおり" : `既定と違う等級 ${summary.differences.length}つ`}
        >
          <SettingsFollowScope kinds={["behaviorGuideline"]} />
          <p className="m-0 mt-1">観点の呼び名は、そのままアンケートの設問になります。</p>
          <p className="m-0 mt-1">同じ行動指針は、等級の並びで続いた等級にだけ出せます。</p>
          <div className="mt-3">
            <DefList
              rows={[
                { label: "いまの分け方", value: summary.sentence },
                ...(summary.matchesDefault
                  ? []
                  : [
                      { label: "既定の分け方", value: defaultSentence },
                      {
                        label: "既定と違う等級",
                        value: (
                          <ul className="m-0 list-disc pl-5">
                            {summary.differences.map((d) => (
                              <li key={d.code}>
                                {`${d.name}：既定は${bandAssignmentName(sets, d.expected)}、いまは${bandAssignmentName(sets, d.actual)}`}
                              </li>
                            ))}
                          </ul>
                        ),
                      },
                    ]),
              ]}
            />
          </div>
          <p className="m-0 mt-3">点数（模範3・信頼2・安定1・不安定0・悪影響-1）は変えられません。</p>
          <p className="m-0 mt-1">会社ごとに変えられるのは、各段階の姿の文章です。</p>
          <p className="m-0 mt-1">
            昇格に必要な合計点は
            <Link href="/admin/masters/promotion" className="mx-1 text-brand-deep">
              昇格の条件・要件
            </Link>
            で決めます。
          </p>
        </Disclosure>
      </div>
    </>
  );
}
