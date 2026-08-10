import { eq, asc } from "drizzle-orm";
import { schema as s, insertMany, type DB } from "@/lib/db";
import { newId } from "@/lib/id";

/**
 * 制度のひな形（システム標準テンプレート）を、新しい会社へ丸ごと複製する。
 *
 * 会社を追加したとき、等級・KPI・ランク基準・配点・昇給ルールを
 * ゼロから登録し直さなくて済むようにするための処理。
 * 複製したあとは会社ごとに自由に書き換えられる（元のひな形には影響しない）。
 *
 * 複製するのは「制度のマスタ」だけ。
 * 利用者・評価サイクル・アンケート・回答・評価結果・改定履歴は複製しない。
 */

/** 旧ID → 新ID の対応表 */
type IdMap = Map<string, string>;

/** 会社に属する行を、新しいIDを振り直して別の会社へ写す。 */
async function copyRows<R extends { id: string }>(
  rows: R[],
  prefix: string,
  toCompanyId: string,
  /** 参照している他テーブルのIDを差し替える */
  remap: (row: R, newId: string) => Record<string, unknown>,
  run: (values: Record<string, unknown>[]) => Promise<unknown>,
): Promise<IdMap> {
  const map: IdMap = new Map();
  const values: Record<string, unknown>[] = [];
  for (const row of rows) {
    const id = newId(prefix);
    map.set(row.id, id);
    const { createdAt: _c, updatedAt: _u, ...rest } = row as R & {
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    values.push({ ...rest, id, companyId: toCompanyId, ...remap(row, id) });
  }
  await insertMany(run, values);
  return map;
}

/** システム標準テンプレートの会社を1件返す（無ければ null）。 */
export async function findTemplateCompany(db: DB): Promise<{ id: string; name: string } | null> {
  const rows = await db
    .select({ id: s.companies.id, name: s.companies.name })
    .from(s.companies)
    .where(eq(s.companies.isTemplate, true))
    .limit(1);
  return rows[0] ?? null;
}

export type CopyResult = Record<string, number>;

/**
 * fromCompanyId の制度マスタを toCompanyId へ複製し、何件写したかを返す。
 * 呼ぶ前に、複製先の会社に制度が入っていないことを確認すること。
 */
export async function copyCompanyMasters(
  db: DB,
  fromCompanyId: string,
  toCompanyId: string,
): Promise<CopyResult> {
  const counts: CopyResult = {};
  const byCompany = <T extends { companyId: unknown }>(t: T) =>
    eq(t.companyId as never, fromCompanyId);

  /* 事業所 */
  const offices = await db.select().from(s.offices).where(byCompany(s.offices)).orderBy(asc(s.offices.displayOrder));
  await copyRows(offices, "off", toCompanyId, () => ({}), (v) => db.insert(s.offices).values(v as never));
  counts["事業所"] = offices.length;

  /* 等級 */
  const grades = await db.select().from(s.grades).where(byCompany(s.grades)).orderBy(asc(s.grades.displayOrder));
  const gradeMap = await copyRows(grades, "grd", toCompanyId, () => ({}), (v) => db.insert(s.grades).values(v as never));
  counts["等級"] = grades.length;

  /* 等級要件 */
  const greqs = await db.select().from(s.gradeRequirements).where(byCompany(s.gradeRequirements));
  await copyRows(greqs, "greq", toCompanyId, (r) => ({ gradeId: gradeMap.get(r.gradeId) }), (v) =>
    db.insert(s.gradeRequirements).values(v as never),
  );
  counts["等級要件"] = greqs.length;

  /* 昇格要件 */
  const preqs = await db.select().from(s.promotionRequirements).where(byCompany(s.promotionRequirements));
  await copyRows(preqs, "preq", toCompanyId, (r) => ({ gradeId: gradeMap.get(r.gradeId) }), (v) =>
    db.insert(s.promotionRequirements).values(v as never),
  );
  counts["昇格要件"] = preqs.length;

  /* 昇格に必要な点数 */
  const thresholds = await db.select().from(s.promotionThresholds).where(byCompany(s.promotionThresholds));
  await copyRows(
    thresholds,
    "pth",
    toCompanyId,
    (r) => ({ fromGradeId: gradeMap.get(r.fromGradeId), toGradeId: gradeMap.get(r.toGradeId) }),
    (v) => db.insert(s.promotionThresholds).values(v as never),
  );
  counts["昇格に必要な点数"] = thresholds.length;

  /* 行動指針とその段階 */
  const guidelines = await db.select().from(s.behaviorGuidelines).where(byCompany(s.behaviorGuidelines));
  const guidelineMap = await copyRows(guidelines, "bg", toCompanyId, () => ({}), (v) =>
    db.insert(s.behaviorGuidelines).values(v as never),
  );
  counts["行動指針"] = guidelines.length;

  const levels = await db.select().from(s.behaviorLevels).where(byCompany(s.behaviorLevels));
  await copyRows(levels, "blv", toCompanyId, (r) => ({ guidelineId: guidelineMap.get(r.guidelineId) }), (v) =>
    db.insert(s.behaviorLevels).values(v as never),
  );
  counts["行動指針の段階"] = levels.length;

  /* KPIカテゴリ・項目・ランク基準・設問 */
  const cats = await db.select().from(s.kpiCategories).where(byCompany(s.kpiCategories)).orderBy(asc(s.kpiCategories.displayOrder));
  const catMap = await copyRows(cats, "kcat", toCompanyId, () => ({}), (v) =>
    db.insert(s.kpiCategories).values(v as never),
  );
  counts["KPIカテゴリ"] = cats.length;

  const items = await db.select().from(s.kpiItems).where(byCompany(s.kpiItems)).orderBy(asc(s.kpiItems.no));
  const itemMap = await copyRows(
    items,
    "kpi",
    toCompanyId,
    (r) => ({ categoryId: r.categoryId ? (catMap.get(r.categoryId) ?? null) : null }),
    (v) => db.insert(s.kpiItems).values(v as never),
  );
  counts["KPI項目"] = items.length;

  const criteria = await db.select().from(s.kpiRankCriteria).where(byCompany(s.kpiRankCriteria));
  await copyRows(criteria, "krc", toCompanyId, (r) => ({ kpiItemId: itemMap.get(r.kpiItemId) }), (v) =>
    db.insert(s.kpiRankCriteria).values(v as never),
  );
  counts["ランク基準"] = criteria.length;

  const questions = await db.select().from(s.kpiQuestions).where(byCompany(s.kpiQuestions));
  await copyRows(
    questions,
    "kq",
    toCompanyId,
    (r) => ({ kpiItemId: r.kpiItemId ? (itemMap.get(r.kpiItemId) ?? null) : null }),
    (v) => db.insert(s.kpiQuestions).values(v as never),
  );
  counts["KPI設問"] = questions.length;

  /* 評価セット（8項目の選択と配点） */
  const schemes = await db.select().from(s.evaluationSchemes).where(byCompany(s.evaluationSchemes));
  const schemeMap = await copyRows(schemes, "sch", toCompanyId, () => ({}), (v) =>
    db.insert(s.evaluationSchemes).values(v as never),
  );
  counts["評価セット"] = schemes.length;

  const schemeItems = await db.select().from(s.schemeItems).where(byCompany(s.schemeItems));
  await copyRows(
    schemeItems,
    "sit",
    toCompanyId,
    (r) => ({
      schemeId: schemeMap.get(r.schemeId),
      kpiItemId: itemMap.get(r.kpiItemId),
      categoryId: r.categoryId ? (catMap.get(r.categoryId) ?? null) : null,
    }),
    (v) => db.insert(s.schemeItems).values(v as never),
  );
  counts["配点"] = schemeItems.length;

  const ratios = await db.select().from(s.schemeRankRatios).where(byCompany(s.schemeRankRatios));
  await copyRows(ratios, "srr", toCompanyId, (r) => ({ schemeId: schemeMap.get(r.schemeId) }), (v) =>
    db.insert(s.schemeRankRatios).values(v as never),
  );
  counts["ランク換算率"] = ratios.length;

  /* 昇給ルール一式 */
  const policies = await db.select().from(s.raisePolicies).where(byCompany(s.raisePolicies));
  await copyRows(policies, "rpol", toCompanyId, () => ({}), (v) => db.insert(s.raisePolicies).values(v as never));
  counts["昇給ルール"] = policies.length;

  const patterns = await db.select().from(s.raisePatterns).where(byCompany(s.raisePatterns));
  await copyRows(patterns, "rpat", toCompanyId, () => ({}), (v) => db.insert(s.raisePatterns).values(v as never));
  counts["判定パターン"] = patterns.length;

  const exceptions = await db.select().from(s.raiseExceptions).where(byCompany(s.raiseExceptions));
  await copyRows(exceptions, "rexc", toCompanyId, () => ({}), (v) => db.insert(s.raiseExceptions).values(v as never));
  counts["昇給の特例"] = exceptions.length;

  const settings = await db.select().from(s.raiseSettings).where(byCompany(s.raiseSettings));
  await copyRows(settings, "rset", toCompanyId, (r) => ({ gradeId: gradeMap.get(r.gradeId) }), (v) =>
    db.insert(s.raiseSettings).values(v as never),
  );
  counts["昇給額"] = settings.length;

  /* 事業所KGI達成係数 */
  const kgi = await db.select().from(s.kgiCoefficients).where(byCompany(s.kgiCoefficients));
  await copyRows(kgi, "kgi", toCompanyId, () => ({}), (v) => db.insert(s.kgiCoefficients).values(v as never));
  counts["KGI係数"] = kgi.length;

  return counts;
}
