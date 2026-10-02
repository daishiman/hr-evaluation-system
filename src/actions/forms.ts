"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { chunkRowsForD1, getDb, schema as s } from "@/lib/db";
import { batchAll } from "@/lib/db-batch";
import { newId } from "@/lib/id";
import { assertCompanyChosen, HttpError } from "@/lib/session";
import { assertFormContentEditable, buildFormDrafts, syncFormQuestions, type FormDraftInput } from "@/lib/form-build";
import { checkNumberMagnitude, defaultIntegerFlag } from "@/lib/domain/number-input";
import { formPublicationReadiness } from "@/lib/domain/setup-readiness";
import { loadSchemeReadiness } from "@/lib/scheme-readiness";

/**
 * アンケートの作成・公開・締め切り・内容の変更と、設問の保存（会社の管理者のみ）。
 *
 * 画面専用の書き込みなので、URL の口（Route Handler）ではなく Server Action に置く。
 * 成功すると runAction が refresh() を呼び、一覧・件数は保存の応答と同時に新しくなる。
 */

const createSchema = z.object({
  cycleId: z.string().min(1),
  /** 省略したら、その会社の全等級ぶんをまとめて作る */
  gradeIds: z.array(z.string().min(1)).optional(),
  title: z.string().max(80).optional(),
});

/** アンケートの下書きを制度マスタから作る。 */
export async function createForms(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: createSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    const cycle = (
      await db.select().from(s.evaluationCycles)
        .where(and(eq(s.evaluationCycles.id, input.cycleId), eq(s.evaluationCycles.companyId, companyId))).limit(1)
    )[0];
    if (!cycle) throw new HttpError(404, "評価期間が見つかりませんでした。");
    const schemeReadiness = await loadSchemeReadiness(companyId, cycle.schemeId);
    if (!schemeReadiness.schemeReady) throw new HttpError(409, schemeReadiness.schemeMessage);

    const grades = await db.select().from(s.grades).where(eq(s.grades.companyId, companyId));
    const targets = input.gradeIds
      ? grades.filter((g) => input.gradeIds!.includes(g.id))
      : grades.filter((g) => g.isActive);
    if (targets.length === 0) throw new HttpError(400, "対象の等級がありません。");

    /* 全等級ぶんを1つのD1 batchで保存する。途中の等級で失敗しても、前半だけ残さない。 */
    const [firstTarget, ...remainingTargets] = targets;
    const toDraftInput = (gradeId: string): FormDraftInput => ({
      companyId,
      cycleId: input.cycleId,
      gradeId,
      title: input.title,
    });
    const draftInputs: [FormDraftInput, ...FormDraftInput[]] = [
      toDraftInput(firstTarget.id),
      ...remainingTargets.map((target) => toDraftInput(target.id)),
    ];
    const drafts = await buildFormDrafts(draftInputs);
    const results = drafts.map((draft, index) => ({
      gradeId: targets[index].id,
      gradeName: targets[index].name,
      ...draft,
    }));
    const total = results.reduce((sum, r) => sum + r.questionCount, 0);
    return {
      results,
      message: `${results.length}件のアンケートを下書きで作りました（設問 合計${total}問）。内容を確認してから公開してください。`,
    };
  });
}

const patchSchema = z.object({
  formId: z.string().min(1),
  status: z.enum(["draft", "published", "closed"]).optional(),
  title: z.string().min(1).max(80).optional(),
  description: z.string().max(400).nullable().optional(),
  /* 回答期間。締切が実際に効くようになったため、あとから直せる必要がある
     （もとは評価期間の開始・終了がそのまま入るだけで、変更する手段が無かった）。
     日付は YYYY-MM-DD で持ち、指定した日の終わり（日本時間）まで回答できる。 */
  opensAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付は年月日で入力してください。").nullable().optional(),
  closesAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付は年月日で入力してください。").nullable().optional(),
});

