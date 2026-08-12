import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { chunkRowsForD1, getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { newId } from "@/lib/id";
import { assertFormContentEditable, syncFormQuestions } from "@/lib/form-build";
import { checkNumberMagnitude, defaultIntegerFlag } from "@/lib/domain/number-input";

export const dynamic = "force-dynamic";

/**
 * 設問を、いまの制度マスタ・評価セットから作り直す。
 *
 * アンケートは作った時点の制度の写しなので、評価項目を選び直すと静かにズレる。
 * ズレたまま集計すると、聞いていない項目が判定外になり配点ぶんの点が付かない。
 * 「制度が正・アンケートは写し」という向きを保つため、直すのは常にこちら側にする。
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const { id: formId } = await ctx.params;
    const r = await syncFormQuestions({ companyId: viewer.companyId, formId });
    return {
      ...r,
      message: `いまの評価項目に合わせて設問を作り直しました（${r.questionCount}問）。内容を確認してから公開してください。`,
    };
  });
}

const questionSchema = z.object({
  /** 既存の設問はIDを付けて送る。新規は省略する。 */
  id: z.string().optional(),
  section: z.enum(["support", "operation", "training", "test", "behavior", "kpi", "free"]),
  questionType: z.enum(["yesno", "single", "multi", "number", "text", "scale"]),
  title: z.string().min(1, "設問文を入力してください").max(300),
  helpText: z.string().max(300).nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  required: z.boolean(),
  validationMin: z.number().nullable().optional(),
  validationMax: z.number().nullable().optional(),
  /** 小数を受け付けない設問か（「件」「人」のように数え上げるもの） */
  validationInteger: z.boolean().optional(),
  options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1), score: z.number().optional() })).optional(),
  isGate: z.boolean().optional(),
  // 集計に使う紐づけ（画面では自動で引き継ぎ、手では作らない）
  gradeRequirementId: z.string().nullable().optional(),
  promotionRequirementId: z.string().nullable().optional(),
  behaviorGuidelineId: z.string().nullable().optional(),
  kpiItemId: z.string().nullable().optional(),
  kpiQuestionKey: z.string().nullable().optional(),
});

const bodySchema = z.object({ questions: z.array(questionSchema).max(200) });

/**
 * アンケートの設問を丸ごと保存する（クリック操作の組み立て画面から呼ぶ）。
 *
 * 回答が1件でもあるアンケートは設問を編集できない。
 * 設問を差し替えると、過去の回答がどの設問への答えか分からなくなるため。
 * 直したいときは「新しい版を作る」。
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const { id: formId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    const db = await getDb();

    const form = (
      await db
        .select()
        .from(s.forms)
        .where(and(eq(s.forms.id, formId), eq(s.forms.companyId, companyId)))
        .limit(1)
    )[0];
    if (!form) throw new HttpError(404, "アンケートが見つかりませんでした。");
    assertFormContentEditable(form);

    const responses = await db
      .select({ id: s.formResponses.id })
      .from(s.formResponses)
      .where(eq(s.formResponses.formId, form.id))
      .limit(1);
    if (responses.length > 0) {
      throw new HttpError(
        400,
        "このアンケートにはすでに回答があるため、設問を変更できません。内容を変えるときは新しい版を作ってください。",
      );
    }

    const q = body.questions;
    if (q.length === 0) throw new HttpError(400, "設問が1問もありません。1問以上にしてください。");
    for (const x of q) {
      if ((x.questionType === "single" || x.questionType === "multi") && (x.options ?? []).length < 2) {
        throw new HttpError(400, `「${x.title}」の選択肢が足りません。2つ以上にしてください。`);
      }
      /* 設問に書く下限・上限・選択肢の点数にも、回答を受け取るときと同じ 1兆の決まりを当てる。
         ここが無制限だと、極端な下限・上限を1つ置いただけで、その設問を通るすべての回答の
         許容範囲がその値になる（＝提出時の検査が実質効かなくなる）。
         止まる場所が回答側の1箇所しかない状態をやめ、書き込む前のこの場でも断る。 */
      for (const [side, v] of [
        ["下限", x.validationMin],
        ["上限", x.validationMax],
      ] as const) {
        const m = checkNumberMagnitude(`「${x.title}」の${side}（${v}）`, v);
        if (!m.ok) throw new HttpError(400, m.message);
      }
      for (const opt of x.options ?? []) {
        const m = checkNumberMagnitude(`「${x.title}」の選択肢「${opt.label}」の点数（${opt.score}）`, opt.score);
        if (!m.ok) throw new HttpError(400, m.message);
      }
      if (
        x.validationMin !== null &&
        x.validationMin !== undefined &&
        x.validationMax !== null &&
        x.validationMax !== undefined &&
        x.validationMax < x.validationMin
      ) {
        throw new HttpError(400, `「${x.title}」の入力範囲が逆になっています。`);
      }
    }

    const rows = q.map((x, i) => ({
      id: x.id ?? newId("fq"),
      companyId,
      formId: form.id,
      section: x.section,
      questionType: x.questionType,
      title: x.title.trim(),
      helpText: x.helpText ?? null,
      unit: x.unit ?? null,
      required: x.required,
      validationMin: x.validationMin ?? null,
      validationMax: x.validationMax ?? null,
      /* 指定が無いときは単位から推し量る（数え上げる単位なら整数だけ）。
         数値以外の設問には意味が無いので付けない。 */
      validationInteger:
        x.questionType === "number"
          ? (x.validationInteger ?? defaultIntegerFlag({ unit: x.unit }))
          : false,
      optionsJson: x.options && x.options.length > 0 ? JSON.stringify(x.options) : null,
      displayOrder: i + 1,
      gradeRequirementId: x.gradeRequirementId ?? null,
      promotionRequirementId: x.promotionRequirementId ?? null,
      behaviorGuidelineId: x.behaviorGuidelineId ?? null,
      kpiItemId: x.kpiItemId ?? null,
      kpiQuestionKey: x.kpiQuestionKey ?? null,
      isGate: x.isGate ?? false,
    }));

    // D1の1query 100 bind上限内に分けつつ、DELETEと全INSERTは1つのbatchで原子的に行う。
    await db.batch(
      [
        db.delete(s.formQuestions).where(eq(s.formQuestions.formId, form.id)),
        ...chunkRowsForD1(rows).map((chunk) => db.insert(s.formQuestions).values(chunk)),
      ] as unknown as Parameters<typeof db.batch>[0],
    );

    return { message: `設問を保存しました（${q.length}問）。` };
  });
}
