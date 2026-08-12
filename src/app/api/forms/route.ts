import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { apiViewer, HttpError } from "@/lib/session";
import { handle } from "@/lib/api";
import { assertFormContentEditable, buildFormDrafts, type FormDraftInput } from "@/lib/form-build";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  cycleId: z.string().min(1),
  /** 省略したら、その会社の全等級ぶんをまとめて作る */
  gradeIds: z.array(z.string().min(1)).optional(),
  title: z.string().max(80).optional(),
});

/** アンケートの下書きを制度マスタから作る。 */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = createSchema.parse(await req.json());
    const db = await getDb();

    const grades = await db.select().from(s.grades).where(eq(s.grades.companyId, companyId));
    const targets = body.gradeIds
      ? grades.filter((g) => body.gradeIds!.includes(g.id))
      : grades.filter((g) => g.isActive);
    if (targets.length === 0) throw new HttpError(400, "対象の等級がありません。");

    /* 全等級ぶんを1つのD1 batchで保存する。途中の等級で失敗しても、前半だけ残さない。 */
    const [firstTarget, ...remainingTargets] = targets;
    const toDraftInput = (gradeId: string): FormDraftInput => ({
      companyId,
      cycleId: body.cycleId,
      gradeId,
      title: body.title,
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

/** アンケートの公開・締め切り・タイトル変更。 */
export async function PATCH(req: Request) {
  return handle(async () => {
    const viewer = await apiViewer("COMPANY_ADMIN");
    if (!viewer.companyId) throw new HttpError(400, "所属会社が設定されていません。");
    const companyId = viewer.companyId;
    const body = patchSchema.parse(await req.json());
    const db = await getDb();

    const form = (
      await db
        .select()
        .from(s.forms)
        .where(and(eq(s.forms.id, body.formId), eq(s.forms.companyId, companyId)))
        .limit(1)
    )[0];
    if (!form) throw new HttpError(404, "アンケートが見つかりませんでした。");

    // 公開した版は、回答が0件でもすでに読まれている可能性がある。
    // 同じ版を下書きに戻して文面を変えると「何を配った版か」が残らないため、
    // 内容を変える場合は既存の版作成フローで新しい下書きを作る。
    if (body.status === "draft" && form.status !== "draft") {
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
    const editingText = body.title !== undefined || body.description !== undefined;
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
    const nextOpensAt = body.opensAt !== undefined ? body.opensAt : form.opensAt;
    const nextClosesAt = body.closesAt !== undefined ? body.closesAt : form.closesAt;
    if (nextOpensAt && nextClosesAt && nextClosesAt < nextOpensAt) {
      throw new HttpError(400, "回答期間の開始日と締切日が逆になっています。締切日は開始日より後にしてください。");
    }

    let supersededNote = "";
    if (body.status === "published") {
      const qs = await db.select({ id: s.formQuestions.id }).from(s.formQuestions).where(eq(s.formQuestions.formId, form.id));
      if (qs.length === 0) throw new HttpError(400, "設問が1問もありません。設問を追加してから公開してください。");
      // 同じサイクル・等級で公開中のものは自動で締める（回答先が2つに割れないようにする）
      const siblings = await db
        .select()
        .from(s.forms)
        .where(and(eq(s.forms.cycleId, form.cycleId), eq(s.forms.gradeId, form.gradeId), eq(s.forms.status, "published")));
      const closing = siblings.filter((x) => x.id !== form.id);
      for (const sib of closing) {
        await db.update(s.forms).set({ status: "closed" }).where(eq(s.forms.id, sib.id));
      }

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

    await db
      .update(s.forms)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.title ? { title: body.title.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.opensAt !== undefined ? { opensAt: body.opensAt } : {}),
        ...(body.closesAt !== undefined ? { closesAt: body.closesAt } : {}),
      })
      .where(eq(s.forms.id, form.id));

    const message =
      body.status === "published"
        ? `アンケートを公開しました。対象の等級の方が回答できます。${supersededNote}`
        : body.status === "closed"
          ? "アンケートを締め切りました。すでに提出された回答は残ります。"
          : body.opensAt !== undefined || body.closesAt !== undefined
            ? `回答期間を保存しました（${nextOpensAt ?? "指定なし"} 〜 ${nextClosesAt ?? "指定なし"}）。締切日は当日いっぱいまで回答できます。`
            : "内容を保存しました。";
    return { message };
  });
}
