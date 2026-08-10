import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listCycles, listForms, listGrades } from "@/lib/queries";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, EmptyState, LinkButton, Num, PageTitle, ReasonNote, SectionHeading } from "@/components/ui";
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
  const selected = cycles.find((c) => c.id === sp.cycle) ?? cycles.find((c) => c.status === "open") ?? cycles[0];
  const [forms, grades] = await Promise.all([listForms(companyId, selected.id), listGrades(companyId)]);

  return (
    <>
      <PageTitle
        title="アンケート"
        lede="等級ごとに1つのアンケートを配ります。設問は制度マスタから自動で作られ、公開前に自由に足し引きできます。"
      />

      <SectionHeading>評価期間を選ぶ</SectionHeading>
      <div className="mb-5 flex flex-wrap gap-2">
        {cycles.map((c) => (
          <Link key={c.id} href={`/admin/forms?cycle=${c.id}`} className="chip" aria-pressed={c.id === selected.id}>
            {c.name}
          </Link>
        ))}
      </div>

      <Card className="card-pad">
        <p className="m-0 text-[13px]">
          {selected.name}（{formatPeriod(selected.periodStart, selected.periodEnd)}）のアンケートを、
          等級{grades.length}段階ぶんまとめて下書きで作ります。作ったあとに1つずつ内容を確認して公開してください。
        </p>
        <div className="mt-3">
          <ActionButton
            url="/api/forms"
            body={{ cycleId: selected.id }}
            label="等級ごとの下書きをまとめて作る"
            confirm="制度マスタの内容から、等級ごとにアンケートの下書きを作ります。すでにあるアンケートはそのまま残り、新しい版として追加されます。よろしいですか？"
          />
        </div>
      </Card>

      <SectionHeading>この期間のアンケート（{forms.length}件）</SectionHeading>
      {forms.length === 0 ? (
        <EmptyState title="アンケートがまだありません" body="上のボタンで等級ごとの下書きを作ってください。" />
      ) : (
        <div className="stack">
          {forms.map((f) => (
            <Card key={f.id} className="card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="todo-row-title m-0">
                    {f.title}{" "}
                    {f.status === "published" ? (
                      <Badge tone="active">公開中</Badge>
                    ) : f.status === "closed" ? (
                      <Badge tone="closed">締め切り済み</Badge>
                    ) : (
                      <Badge tone="done">下書き</Badge>
                    )}
                  </p>
                  <p className="todo-row-sub m-0">
                    対象：{f.gradeName ?? "—"} ／ 第{f.version}版 ／ 設問 <Num value={Number(f.questionCount ?? 0)} unit="問" /> ／ 回答{" "}
                    <Num value={Number(f.responseCount ?? 0)} unit="件" />
                  </p>
                  {f.status === "published" && (
                    <p className="footnote m-0 mt-1">
                      配布用のURL：<code className="text-[11px]">/f/{f.publicToken}</code>（開くにはログインが必要です）
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/forms/${f.id}/responses`} className="btn btn-secondary">
                    回答一覧を見る
                  </Link>
                  <Link href={`/admin/forms/${f.id}`} className="btn btn-tertiary">
                    設問を見る
                  </Link>
                </div>
              </div>

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
                {f.status === "closed" && Number(f.responseCount ?? 0) === 0 && (
                  <ActionButton
                    url="/api/forms"
                    method="PATCH"
                    body={{ formId: f.id, status: "draft" }}
                    label="下書きに戻す"
                    variant="tertiary"
                  />
                )}
              </div>

              {Number(f.questionCount ?? 0) === 0 && (
                <div className="mt-3">
                  <ReasonNote>設問が1問もないため公開できません。「設問を見る」から設問を追加してください。</ReasonNote>
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
