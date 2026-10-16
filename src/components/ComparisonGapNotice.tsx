import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { DataTable } from "@/components/DataTable";
import { Icon } from "@/components/Icon";
import { Badge, InlineDetail, LinkButton } from "@/components/ui";
import { createForms, rebuildFormQuestions } from "@/actions/forms";
import {
  COMPARISON_LEAD,
  COMPARISON_OPEN_LABEL,
  NO_TEMPLATE_BADGE,
  comparisonSummary,
  fixConfirm,
  fixLabel,
  type ComparisonGap,
  type ComparisonPage,
  type ComparisonRow,
} from "@/lib/domain/comparison-gap";

/**
 * 比べる警告（DD-012 の4）。3画面（アンケートの一覧・1本・使うKPIを選ぶ）はこの部品だけで出す。
 *
 * 閉じた状態は注意の枠の1つの段で、件数の文と『直すところを見る』の札だけを置く。
 * 開くと、1行目・見比べる2つのページ・○ と — の表・直す操作1つの順に並べる。説明の段落は置かない。
 * 使うKPIを選ぶの画面では、このページのリンク1行と、アンケートごとに1行の表にする。
 * 直す操作はアンケート側で行うので、この画面にはボタンを置かない。
 */
export function ComparisonGapNotice({ gaps }: { gaps: readonly ComparisonGap[] }) {
  if (gaps.length === 0) return null;
  const onSelection = gaps[0].current === "selection";

  return (
    // 狭い幅で「くださ／い」「余分／0）」のように1〜2文字だけ落ちる割れ方を作らない。
    // 文節で折り（auto-phrase。効かない環境では今までどおり）、最後の行を短く残さない（pretty）。
    <div className="caution-panel text-pretty [word-break:auto-phrase]">
      <div className="flex min-w-0 items-start gap-2">
        <Icon name="info" className="reason-note-mark" />
        {/* 開いたら札ごと次の行へ回し、中身を枠の幅いっぱいに使う */}
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 *:open:basis-full">
          <p className="m-0 font-bold">{comparisonSummary(gaps)}</p>
          <InlineDetail summary={COMPARISON_OPEN_LABEL}>
            <p className="m-0 font-bold text-ink">{COMPARISON_LEAD}</p>
            {onSelection ? (
              <SelectionBody gaps={gaps} />
            ) : (
              gaps.map((gap) => <FormBody key={gap.formId} gap={gap} />)
            )}
          </InlineDetail>
        </div>
      </div>
    </div>
  );
}

/** アンケートの一覧・1本：2つのページ、表、直す操作、注記 */
function FormBody({ gap }: { gap: ComparisonGap }) {
  return (
    <div className="mt-2 grid gap-2">
      <ul className="m-0 grid list-none gap-1 p-0">
        {gap.pages.map((page) => (
          <li key={page.key}>
            <PageLink page={page} />
          </li>
        ))}
      </ul>
      <DataTable<ComparisonRow>
        scroll
        caption="使うKPIを選ぶとこのアンケートの項目の比べ"
        columns={[
          { key: "name", header: "項目", cell: (row) => <RowName row={row} />, role: "title" },
          { key: "selection", header: "使うKPIを選ぶ", cell: (row) => <Mark on={row.inSelection} /> },
          { key: "form", header: "このアンケート", cell: (row) => <Mark on={row.inForm} /> },
        ]}
        rows={[...gap.rows]}
        rowKey={(row) => row.itemId}
      />
      <FixControl gap={gap} />
      {gap.note && <p className="m-0">{gap.note}</p>}
    </div>
  );
}

/** 使うKPIを選ぶ：このページのリンク1行と、アンケートごとに1行の表 */
function SelectionBody({ gaps }: { gaps: readonly ComparisonGap[] }) {
  const names = (rows: readonly ComparisonRow[]) =>
    rows.map((row) => (row.noTemplate ? `${row.name}（${NO_TEMPLATE_BADGE}）` : row.name)).join("・");
  return (
    <div className="mt-2 grid gap-2">
      <p className="m-0">
        <PageLink page={gaps[0].pages[0]} />
      </p>
      <DataTable<ComparisonGap>
        scroll
        caption="アンケートごとの聞いていない項目と余分に聞いている項目"
        columns={[
          { key: "form", header: "アンケート", cell: (gap) => <PageLink page={gap.pages[1]} />, role: "title" },
          {
            key: "missing",
            header: "聞いていない項目",
            cell: (gap) => listOrMark(names(gap.rows.filter((row) => row.inSelection && !row.inForm))),
          },
          {
            key: "extra",
            header: "余分に聞いている項目",
            cell: (gap) => listOrMark(names(gap.rows.filter((row) => row.inForm && !row.inSelection))),
          },
        ]}
        rows={[...gaps]}
        rowKey={(gap) => gap.formId}
      />
    </div>
  );
}

/** 階層つきのページ名。開けない役割には名前だけを出す。いま開いているページには印を付ける */
function PageLink({ page }: { page: ComparisonPage }) {
  return (
    <>
      {page.href ? (
        <Link href={page.href} className="text-brand-deep" aria-current={page.current ? "page" : undefined}>
          {page.label}
        </Link>
      ) : (
        <span>{page.label}</span>
      )}
      {page.current && "（このページ）"}
    </>
  );
}

/** 項目名。実績の聞き方（設問のひな形）が決まっていない項目には、使うKPIを選ぶの候補と同じ札を添える */
function RowName({ row }: { row: ComparisonRow }) {
  if (!row.noTemplate) return row.name;
  return (
    <>
      {row.name} <Badge tone="required">{NO_TEMPLATE_BADGE}</Badge>
    </>
  );
}

/** ○ と —。記号は読み上げず、読み上げ用の文字を添える */
function Mark({ on }: { on: boolean }) {
  return (
    <>
      <span aria-hidden="true">{on ? "○" : "—"}</span>
      <span className="sr-only">{on ? "ある" : "ない"}</span>
    </>
  );
}

function listOrMark(names: string) {
  return names === "" ? <Mark on={false} /> : names;
}

/**
 * 直す操作1つ。書き込む操作は確認つきのボタン、ほかはリンク。
 *
 * 札は『この等級だけ新しい版の下書きを作る』のように長いので、狭い幅では折り返す。
 * `.btn` は globals.css（層の外）で折り返さない指定のため、この枠の中だけ important で上書きする。
 * 折り返さないと、375px で開いた本文からボタンがはみ出し、画面ごと横に流れる。
 */
function FixControl({ gap }: { gap: ComparisonGap }) {
  const { fix } = gap;
  if (!fix) return null;
  return <div className="[&_.btn]:whitespace-normal!">{fixControlOf(fix, gap)}</div>;
}

function fixControlOf(fix: NonNullable<ComparisonGap["fix"]>, gap: ComparisonGap) {
  switch (fix.kind) {
    case "rebuild":
      return (
        <ActionButton
          action={rebuildFormQuestions}
          resource="forms"
          input={{ formId: fix.formId }}
          label={fixLabel(fix)}
          variant="secondary"
          confirm={fixConfirm(fix, gap)}
        />
      );
    case "newVersion":
      return (
        <ActionButton
          action={createForms}
          resource="forms"
          input={{ cycleId: fix.cycleId, gradeIds: [fix.gradeId] }}
          label={fixLabel(fix)}
          variant="secondary"
          confirm={fixConfirm(fix, gap)}
        />
      );
    case "openNewer":
    case "finishScheme":
    case "defineAsking":
      return (
        <LinkButton href={fix.href} variant="secondary">
          {fixLabel(fix)}
        </LinkButton>
      );
  }
}
