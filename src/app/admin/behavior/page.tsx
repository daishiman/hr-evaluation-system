import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listBehaviorBandSets, listBehaviorGuidelines, listGrades } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { bandSetUsedBy, behaviorGuidelineUsage } from "@/lib/master-usage";
import { BehaviorBandAssignmentEditor } from "@/components/BehaviorBandAssignmentEditor";
import { BehaviorBandSetEditor } from "@/components/BehaviorBandSetEditor";
import { BehaviorGuidelineEditor } from "@/components/BehaviorGuidelineEditor";
import { behaviorBandLabel, gradesUsingBand } from "@/lib/domain/behavior";
import { Card, CardRow, Disclosure, EmptyState, PageTitle, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

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
export default async function AdminBehavior({ searchParams }: { searchParams: Promise<{ band?: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
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
  /* 等級に割り当てられるのは「使う設定になっていて、問う内容が1件以上ある」基準だけ。
     空のセットを割り当てると、行動指針の設問が黙って0件のアンケートができる。 */
  const assignableBands = bandSets
    .filter((set) => set.isActive && guidelines.some((g) => g.band === set.code && g.isActive))
    .map((set) => set.code);

  const rows = guidelines.map((g) => ({
    id: g.id,
    band: g.band,
    aspect: g.aspect,
    aspectName: g.aspectName,
    seq: g.seq,
    isActive: g.isActive,
    levels: g.levels.map((l) => ({ id: l.id, score: l.score, label: l.label, text: l.text })),
  }));

  const applied = grades.filter((g) => g.behaviorBand !== null);

  return (
    <>
      <PageTitle
        title="行動指針"
        lede="アンケートで問う行動指針の中身と、どの等級に出すかを決めます。変更は次に作るアンケートから反映され、すでに公開したアンケートと確定済みの評価は動きません。"
      />

      <SectionHeading>どの等級に出すか</SectionHeading>
      <Card className="card-pad">
        {grades.length === 0 ? (
          <p className="m-0 text-sub">等級が登録されていません。</p>
        ) : (
          <>
            <p className="m-0 text-sub">
              いま行動指針の基準を割り当てている等級は <b>{applied.length}件</b>
              {applied.length > 0 && `（${applied.map((g) => `${g.name}：${behaviorBandLabel(bandSets, g.behaviorBand)}`).join(" / ")}）`}
              です。
            </p>
            <div className="mt-2 grid gap-2">
              {grades.map((g) => (
                <CardRow
                  key={g.id}
                  title={g.name}
                  sub={g.behaviorBand ? behaviorBandLabel(bandSets, g.behaviorBand) : "行動指針を出さない"}
                />
              ))}
            </div>
          </>
        )}
      </Card>

      {grades.length > 0 && (
        <div className="mt-3">
          <BehaviorBandAssignmentEditor
            grades={grades.map((grade) => ({ id: grade.id, name: grade.name, behaviorBand: grade.behaviorBand }))}
            bandSets={bandSets}
            availableBands={assignableBands}
          />
        </div>
      )}

      <div className="mt-3">
        <Disclosure summary="行動指針の初期設定について">
          <p className="footnote m-0">
            移行元には、AM Ⅰ・AM Ⅱへ行動指針を出さない記録と、実際に出したアンケートがありました。初期値は実際のアンケートを採用しています。会社の制度に合わせて上で切り替えてください。
          </p>
        </Disclosure>
      </div>

      <SectionHeading>何を問うか</SectionHeading>

      <div className="mb-3">
        <BehaviorBandSetEditor
          sets={bandSets.map((set) => ({
            id: set.id,
            code: set.code,
            name: set.name,
            isActive: set.isActive,
            aspectCount: guidelines.filter((g) => g.band === set.code && g.isActive).length,
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
            {bandSets.map((set) => (
              <Link
                key={set.code}
                href={`/admin/behavior?band=${set.code}`}
                className="chip"
                aria-current={set.code === band ? "true" : undefined}
                data-off={set.isActive ? undefined : "true"}
              >
                {set.name}
                {!set.isActive && "（使用しない）"}
              </Link>
            ))}
          </div>
          <p className="footnote">
            点数（模範3・信頼2・安定1・不安定0・悪影響-1）は変えられません。会社ごとに変えられるのは「どういう状態をその点数と見なすか」の文章です。昇格に必要な合計点は
            <Link href="/admin/masters/promotion" className="mx-1 text-[var(--brand-deep)]">
              昇格の条件・要件
            </Link>
            で決めます。
          </p>
          <BehaviorGuidelineEditor key={band} band={band} bandSets={bandSets} rows={rows} usage={usage} />
        </>
      )}
    </>
  );
}