/** アンケートの公開・締め切り・タイトル変更・回答期間の変更。 */
export async function updateForm(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: patchSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    const form = (
      await db
        .select()
        .from(s.forms)
        .where(and(eq(s.forms.id, input.formId), eq(s.forms.companyId, companyId)))
        .limit(1)
    )[0];
    if (!form) throw new HttpError(404, "アンケートが見つかりませんでした。");

    // 公開した版は、回答が0件でもすでに読まれている可能性がある。
    // 同じ版を下書きに戻して文面を変えると「何を配った版か」が残らないため、
    // 内容を変える場合は既存の版作成フローで新しい下書きを作る。
    if (input.status === "draft" && form.status !== "draft") {
      throw new HttpError(
        400,
        "公開済みのアンケートは下書きに戻せません。内容を変えるときは、新しい版を作って公開してください。",
      );
    }

    /*
     * 回答が1件でもあるアンケートは、タイトル・説明文も変えられないようにする。
     * 設問は同じ理由ですでに守られていたのに、ここだけ素通りだった。
     * 回答した人が読んだ見出しと、あとから集計を見る人が読む見出しが食い違うと、
     * 「何に対する回答なのか」を後から誰も確かめられなくなるため。
     * 直したいときは新しい版（version が上がる forms 行）を作る。
     */
    const editingText = input.title !== undefined || input.description !== undefined;
    if (editingText) {
      assertFormContentEditable(form);
      const answered = await db
        .select({ id: s.formResponses.id })
        .from(s.formResponses)
        .where(eq(s.formResponses.formId, form.id))
        .limit(1);
      if (answered.length > 0) {
        throw new HttpError(
          400,
          "このアンケートにはすでに回答があるため、タイトルと説明文を変更できません。内容を変えるときは新しい版を作ってください。",
        );
      }
    }

    /* 回答期間は、回答があっても直せるようにしておく。
       間に合わない人がいるときに締切を延ばすのは正当な運用で、
       過去の回答の中身を書き換えるものでもないため。逆に前後が入れ替わると
       誰も回答できない状態になるので、そこだけ止める。 */
    const nextOpensAt = input.opensAt !== undefined ? input.opensAt : form.opensAt;
    const nextClosesAt = input.closesAt !== undefined ? input.closesAt : form.closesAt;
    if (nextOpensAt && nextClosesAt && nextClosesAt < nextOpensAt) {
      throw new HttpError(400, "回答期間の開始日と締切日が逆になっています。締切日は開始日より後にしてください。");
    }

    let supersededNote = "";
    let closing: { id: string }[] = [];
    if (input.status === "published") {
      const [qs, cycle] = await Promise.all([
        db.select({ id: s.formQuestions.id }).from(s.formQuestions).where(eq(s.formQuestions.formId, form.id)),
        db.select().from(s.evaluationCycles).where(and(eq(s.evaluationCycles.id, form.cycleId), eq(s.evaluationCycles.companyId, companyId))).limit(1),
      ]);
      const cycleRow = cycle[0];
      if (!cycleRow) throw new HttpError(404, "評価期間が見つかりませんでした。");
      const schemeReadiness = await loadSchemeReadiness(companyId, cycleRow.schemeId);
      const readiness = formPublicationReadiness({
        schemeReady: schemeReadiness.schemeReady,
        cycleStatus: cycleRow.status,
        questionCount: qs.length,
      });
      if (!readiness.ready) throw new HttpError(409, readiness.message);
      // 同じサイクル・等級で公開中のものは自動で締める（回答先が2つに割れないようにする）
      const siblings = await db
        .select()
        .from(s.forms)
        .where(and(eq(s.forms.cycleId, form.cycleId), eq(s.forms.gradeId, form.gradeId), eq(s.forms.status, "published")));
      closing = siblings.filter((x) => x.id !== form.id);

      /*
       * 旧版に入力途中（draft）の回答が残っていることがある。
       * 消せば入力した本人の手間が消えるだけなので、行は一切触らず、
       * 「何人が入力途中のまま取り残されるか」を公開した人に知らせるだけにする。
       * 回答者側は一覧で「新しい版で回答してください」と案内される（/me/forms）。
       */
      if (closing.length > 0) {
        const stranded = await db
          .select({ id: s.formResponses.id })
          .from(s.formResponses)
          .where(
            and(
              inArray(
                s.formResponses.formId,
                closing.map((x) => x.id),
              ),
              eq(s.formResponses.status, "draft"),
            ),
          );
        if (stranded.length > 0) {
          supersededNote = `　前の版に入力途中の回答が${stranded.length}件あります。内容は消していません。対象の方には新しい版で回答するようご案内ください。`;
        }
      }
    }

    const saveThis = db
      .update(s.forms)
      .set({
        ...(input.status ? { status: input.status } : {}),
        ...(input.title ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.opensAt !== undefined ? { opensAt: input.opensAt } : {}),
        ...(input.closesAt !== undefined ? { closesAt: input.closesAt } : {}),
      })
      .where(eq(s.forms.id, form.id));

    if (closing.length > 0) {
      /* 古い版の締め切りと、この版の公開は1つの batch で書く。
         片方だけが通ると、公開中が2つに割れる（または1つも無くなる）ため。 */
      await db.batch([
        db
          .update(s.forms)
          .set({ status: "closed" })
          .where(
            inArray(
              s.forms.id,
              closing.map((x) => x.id),
            ),
          ),
        saveThis,
      ]);
    } else {
      await saveThis;
    }

    const message =
      input.status === "published"
        ? `アンケートを公開しました。対象の等級の方が回答できます。${supersededNote}`
        : input.status === "closed"
          ? "アンケートを締め切りました。すでに提出された回答は残ります。"
          : input.opensAt !== undefined || input.closesAt !== undefined
            ? `回答期間を保存しました（${nextOpensAt ?? "指定なし"} 〜 ${nextClosesAt ?? "指定なし"}）。締切日は当日いっぱいまで回答できます。`
            : "内容を保存しました。";
    return { message };
  });
}

