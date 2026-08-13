import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { Badge, Card, CardHead, Code, EmptyState, LinkButton, Num, PageTitle, ProvisionalMark, ReasonNote } from "@/components/ui";
import { DetailDialogButton } from "@/components/ConfirmButton";
import { RankCriteriaSetForm } from "@/components/RankCriteriaSetForm";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { targetsPointGroup } from "@/lib/domain/grade-points";
import { groupPosition, nextGroupOf, schemeStepPath, stepLede, stepNumber, STEPS, stepTitle } from "@/lib/domain/scheme-steps";
import { loadGroupCriteria, loadSchemeSetup } from "../../data";

export const dynamic = "force-dynamic";

/**
 * 手順2「選んだ項目の基準（A〜E）を決める」。
 *
 * 直した点（2026-08-11 の指摘「関係ない指標まで並ぶと訳が分からない」）:
 *   以前は評価セット全体（5つの等級区分ぶん）のランク基準を1つの折りたたみに出していたため、
 *   その等級区分で選んでいない項目も、同じ項目の重複したカードも並んでいた。
 *   ここではこの等級区分で選んだ項目だけを、選んだ順に出す。
 */
export default async function SchemeCriteriaPage({ params }: { params: Promise<{ group: string }> }) {
  const viewer = await requireRole("COMPANY_ADMIN");
  if (!viewer.companyId) return <EmptyState title="所属している会社がありません" body="" />;
  const pointGroup = decodeURIComponent((await params).group);

  const setup = await loadSchemeSetup(viewer.companyId);
  const group = setup.groups.find((g) => g.pointGroup === pointGroup);
  if (!group) notFound();

  const position = groupPosition(setup.order, pointGroup);
  const nextGroup = nextGroupOf(setup.order, pointGroup);
  const head = (
    <PageTitle
      /* ヘッダーが出す階層と重ねない（手順1へは階層の1段前が同じ URL を指す）。 */
      breadcrumb={[{ label: "制度設定ガイド", href: "/admin/setup" }]}
      title={`${pointGroup}：${stepTitle("criteria")}`}
      lede={stepLede("criteria", pointGroup)}
      tags={
        <>
          <Badge tone="active">
            ステップ {stepNumber("criteria")} / {STEPS.length}
          </Badge>
          <Badge tone="closed">
            等級区分 {position} / {setup.order.length}
          </Badge>
        </>
      }
      sticky
    />
  );

  if (!setup.scheme) {
    return (
      <>
        {head}
        <ReasonNote>有効な評価セットが登録されていません。初期データの投入が済んでいるかご確認ください。</ReasonNote>
      </>
    );
  }

  const { items, ratios } = await loadGroupCriteria(viewer.companyId, setup.scheme.id, pointGroup);

  if (items.length === 0) {
    return (
      <>
        {head}
        <EmptyState
          title="この等級区分ではまだ項目を選んでいません"
          body="先に「使うKPIを選ぶ」を終えてください。選んだ項目だけがこの画面に並びます。"
          action={
            <LinkButton variant="primary" href={schemeStepPath(pointGroup, "select")}>
              使うKPIを選ぶ
            </LinkButton>
          }
        />
      </>
    );
  }

  /* この等級区分を対象にした基準が1件も無い項目＝まだ線引きが決まっていない項目。
     先頭で件数を出さないと、下まで読まないと未設定に気づけない。 */
  const unrated = items.filter((i) => !i.criteria.some((c) => targetsPointGroup(c.targetGrades, pointGroup)));

  return (
    <>
      {head}

      {unrated.length > 0 ? (
        <ReasonNote>
          この等級区分向けの基準が決まっていない項目が {unrated.length}件あります：
          {unrated.map((i) => i.name).join("、")}
        </ReasonNote>
      ) : (
        <p className="footnote mt-1">選んだ{items.length}件すべてに、この等級区分向けの基準が入っています。</p>
      )}

      <Card className="card-pad mt-3">
        <p className="footnote m-0">
          A〜Eのランクは、この等級区分の配点に割合を掛けて点数にします（
          {ratios.map((r) => `${r.rank}=${Math.round(r.ratio * 100)}%`).join("、")}）。
          {ratios.some((r) => r.isProvisional) && (
            <>
              {" "}
              <ProvisionalMark note="ランクごとの割合は制度として未確定のため、叩き台の初期値です。" />
            </>
          )}
        </p>
        <p className="footnote m-0 mt-1">
          基準（下限・上限）はKPI項目ごとに1組で、すべての等級区分で共通です。ここで直すと、同じ項目を使っている
          ほかの等級区分の判定も同じ基準になります。等級区分ごとに違う線引きにしたい場合は、別のKPI項目として登録してください。
        </p>
        {/* 数値の書き方は項目ごとに同じ説明になる。カードごとに繰り返さず、ここで1回だけ読めるようにする。 */}
        <div className="mt-3">
          {/* 同じ強さの文が5つ縦に並ぶと、どこまでが1つの決まりごとか目で切れない。
              並びの単位を箇条書きで示す（2026-08-13 の指摘）。 */}
          <DetailDialogButton label="上限・下限の書き方を見る" title="上限・下限の書き方">
            <ul className="m-0 list-disc space-y-1 pl-5 text-sub">
              <li>上限・下限を空欄にすると、その側は制限なし（青天井）になります。</li>
              <li>いちばん上のランクの外側は空欄にします。いちばん下のランクの外側も空欄にします。</li>
              <li>そこに制限を入れると、その外の実績値がどのランクにも当てはまらなくなります。</li>
              <li>ランク同士は、隣り合う欄に同じ値を入れるとぴったり繋がります。</li>
              <li>重なりや隙間があるまま保存はできません。どう直せばよいかは、その場に出ます。</li>
            </ul>
          </DetailDialogButton>
        </div>
      </Card>

      <div className="stack mt-3">
        {items.map((i) => (
          <Card key={i.kpiItemId} className="card-pad">
            {/* ランクA〜Eの入力欄が縦に続くので、頭は固定表示にする。
                帯に載せるのは、数値を打ちながら参照し続けるものだけ
                ＝項目名・配点・単位・良い向き・下限上限のどちらを含むか。
                実績値の出し方や「空欄＝制限なし」の説明は一度読めば済むので
                帯には載せず、下の本文に置く（帯が厚いと入力欄が見えなくなる）。 */}
            <CardHead
              pinned
              title={
                <>
                  {i.name}
                  {i.isProvisional && (
                    <>
                      {" "}
                      <ProvisionalMark note="制度として未確定の項目です（叩き台）。" />
                    </>
                  )}{" "}
                  <span className="unit">配点 </span>
                  <Num value={i.weight} unit="点" />
                  {i.isFixedSlot && (
                    <>
                      {" "}
                      <Badge tone="done">固定枠</Badge>
                    </>
                  )}
                </>
              }
              sub={
                <>
                  単位 {i.unit} ／ {i.direction === "lower" ? "低いほど良い" : "高いほど良い"} ／{" "}
                  {i.direction === "lower" ? "下限＝含まない・上限＝含む" : "下限＝含む・上限＝含まない"}
                </>
              }
            />
            {i.isFixedSlot ? (
              <p className="footnote m-0">
                実績値は「達成した等級要件の数 ÷ 出した数 × 100」で出します。分母は、アンケートで出した等級要件の数です。
              </p>
            ) : (
              i.formula && (
                /* 記号の並びを地の文と同じ書体で出すと文章の一部に見える。式は等幅で出す。 */
                <p className="footnote m-0">
                  計算式 <Code>{i.formula}</Code>
                </p>
              )
            )}
            {i.criteria.length === 0 ? (
              <div className="mt-3">
                <ReasonNote>
                  この項目にはまだA〜Eの基準がありません。「等級の設定」で基準を追加してから、ここで数値を調整してください。
                </ReasonNote>
              </div>
            ) : (
              /* A〜Eをまとめて直してまとめて保存する。1ランクずつ保存する作りでは、
                 直している途中に必ず境界がずれるため、重なり・隙間を「保存前に断る」ことが
                 できなかった（警告を出すだけになり、矛盾したまま運用できてしまう）。
                 画面に出す表記は入力させない。判定に使うのは下限・上限の数値だけで、
                 文言を別に書けるようにすると、書いてある範囲と実際に判定される範囲が
                 食い違う（説明文だけが嘘になる）。表記は保存時に数値から作り直す。 */
              <RankCriteriaSetForm
                kpiItemId={i.kpiItemId}
                unit={i.unit}
                direction={i.direction === "lower" ? "lower" : "higher"}
                rows={i.criteria}
              />
            )}
          </Card>
        ))}
      </div>

      <p className="footnote mt-4">
        変更は次に作るアンケートと、まだ確定していない評価に反映されます。すでに公開したアンケートと確定済みの評価は
        当時の基準のまま残ります。
      </p>

      <StickyActionBar
        status={
          nextGroup
            ? `${pointGroup} の設定はここまでです。次は「${nextGroup}」の設定に進みます。`
            : "すべての等級区分の設定がここで終わりです。次は評価期間の設定に進みます。"
        }
      >
        {nextGroup ? (
          <LinkButton variant="primary" href={schemeStepPath(nextGroup, "select")}>
            次は {nextGroup} で使うKPIを選ぶ
          </LinkButton>
        ) : (
          <LinkButton variant="primary" href="/admin/cycles">
            次は評価期間を設定する
          </LinkButton>
        )}
      </StickyActionBar>
    </>
  );
}
