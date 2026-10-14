import Link from "next/link";
import { requireRoute } from "@/lib/session";
import { listBehaviorBandSets, listBehaviorGuidelines, listGrades } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { bandSetUsedBy, behaviorGuidelineUsage } from "@/lib/master-usage";
import { BehaviorBandAssignmentEditor } from "@/components/BehaviorBandAssignmentEditor";
import { BehaviorBandSetEditor } from "@/components/BehaviorBandSetEditor";
import { BehaviorGuidelineEditor } from "@/components/BehaviorGuidelineEditor";
import { gradesUsingBand } from "@/lib/domain/behavior";
import { bandSetLabel, DEFAULT_GRADE_NAMES, gradeLabel } from "@/lib/domain/grade-label";
import { bandRuns, bandSplitMessage, bandSplits } from "@/lib/domain/behavior-band-range";
import { ChipLink, Disclosure, EmptyState, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

/** 等級タブ・基準セットの切り替えのリンク。選んでいるもう一方（等級か基準セット）は引き継ぐ */
function behaviorHref({ grade, band }: { grade?: string; band?: string | null }): string {
  const params = new URLSearchParams();
  if (grade) params.set("grade", grade);
  if (band) params.set("band", band);
  return `/admin/behavior?${params}`;
}

/**
 * 行動指針だけを扱う画面。
 *
 * この画面が持つ責務はひとつ:「行動指針として何を問い、どの等級に出すか」。
 * 等級そのものの設定や昇格の条件は別の画面にある（一緒に置くと、直したい設定が
 * どの画面にあるか毎回探すことになる）。
 *
 * 点数の重み（模範3〜悪影響-1）と、昇格に必要な合計点は、ここでは変えられない。
 * 前者は制度の骨格、後者は「昇格の条件」の設定なので、それぞれの持ち場で決める。
 */
export default async function AdminBehavior({
  searchParams,
}: {
  searchParams: Promise<{ band?: string; grade?: string }>;
}) {
  const viewer = await requireRoute("/admin/behavior");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const [guidelines, grades, bandSets] = await Promise.all([
    listBehaviorGuidelines(companyId),
    listGrades(companyId),
    listBehaviorBandSets(companyId),
  ]);

  /* 「完全に消せるか」を画面で出し分けるための材料。判定そのものは API 側でも必ず行う。 */
  const usage = await behaviorGuidelineUsage(await getDb(), companyId);

  /* 画面に出す基準は会社の設定（behavior_band_sets）が正本。
     観点が1件も無いセットも出さないと、作った直後のセットが画面から消える。 */
  const bands = bandSets.map((set) => set.code);
  const sp = await searchParams;
  const band = bands.includes(sp.band ?? "") ? (sp.band as string) : (bands[0] ?? null);
  /* 「昇格の条件・要件」画面（/admin/masters/promotion）と同じ、等級タブで1等級ずつ編集する作法。 */
  const selectedGrade = grades.find((g) => g.id === sp.grade) ?? grades[0] ?? null;
  /* 等級に割り当てられるのは「使う設定になっていて、問う内容が1件以上ある」基準だけ。
     空のセットを割り当てると、行動指針の設問が黙って0件のアンケートができる。 */
  const assignableBands = bandSets
    .filter((set) => set.isActive && guidelines.some((g) => g.band === set.code && g.isActive))
    .map((set) => set.code);

  /* 基準セットの呼び名は保存した名前ではなく、割り当てた等級の名前から作る（「等級1・等級2向け」）。
     下の部品へはこの呼び名を name として渡す。 */
  const labeledSets = bandSets.map((set) => ({ ...set, name: bandSetLabel(set, grades) }));

  /* 同じ基準セットは、等級の並びで続いた等級にだけ出す（§28-12・DD-010）。
     等級タブを「同じ行動指針が出るまとまり」ごとに囲み、全体の分け方を1か所で見せる。 */
  const lineGrades = grades.map((g) => ({
    id: g.id,
    name: gradeLabel(g),
    displayOrder: g.displayOrder,
    isActive: g.isActive,
    behaviorBand: g.behaviorBand,
  }));
  const runs = bandRuns(lineGrades);
  const splits = bandSplits(lineGrades);
  const splitBands = new Set(splits.map((split) => split.band));
  const stoppedGrades = lineGrades.filter((g) => !g.isActive);
  const aspectCountOf = (code: string) => guidelines.filter((g) => g.band === code && g.isActive).length;
  /* 初期の分け方の説明に、会社のいまの等級名を使う（無ければ既定の名前） */
  const nameByCode = (code: keyof typeof DEFAULT_GRADE_NAMES) =>
    gradeLabel(grades.find((g) => g.code === code) ?? { name: DEFAULT_GRADE_NAMES[code] });

  const rows = guidelines.map((g) => ({
    id: g.id,
    band: g.band,
    aspect: g.aspect,
    aspectName: g.aspectName,
    seq: g.seq,
    isActive: g.isActive,
    levels: g.levels.map((l) => ({ id: l.id, score: l.score, label: l.label, text: l.text })),
  }));

  return (
    <>
      <PageTitle
        title="行動指針"
        lede="アンケートで問う行動指針の中身と、どの等級に出すかを決めます。変更は次に作るアンケートから反映されます。すでに公開したアンケートと確定済みの評価は動きません。"
        tags={selectedGrade && <span className="tag">編集中の等級 {selectedGrade.name}</span>}
      />

      <SectionHeading>等級を選ぶ</SectionHeading>
      {grades.length === 0 ? (
        <EmptyState title="等級が登録されていません" body="先に等級を登録してください。" />
      ) : (
        <>
          {splits.map((split) => (
            <div key={split.band} role="alert" className="mb-3">
              <ReasonNote>
                いまの分け方は飛び飛びです。{bandSplitMessage(split)}
                端の等級か、あいだの等級の割り当てを変えて、続いた並びに直してください。
              </ReasonNote>
            </div>
          ))}
          <ol className="m-0 mb-5 flex list-none flex-wrap gap-3 p-0" aria-label="等級と、出す行動指針の分け方">
            {runs.map((run) => {
              const split = run.band !== null && splitBands.has(run.band);
              return (
                <li
                  key={run.grades[0].id}
                  className={
                    split
                      ? "rounded-lg border border-caution-border bg-caution-soft px-3 py-2"
                      : "rounded-lg border border-line px-3 py-2"
                  }
                >
                  <span className="block text-note text-ink-muted">
                    {run.band === null
                      ? "行動指針を出さない"
                      : `同じ行動指針（観点${aspectCountOf(run.band)}件）${split ? "・飛び飛び" : ""}`}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-2">
                    {run.grades.map((g) => (
                      <ChipLink
                        key={g.id}
                        href={behaviorHref({ grade: g.id, band })} current={g.id === selectedGrade?.id}
                      >
                        {g.name}
                      </ChipLink>
                    ))}
                  </span>
                </li>
              );
            })}
            {stoppedGrades.length > 0 && (
              <li className="rounded-lg border border-dashed border-line px-3 py-2">
                <span className="block text-note text-ink-muted">使用を止めた等級（アンケートに出ない）</span>
                <span className="mt-1 flex flex-wrap gap-2">
                  {stoppedGrades.map((g) => (
                    <ChipLink
                      key={g.id}
                      href={behaviorHref({ grade: g.id, band })} current={g.id === selectedGrade?.id}
                    >
                      {g.name}
                    </ChipLink>
                  ))}
                </span>
              </li>
            )}
          </ol>
          {selectedGrade && (
            <BehaviorBandAssignmentEditor
              key={selectedGrade.id}
              grade={{ id: selectedGrade.id, name: selectedGrade.name, behaviorBand: selectedGrade.behaviorBand }}
              lineGrades={lineGrades}
              bandSets={labeledSets}
              availableBands={assignableBands}
            />
          )}
        </>
      )}

      <div className="mt-3">
        <Disclosure summary="行動指針の初期設定について">
          <p className="footnote m-0">
            初期の分け方は3つです。{nameByCode("beginner")}・{nameByCode("regular")}に1つ目の行動指針、
            {nameByCode("chief")}・{nameByCode("am1")}・{nameByCode("am2")}に2つ目の行動指針を出し、
            {nameByCode("manager1")}・{nameByCode("manager2")}には出しません。
          </p>
          <p className="footnote m-0 mt-1">
            同じ行動指針は、等級の並びで続いた等級にだけ出せます。間の等級を飛ばして同じ行動指針を出す設定は保存できません。
          </p>
          <p className="footnote m-0 mt-1">
            移行元には、{nameByCode("am1")}・{nameByCode("am2")}へ行動指針を出さない記録がありました。実際に出したアンケートも残っていたので、
            初期値は出す側にしています。
          </p>
        </Disclosure>
      </div>

      <SectionHeading>何を問うか</SectionHeading>

      <div className="mb-3">
        <BehaviorBandSetEditor
          sets={labeledSets.map((set) => ({
            id: set.id,
            code: set.code,
            name: set.name,
            isActive: set.isActive,
            aspectCount: aspectCountOf(set.code),
            usedByGradeNames: gradesUsingBand(grades, set.code).map((g) => g.name),
            usedBy: bandSetUsedBy(
              guidelines.filter((g) => g.band === set.code).map((g) => g.id),
              usage,
            ),
            totalAspectCount: guidelines.filter((g) => g.band === set.code).length,
          }))}
          currentBand={band}
        />
      </div>

      {band === null ? (
        <EmptyState
          title="行動指針の基準がまだありません"
          body="上の「基準を新しく作る」から作ると、この下で問う内容を決められます。"
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {labeledSets.map((set) => (
              <ChipLink
                key={set.code}
                href={behaviorHref({ grade: selectedGrade?.id, band: set.code })} current={set.code === band}
                data-off={set.isActive ? undefined : "true"}
              >
                {set.name}
                {!set.isActive && "（使用しない）"}
              </ChipLink>
            ))}
          </div>
          <p className="footnote">
            点数（模範3・信頼2・安定1・不安定0・悪影響-1）は変えられません。会社ごとに変えられるのは「どういう状態をその点数と見なすか」の文章です。昇格に必要な合計点は
            <Link href="/admin/masters/promotion" className="mx-1 text-brand-deep">
              昇格の条件・要件
            </Link>
            で決めます。
          </p>
          <BehaviorGuidelineEditor key={band} band={band} bandSets={labeledSets} rows={rows} usage={usage} />
        </>
      )}
    </>
  );
}