const formRefSchema = z.object({ formId: z.string().min(1) });

/**
 * 設問を、いまの制度マスタ・評価セットから作り直す。
 *
 * アンケートは作った時点の制度の写しなので、評価項目を選び直すと静かにズレる。
 * ズレたまま集計すると、聞いていない項目が判定外になり配点ぶんの点が付かない。
 * 「制度が正・アンケートは写し」という向きを保つため、直すのは常にこちら側にする。
 */
export async function rebuildFormQuestions(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: formRefSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const r = await syncFormQuestions({ companyId: viewer.companyId, formId: input.formId });
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

const questionsSchema = z.object({ formId: z.string().min(1), questions: z.array(questionSchema).max(200) });

/**
 * アンケートの設問を丸ごと保存する（クリック操作の組み立て画面から呼ぶ）。
 *
 * 回答が1件でもあるアンケートは設問を編集できない。
 * 設問を差し替えると、過去の回答がどの設問への答えか分からなくなるため。
 * 直したいときは「新しい版を作る」。
 */
export async function saveFormQuestions(raw: unknown) {
  return runAction({ role: "COMPANY_ADMIN", input: questionsSchema }, raw, async ({ viewer, input }) => {
    assertCompanyChosen(viewer);
    const companyId = viewer.companyId;
    const db = await getDb();

    const form = (
      await db
        .select()
        .from(s.forms)
        .where(and(eq(s.forms.id, input.formId), eq(s.forms.companyId, companyId)))
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

    const q = input.questions;
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
    await batchAll(db, [
      db.delete(s.formQuestions).where(eq(s.formQuestions.formId, form.id)),
      ...chunkRowsForD1(rows).map((chunk) => db.insert(s.formQuestions).values(chunk)),
    ]);

    return { message: `設問を保存しました（${q.length}問）。` };
  });
}
