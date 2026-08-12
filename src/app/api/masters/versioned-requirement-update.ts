import { and, eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { getDb } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { newId } from "@/lib/id";
import { GRADE_REQUIREMENT_MAX, swapForMove } from "@/lib/domain/grade-requirements";
import { currentVersionRows, lineageRootId, versionFamilyIds } from "@/lib/domain/versioned-master";
import { recordConstitutionEvent } from "@/lib/domain/constitution-events";
import type { MasterUpdateBody } from "./body-schema";

type Db = Awaited<ReturnType<typeof getDb>>;
type RequirementBody = Extract<
  MasterUpdateBody,
  {
    kind:
      | "gradeRequirementCreate"
      | "gradeRequirementRevise"
      | "gradeRequirementActivation"
      | "gradeRequirementRestoreContent"
      | "gradeRequirementOrder"
      | "promotionRequirementCreate"
      | "promotionRequirementRevise"
      | "promotionRequirementActivation"
      | "promotionRequirementRestoreContent"
      | "promotionRequirementOrder";
  }
>;

export type RequirementUpdateResult = {
  message: string;
  id?: string;
  previousVersionId?: string;
};

const terminal = <T extends { id: string; previousVersionId: string | null }>(rows: T[], id: string): T | null =>
  currentVersionRows(rows).find((row) => row.id === id) ?? null;

const cleanOptional = (value: string | null | undefined): string | null => value?.trim() || null;

function databaseMessage(error: unknown): string {
  if (error instanceof Error) return `${error.message} ${(error as { cause?: unknown }).cause ?? ""}`;
  return String(error);
}

/** migration trigger / UNIQUE が止めた競合を、画面が扱える業務エラーへ戻す。 */
function translateWriteError(error: unknown, label: string): never {
  const message = databaseMessage(error);
  if (message.includes("grade_requirement_active_limit")) {
    throw new HttpError(400, `「支援について」「運営について」は、それぞれ${GRADE_REQUIREMENT_MAX}項目までです。`);
  }
  if (
    message.includes("previous_version") ||
    message.includes("past_version_active") ||
    message.includes("past_version_immutable") ||
    message.includes("version_scope") ||
    message.includes("semantic_immutable")
  ) {
    throw new HttpError(409, `${label}は別の画面ですでに変更されています。画面を更新して、現在の版を確認してください。`);
  }
  throw error;
}

async function ownGrade(db: Db, companyId: string, gradeId: string) {
  const row = (
    await db
      .select({ id: s.grades.id })
      .from(s.grades)
      .where(and(eq(s.grades.id, gradeId), eq(s.grades.companyId, companyId)))
      .limit(1)
  )[0];
  if (!row) throw new HttpError(404, "等級が見つかりませんでした。");
}

async function gradeRows(db: Db, companyId: string) {
  return db.select().from(s.gradeRequirements).where(eq(s.gradeRequirements.companyId, companyId));
}

async function promotionRows(db: Db, companyId: string) {
  return db.select().from(s.promotionRequirements).where(eq(s.promotionRequirements.companyId, companyId));
}

async function reviseGrade(
  db: Db,
  companyId: string,
  current: Awaited<ReturnType<typeof gradeRows>>[number],
  text: string,
  actorId: string,
  allRows: Awaited<ReturnType<typeof gradeRows>>,
): Promise<RequirementUpdateResult> {
  const nextText = text.trim();
  if (current.text === nextText) return { message: "内容は変わっていないため、新しい版は作りませんでした。", id: current.id };

  const id = newId("greq");
  try {
    /* 旧版は利用状態を含む全カラムを当時の記録として不変にする。後続行の存在が
       「過去版」を表すため、現行の選定に旧 is_active を使わない。 */
    await db.insert(s.gradeRequirements).values({
      id,
      companyId,
      gradeId: current.gradeId,
      category: current.category,
      seq: current.seq,
      text: nextText,
      isActive: true,
      previousVersionId: current.id,
    });
  } catch (error) {
    translateWriteError(error, "等級要件");
  }
  await recordConstitutionEvent({
    db,
    companyId,
    entityType: "gradeRequirement",
    entityId: lineageRootId(allRows, current.id),
    eventType: "revised",
    actorId,
    before: current,
    after: { ...current, id, text: nextText, previousVersionId: current.id },
  });
  return {
    message: "等級要件の新しい版を作りました。次に作るアンケートから反映し、作成済みのアンケートと評価は変わりません。",
    id,
    previousVersionId: current.id,
  };
}

async function revisePromotion(
  db: Db,
  companyId: string,
  current: Awaited<ReturnType<typeof promotionRows>>[number],
  values: { text: string; transitionLabel: string | null; isGate: boolean },
  actorId: string,
  allRows: Awaited<ReturnType<typeof promotionRows>>,
): Promise<RequirementUpdateResult> {
  const next = { ...values, text: values.text.trim(), transitionLabel: cleanOptional(values.transitionLabel) };
  if (
    current.text === next.text &&
    current.transitionLabel === next.transitionLabel &&
    current.isGate === next.isGate
  ) {
    return { message: "内容は変わっていないため、新しい版は作りませんでした。", id: current.id };
  }

  const id = newId("preq");
  try {
    await db.insert(s.promotionRequirements).values({
      id,
      companyId,
      gradeId: current.gradeId,
      kind: current.kind,
      transitionLabel: next.transitionLabel,
      seq: current.seq,
      text: next.text,
      isGate: next.isGate,
      isActive: true,
      previousVersionId: current.id,
    });
  } catch (error) {
    translateWriteError(error, "昇格要件");
  }
  await recordConstitutionEvent({
    db,
    companyId,
    entityType: "promotionRequirement",
    entityId: lineageRootId(allRows, current.id),
    eventType: "revised",
    actorId,
    before: current,
    after: { ...current, id, ...next, previousVersionId: current.id },
  });
  return {
    message: "昇格要件の新しい版を作りました。次に作るアンケートから反映し、作成済みのアンケートと評価は変わりません。",
    id,
    previousVersionId: current.id,
  };
}

export async function applyVersionedRequirementUpdate(args: {
  db: Db;
  companyId: string;
  viewerId: string;
  body: RequirementBody;
}): Promise<RequirementUpdateResult> {
  const { db, companyId, viewerId, body } = args;

  switch (body.kind) {
    case "gradeRequirementCreate": {
      await ownGrade(db, companyId, body.gradeId);
      const rows = await gradeRows(db, companyId);
      const siblings = currentVersionRows(rows).filter(
        (row) => row.gradeId === body.gradeId && row.category === body.category,
      );
      if (siblings.filter((row) => row.isActive).length >= GRADE_REQUIREMENT_MAX) {
        throw new HttpError(400, `「${body.category === "support" ? "支援について" : "運営について"}」は${GRADE_REQUIREMENT_MAX}項目までです。`);
      }
      const id = newId("greq");
      try {
        await db.insert(s.gradeRequirements).values({
          id,
          companyId,
          gradeId: body.gradeId,
          category: body.category,
          seq: siblings.reduce((max, row) => Math.max(max, row.seq), 0) + 1,
          text: body.text.trim(),
          isActive: true,
        });
      } catch (error) {
        translateWriteError(error, "等級要件");
      }
      await recordConstitutionEvent({
        db,
        companyId,
        entityType: "gradeRequirement",
        entityId: id,
        eventType: "created",
        actorId: viewerId,
        after: { id, gradeId: body.gradeId, category: body.category, text: body.text.trim(), isActive: true },
      });
      return { message: "等級要件を追加しました。次に作るアンケートから設問に載ります。", id };
    }

    case "gradeRequirementRevise": {
      const rows = await gradeRows(db, companyId);
      const current = terminal(rows, body.id);
      if (!rows.some((row) => row.id === body.id)) throw new HttpError(404, "等級要件が見つかりませんでした。");
      if (!current) throw new HttpError(409, "この等級要件には新しい版があります。画面を更新してください。");
      if (!current.isActive) throw new HttpError(409, "使わない状態の項目は、もう一度使う状態にしてから内容を変更してください。");
      return reviseGrade(db, companyId, current, body.text, viewerId, rows);
    }

    case "gradeRequirementActivation": {
      const rows = await gradeRows(db, companyId);
      const current = terminal(rows, body.id);
      if (!rows.some((row) => row.id === body.id)) throw new HttpError(404, "等級要件が見つかりませんでした。");
      if (!current) throw new HttpError(409, "過去の版はもう一度使う状態にできません。現在の版を操作してください。");
      if (current.isActive === body.isActive) return { message: "利用状態はすでに最新です。", id: current.id };
      if (body.isActive) {
        const active = currentVersionRows(rows).filter(
          (row) => row.gradeId === current.gradeId && row.category === current.category && row.isActive,
        ).length;
        if (active >= GRADE_REQUIREMENT_MAX) {
          throw new HttpError(400, `この区分は${GRADE_REQUIREMENT_MAX}項目までです。ほかの項目を使わない状態にしてから戻してください。`);
        }
      }
      try {
        await db
          .update(s.gradeRequirements)
          .set({ isActive: body.isActive })
          .where(and(eq(s.gradeRequirements.id, current.id), eq(s.gradeRequirements.companyId, companyId)));
      } catch (error) {
        translateWriteError(error, "等級要件");
      }
      await recordConstitutionEvent({
        db,
        companyId,
        entityType: "gradeRequirement",
        entityId: lineageRootId(rows, current.id),
        eventType: body.isActive ? "activated" : "deactivated",
        actorId: viewerId,
        before: current,
        after: { ...current, isActive: body.isActive },
      });
      return {
        message: body.isActive
          ? "等級要件をもう一度使う状態にしました。次に作るアンケートから反映し、作成済みのアンケートと評価は変わりません。"
          : "等級要件を使わない状態にしました。次に作るアンケートから外れ、作成済みのアンケートと評価は変わりません。",
        id: current.id,
      };
    }

    case "gradeRequirementRestoreContent": {
      const rows = await gradeRows(db, companyId);
      const current = terminal(rows, body.id);
      if (!rows.some((row) => row.id === body.id)) throw new HttpError(404, "等級要件が見つかりませんでした。");
      if (!current) throw new HttpError(409, "この等級要件には新しい版があります。画面を更新してください。");
      if (!current.isActive) throw new HttpError(409, "使わない状態の項目は、もう一度使う状態にしてから内容を戻してください。");
      if (!versionFamilyIds(rows, current.id).includes(body.sourceVersionId)) {
        throw new HttpError(404, "同じ項目の変更履歴に、指定された版が見つかりませんでした。");
      }
      const source = rows.find((row) => row.id === body.sourceVersionId)!;
      return reviseGrade(db, companyId, current, source.text, viewerId, rows);
    }

    case "gradeRequirementOrder": {
      const rows = await gradeRows(db, companyId);
      const current = terminal(rows, body.id);
      if (!rows.some((row) => row.id === body.id)) throw new HttpError(404, "等級要件が見つかりませんでした。");
      if (!current || !current.isActive) throw new HttpError(409, "現在使っている版だけ並べ替えられます。画面を更新してください。");
      const siblings = currentVersionRows(rows).filter((row) => row.gradeId === current.gradeId);
      const swap = swapForMove(siblings, current.category, current.id, body.direction);
      if (!swap) throw new HttpError(400, "これ以上は動かせません。");
      try {
        await db.batch([
          db.update(s.gradeRequirements).set({ seq: swap[0].seq }).where(eq(s.gradeRequirements.id, swap[0].id)),
          db.update(s.gradeRequirements).set({ seq: swap[1].seq }).where(eq(s.gradeRequirements.id, swap[1].id)),
        ] as unknown as Parameters<typeof db.batch>[0]);
      } catch (error) {
        translateWriteError(error, "等級要件");
      }
      await recordConstitutionEvent({
        db,
        companyId,
        entityType: "gradeRequirement",
        entityId: lineageRootId(rows, current.id),
        eventType: "reordered",
        actorId: viewerId,
        before: { seq: current.seq },
        after: { seq: swap.find((row) => row.id === current.id)?.seq ?? current.seq },
      });
      return { message: "並び順を変更しました。", id: current.id };
    }

    case "promotionRequirementCreate": {
      await ownGrade(db, companyId, body.gradeId);
      const rows = await promotionRows(db, companyId);
      const siblings = currentVersionRows(rows).filter(
        (row) => row.gradeId === body.gradeId && row.kind === body.reqKind,
      );
      const id = newId("preq");
      await db.insert(s.promotionRequirements).values({
        id,
        companyId,
        gradeId: body.gradeId,
        kind: body.reqKind,
        transitionLabel: cleanOptional(body.transitionLabel),
        seq: siblings.reduce((max, row) => Math.max(max, row.seq), 0) + 1,
        text: body.text.trim(),
        isGate: body.isGate ?? true,
        isActive: true,
      });
      await recordConstitutionEvent({
        db,
        companyId,
        entityType: "promotionRequirement",
        entityId: id,
        eventType: "created",
        actorId: viewerId,
        after: {
          id,
          gradeId: body.gradeId,
          kind: body.reqKind,
          transitionLabel: cleanOptional(body.transitionLabel),
          text: body.text.trim(),
          isGate: body.isGate ?? true,
          isActive: true,
        },
      });
      return { message: "昇格要件を追加しました。次に作るアンケートから設問に載ります。", id };
    }

    case "promotionRequirementRevise": {
      const rows = await promotionRows(db, companyId);
      const current = terminal(rows, body.id);
      if (!rows.some((row) => row.id === body.id)) throw new HttpError(404, "昇格要件が見つかりませんでした。");
      if (!current) throw new HttpError(409, "この昇格要件には新しい版があります。画面を更新してください。");
      if (!current.isActive) throw new HttpError(409, "使わない状態の項目は、もう一度使う状態にしてから内容を変更してください。");
      return revisePromotion(
        db,
        companyId,
        current,
        {
          text: body.text,
          transitionLabel: body.transitionLabel ?? null,
          isGate: body.isGate,
        },
        viewerId,
        rows,
      );
    }

    case "promotionRequirementActivation": {
      const rows = await promotionRows(db, companyId);
      const current = terminal(rows, body.id);
      if (!rows.some((row) => row.id === body.id)) throw new HttpError(404, "昇格要件が見つかりませんでした。");
      if (!current) throw new HttpError(409, "過去の版はもう一度使う状態にできません。現在の版を操作してください。");
      if (current.isActive === body.isActive) return { message: "利用状態はすでに最新です。", id: current.id };
      try {
        await db
          .update(s.promotionRequirements)
          .set({ isActive: body.isActive })
          .where(and(eq(s.promotionRequirements.id, current.id), eq(s.promotionRequirements.companyId, companyId)));
      } catch (error) {
        translateWriteError(error, "昇格要件");
      }
      await recordConstitutionEvent({
        db,
        companyId,
        entityType: "promotionRequirement",
        entityId: lineageRootId(rows, current.id),
        eventType: body.isActive ? "activated" : "deactivated",
        actorId: viewerId,
        before: current,
        after: { ...current, isActive: body.isActive },
      });
      return {
        message: body.isActive
          ? "昇格要件をもう一度使う状態にしました。次に作るアンケートから反映し、作成済みのアンケートと評価は変わりません。"
          : "昇格要件を使わない状態にしました。次に作るアンケートから外れ、作成済みのアンケートと評価は変わりません。",
        id: current.id,
      };
    }

    case "promotionRequirementRestoreContent": {
      const rows = await promotionRows(db, companyId);
      const current = terminal(rows, body.id);
      if (!rows.some((row) => row.id === body.id)) throw new HttpError(404, "昇格要件が見つかりませんでした。");
      if (!current) throw new HttpError(409, "この昇格要件には新しい版があります。画面を更新してください。");
      if (!current.isActive) throw new HttpError(409, "使わない状態の項目は、もう一度使う状態にしてから内容を戻してください。");
      if (!versionFamilyIds(rows, current.id).includes(body.sourceVersionId)) {
        throw new HttpError(404, "同じ項目の変更履歴に、指定された版が見つかりませんでした。");
      }
      const source = rows.find((row) => row.id === body.sourceVersionId)!;
      return revisePromotion(
        db,
        companyId,
        current,
        {
          text: source.text,
          transitionLabel: source.transitionLabel,
          isGate: source.isGate,
        },
        viewerId,
        rows,
      );
    }

    case "promotionRequirementOrder": {
      const rows = await promotionRows(db, companyId);
      const current = terminal(rows, body.id);
      if (!rows.some((row) => row.id === body.id)) throw new HttpError(404, "昇格要件が見つかりませんでした。");
      if (!current || !current.isActive) throw new HttpError(409, "現在使っている版だけ並べ替えられます。画面を更新してください。");
      const siblings = currentVersionRows(rows)
        .filter((row) => row.gradeId === current.gradeId)
        .map((row) => ({
          id: row.id,
          category: row.kind,
          seq: row.seq,
          text: row.text,
          isActive: row.isActive,
          previousVersionId: row.previousVersionId,
        }));
      const swap = swapForMove(siblings, current.kind, current.id, body.direction);
      if (!swap) throw new HttpError(400, "これ以上は動かせません。");
      try {
        await db.batch([
          db.update(s.promotionRequirements).set({ seq: swap[0].seq }).where(eq(s.promotionRequirements.id, swap[0].id)),
          db.update(s.promotionRequirements).set({ seq: swap[1].seq }).where(eq(s.promotionRequirements.id, swap[1].id)),
        ] as unknown as Parameters<typeof db.batch>[0]);
      } catch (error) {
        translateWriteError(error, "昇格要件");
      }
      await recordConstitutionEvent({
        db,
        companyId,
        entityType: "promotionRequirement",
        entityId: lineageRootId(rows, current.id),
        eventType: "reordered",
        actorId: viewerId,
        before: { seq: current.seq },
        after: { seq: swap.find((row) => row.id === current.id)?.seq ?? current.seq },
      });
      return { message: "並び順を変更しました。", id: current.id };
    }
  }
}
