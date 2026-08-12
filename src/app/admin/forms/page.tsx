import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listCycles, listFormKpiCoverage, listForms, listGrades } from "@/lib/queries";
import { describeFormKpiDiff, diffFormKpiItems, effectiveAskedItems } from "@/lib/domain/form-sync";
import { ActionButton } from "@/components/ActionButton";
import { CopyUrl } from "@/components/CopyUrl";
import { appOrigin, formUrl } from "@/lib/origin";
import { Badge, Card, CardHead, EmptyState, LinkButton, Num, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
import { FORM_STATUS_LABEL, formatPeriod } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * アンケートの一覧と作成。
 * 制度マスタから下書きを自動で作り、設問はクリック操作で組み立てて公開する。
 */
export default async function AdminForms({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const companyId = viewer.companyId;

  const cycles = await listCycles(companyId);
  if (cycles.length === 0) {
    return (
      <>
        <PageTitle title="アンケート" />
        <EmptyState
          title="先に評価期間を作ってください"
          body="アンケートは評価期間ごと・等級ごとに作ります。"
          action={<LinkButton href="/admin/cycles" variant="primary">評価期間を作る</LinkButton>}
        />
      </>
    );
  }

  const sp = await searchParams;
  /* 配布用URLは実行時に組み立てる（本番・プレビュー・ローカルでホストが違うため、
     ドメインを書き込むと必ずどこかで間違ったURLを配ることになる）。 */
  const origin = await appOrigin();
  const selected = cycles.find((c) => c.id === sp.cycle) ?? cycles.find((c) => c.status === "open") ?? cycles[0];
  const [forms, grades, coverage] = await Promise.all([
    listForms(companyId, selected.id),
    listGrades(companyId),
    listFormKpiCoverage(companyId, selected.id),
  ]);

  /* このアンケートが聞いている項目と、いま選んでいる項目のズレ。
     ズレていても自動では直さない（回答済みのアンケートを書き換えないため）。
     直すかどうかは回答状況を見て人が決めることなので、事実だけを出す。 */
  const mismatchOf = (formId: string, gradeId: string | null): string | null => {
    if (!coverage) return null;
    const pointGroup = grades.find((g) => g.id === gradeId)?.pointGroup;
    if (!pointGroup) return null;
    const selectedItems = coverage.selectedByGroup.get(pointGroup);
    if (!selectedItems) return null; // この等級区分の項目がまだ選ばれていない
    const asked = effectiveAskedItems(coverage.askedByForm.get(formId) ?? [], {
      fixedSlotItemIds: coverage.fixedSlotItemIds,
      hasRequirementQuestions: coverage.hasRequirementQuestions(formId),
    });
    return describeFormKpiDiff(diffFormKpiItems(selectedItems, asked), coverage.nameOf);
  };

  return (
    <>
      <PageTitle
        title="アンケート"
        lede="等級ごとに1つのアンケートを配ります。公開前に、設問文だけでなく選択肢や答え方まで確認できます。"
      />

      <SectionHeading>評価期間を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {cycles.map((c) => (
          <Link key={c.id} href={`/admin/forms?cycle=${c.id}`} className="chip" aria-current={c.id === selected.id ? "true" : undefined}>
            {c.name}
          </Link>
        ))}
      </div>

      <Card className="card-pad">
        <p className="m-0 text-sub">
          {selected.name}（{formatPeriod(selected.periodStart, selected.periodEnd)}）のアンケートを、
          等級{grades.length}段階ぶんまとめて下書きで作ります。作ったあとに1つずつ内容を確認して公開してください。
        </p>
        <div className="mt-3">
          <ActionButton
            url="/api/forms"
            body={{ cycleId: selected.id }}
            label="等級ごとの下書きをまとめて作る"
            confirm="等級ごとのアンケート下書きを作ります。もとにするのは、等級要件・昇格要件・行動指針・評価セットです。既存のアンケートは残し、新しい版として追加します。よろしいですか？"
          />
        </div>
      </Card>

      <SectionHeading>この期間のアンケート（{forms.length}件）</SectionHeading>
      {forms.length === 0 ? (
        <EmptyState title="アンケートがまだありません" body="上のボタンで等級ごとの下書きを作ってください。" />
      ) : (
        <div className="stack">
          {forms.map((f) => (
            <Card key={f.id} className="card-pad" off={f.status === "closed"}>
              <CardHead
                title={
                  <>
                    {f.title}{" "}
                    {f.status === "published" ? (
                      <Badge tone="active">公開中</Badge>
                    ) : f.status === "closed" ? (
                      <Badge tone="closed">締め切り済み</Badge>
                    ) : (
                      <Badge tone="done">下書き</Badge>
                    )}
                  </>
                }
                sub={
                  <>
                    対象：{f.gradeName ?? "—"} ／ 第{f.version}版 ／ 設問 <Num value={Number(f.questionCount ?? 0)} unit="問" /> ／ 回答{" "}
                    <Num value={Number(f.responseCount ?? 0)} unit="件" />
                  </>
                }
                detail={
                  f.status === "published" ? (
                    <p className="footnote m-0 mt-1">
                      <CopyUrl url={formUrl(origin, f.publicToken)} />
                      <span className="ml-1">（開くにはログインが必要です）</span>
                    </p>
                  ) : undefined
                }
                actions={
                  <>
                    <LinkButton href={`/admin/forms/${f.id}/responses`} variant="secondary">
                      回答一覧を見る
                    </LinkButton>
                    <LinkButton href={`/admin/forms/${f.id}`} variant="tertiary">
                      内容を確認・編集
                    </LinkButton>
                  </>
                }
              />

              <div className="mt-3 flex flex-wrap gap-3">
                {f.status === "draft" && (
                  <ActionButton
                    url="/api/forms"
                    method="PATCH"
                    body={{ formId: f.id, status: "published" }}
                    label="公開する"
                    confirm={`「${f.title}」を公開します。${f.gradeName ?? ""}の方の画面に表示され、回答できるようになります。同じ等級で公開中の古い版は自動で締め切られます。よろしいですか？`}
                  />
                )}
                {f.status === "published" && (
                  <ActionButton
                    url="/api/forms"
                    method="PATCH"
                    body={{ formId: f.id, status: "closed" }}
                    label="締め切る"
                    variant="secondary"
                    confirm={`「${f.title}」を締め切ります。以後は回答できません。提出済みの回答は残ります。よろしいですか？`}
                  />
                )}
              </div>

              {mismatchOf(f.id, f.gradeId) && (
                <div className="mt-3">
                  <ReasonNote
                    action={
                      Number(f.responseCount ?? 0) === 0 && f.status === "draft" ? (
                        <ActionButton
                          url={`/api/forms/${f.id}/questions`}
                          body={{}}
                          label="いまの評価項目に合わせて設問を作り直す"
                          variant="secondary"
                          confirm={`「${f.title}」の設問を、いまの等級要件・昇格要件・行動指針・評価セットから作り直します。手で足した設問は消えます。まだ公開前で、回答は1件もありません。よろしいですか？`}
                        />
                      ) : undefined
                    }
                  >
                    いま選んでいる評価項目と、このアンケートが聞いている項目が食い違っています。{" "}
                    {mismatchOf(f.id, f.gradeId)}
                    {(Number(f.responseCount ?? 0) > 0 || f.status !== "draft") &&
                      "公開後のアンケートは設問を差し替えません。回答が0件でも読まれている可能性があるためです。いまの内容で聞き直す場合は、新しい版を作って公開してください。"}
                  </ReasonNote>
                </div>
              )}
              {Number(f.questionCount ?? 0) === 0 && (
                <div className="mt-3">
                  <ReasonNote>設問が1問もないため公開できません。「内容を確認・編集」から設問を追加してください。</ReasonNote>
                </div>
              )}
              {Number(f.responseCount ?? 0) > 0 && f.status !== "closed" && (
                <p className="footnote m-0 mt-2">
                  すでに回答があるため、設問は変更できません。内容を変えるときは新しい版を作ってください（{FORM_STATUS_LABEL[f.status]}）。
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
