/**
 * シードデータの組み立て。
 * data/*.json（元スプレッドシートから抽出した制度マスタ）を読み、
 * デモ2社ぶんのマスタ・過去2サイクルの回答と評価結果を組み立てて SQL 文の配列を返す。
 */
import { readFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));

const kpiMaster = read("kpi-master.json");
const kpiRanks = read("kpi-ranks.json");
const kpiQuestions = read("kpi-questions.json");
const kpiPoints = read("kpi-points.json");
const gradesDef = read("grades.json");
const gradeReqs = read("grade-requirements.json");
const promoReqs = read("promotion-requirements.json");
const behaviors = read("behavior-guidelines.json");

/* ───────────────── 7カテゴリ（等級要件達成率を除く32項目の分類） ─────────────────
 * 「各社がカテゴリごとに1項目ずつ選ぶ」ための分類。経営課題の領域で切っている。
 */
export const CATEGORIES = [
  { code: "sales", name: "売上・収益", description: "売上と利益を予算どおり確保できたかを測る領域", items: [6, 9, 12, 24] },
  { code: "occupancy", name: "稼働・利用者獲得", description: "定員に対する稼働と、新しい利用者の獲得を測る領域", items: [5, 10, 14, 30, 33] },
  { code: "compliance", name: "コンプライアンス・減算防止", description: "期限・基準を守り、減算や運営指導の指摘を防げたかを測る領域", items: [15, 16, 17, 25, 29] },
  { code: "safety", name: "安全・リスク管理", description: "事故につながる芽を拾い、業務上の誤りを防げたかを測る領域", items: [2, 22, 31] },
  { code: "hr", name: "人材・組織", description: "スタッフが定着し、育ち、無理なく働けているかを測る領域", items: [4, 7, 8, 11, 20] },
  { code: "quality", name: "支援品質・顧客満足", description: "支援そのものの質と、利用者・家族・関係機関からの評価を測る領域", items: [3, 13, 18, 19, 21, 23, 28] },
  { code: "growth", name: "成長・チーム貢献", description: "改善提案やチームへの貢献など、前に進める力を測る領域", items: [26, 27, 32] },
];

const categoryOfItem = new Map();
for (const c of CATEGORIES) for (const no of c.items) categoryOfItem.set(no, c.code);

/* ───────────────── 補助 ───────────────── */

const q = (v) => {
  if (v === null || v === undefined || v === "" || v === "-" || v === "－") return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
};
const num = (v) => {
  if (v === null || v === undefined || v === "" || v === "-" || v === "－") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};
const T = (d) => d.getTime();
const NOW = T(new Date("2026-08-10T09:00:00Z"));
/**
 * 判定に使う基準（等級要件・配点・ランク基準など）を整備した日。
 * 過去の評価より前の日付にしておく。
 * これらを NOW にすると「基準を直したのに集計し直していない評価がある」と
 * 最初から警告が出てしまい、本当に直したときに気づけなくなるため（→ src/lib/impact.ts）。
 */
const MASTER_AT = T(new Date("2025-01-01T00:00:00Z"));

/** 決まった順番で同じ結果になる簡易乱数（デモデータを毎回同じにするため） */
function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const insert = (table, rows) => {
  if (!rows.length) return [];
  const cols = Object.keys(rows[0]);
  // D1 の1文あたりの上限を避けるため 60行ずつに割る
  const out = [];
  for (let i = 0; i < rows.length; i += 60) {
    const chunk = rows.slice(i, i + 60);
    out.push(
      `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES\n` +
        chunk.map((r) => `(${cols.map((c) => q(r[c])).join(", ")})`).join(",\n") +
        ";",
    );
  }
  return out;
};

/* ───────────────── 会社定義 ───────────────── */

const COMPANIES = [
  {
    /**
     * システム標準テンプレート。
     * 元スプレッドシートの制度をそのまま持つ「原本」で、利用者・サイクル・回答は持たない。
     * 新しい会社を作るときは、この会社のマスタを丸ごとコピーしてから会社ごとに書き換える。
     */
    key: "template",
    name: "システム標準テンプレート",
    isTemplate: true,
    scheme: { sales: [9, 14], occupancy: [10, 12], compliance: [16, 12], safety: [2, 10], hr: [11, 12], quality: [13, 12], growth: [27, 10] },
    schemeName: "標準評価セット（テンプレート）",
    offices: [{ code: "hq", name: "本部" }],
  },
  {
    /** 元スプレッドシートで実際に運用していた給付事業。1社目のテナント。 */
    key: "kyufu",
    name: "給付事業（1社目）",
    isTenantOfRecord: true,
    scheme: { sales: [9, 14], occupancy: [10, 12], compliance: [16, 12], safety: [2, 10], hr: [11, 12], quality: [13, 12], growth: [27, 10] },
    schemeName: "2026年度 標準評価セット",
    offices: [{ code: "hq", name: "本部" }, { code: "office1", name: "第1事業所" }, { code: "office2", name: "第2事業所" }],
  },
  {
    key: "sakura",
    name: "さくら福祉会",
    /** この会社が選ぶ7カテゴリの項目（カテゴリごとに1つ）と配点 */
    scheme: { sales: [9, 14], occupancy: [10, 12], compliance: [16, 12], safety: [2, 10], hr: [11, 12], quality: [13, 12], growth: [27, 10] },
    schemeName: "2026年度 標準評価セット",
    offices: [{ code: "hq", name: "本部" }, { code: "office1", name: "第1事業所" }, { code: "office2", name: "第2事業所" }],
  },
  {
    key: "mirai",
    name: "みらい支援ネット",
    scheme: { sales: [6, 12], occupancy: [5, 12], compliance: [15, 14], safety: [31, 10], hr: [20, 12], quality: [21, 12], growth: [32, 13] },
    schemeName: "2026年度 コンプライアンス重点セット",
    offices: [{ code: "hq", name: "本部" }, { code: "office1", name: "第1事業所" }, { code: "office2", name: "第2事業所" }],
  },
];

/* ───────────────── 昇給ルール（元シート「KPI基準定義_昇給ルール（仮）」より） ───────────────── */

const RAISE_POLICY = {
  judge_unit: "半期（4月〜9月／10月〜3月）ごとに、選択した8項目すべてのランクで判定する",
  judge_timing_note: "上期＝9月末時点の実績／下期＝3月末時点の実績",
  reflect_upper_note: "上期評価 → 11月支給分から反映",
  reflect_lower_note: "下期評価 → 5月支給分から反映",
  raise_form: "月額基本給への上乗せ（定額）",
  target_note: "判定対象の半期を通じて在籍していた者",
  allow_decrease: 0,
  chances_per_year: 2,
  selected_item_count: 8,
  required_a_count: 8,
  streak_enabled: 0,
  streak2_multiplier: 1.5,
  streak3_multiplier: 2,
  streak_max_multiplier: 2,
  rounding_unit: 100,
  bonus_yen_per_point: 3200,
  bonus_pool_yen: 930000,
  note: "元シートでは連続達成の加算は「使わない」設定。賞与は 個人Pt（KPI評価点合計 × 事業所KGI達成係数）× 1点あたり金額 で求める。",
};

const RAISE_PATTERNS = [
  ["8項目すべてA", "昇給要件を満たす", "等級別の昇給額を反映する"],
  ["7項目A・1項目B", "見送り", "昇給なし（据え置き）。面談でBだった項目と次期の改善計画を確認する"],
  ["A以外がC以下を含む", "見送り", "昇給なし。CまたはD以下の項目については改善計画の提出を求める"],
  ["Eが1項目でもある", "見送り", "昇給なし。原因の分析と是正を上長と共有する"],
];

const RAISE_EXCEPTIONS = [
  ["中途入職者（在籍が半期に満たない）", "その半期は判定対象外。次の半期から対象とする", 1],
  ["産前産後休業・育児休業・傷病休職を挟んだ者", "在籍月数が半期の半分（3ヶ月）未満なら判定対象外。3ヶ月以上なら通常どおり判定する", 1],
  ["時短勤務者", "通常どおり判定する。件数で測る項目（ヒヤリ報告・改善提案）は所定労働時間で按分する", 0],
  ["期中に等級が変わった者", "期末時点の等級で判定する", 0],
  ["期中に異動した者", "期末時点の所属事業所の実績で判定する。個人実績の項目は異動前後を通算する", 0],
  ["最低賃金改定・法定の賃金改定", "本ルールとは別枠で反映する。全項目A未達でも法定改定は行う", 0],
  ["処遇改善加算・特定処遇改善加算の配分", "本ルールとは別枠。加算の配分要件が優先する", 0],
];

/** 等級ごとの昇給額（月額）と、同じ等級のまま昇給できる回数の上限 */
const RAISE_BY_GRADE = {
  beginner: { amount: 3000, max: 6, note: "等級要件達成率のみで評価するため、他等級より判定項目が少ない" },
  regular: { amount: 4000, max: 8, note: "KPI項目2つ＋等級要件" },
  chief: { amount: 5000, max: 8, note: "事業所実績への責任が発生する" },
  am1: { amount: 6000, max: 8, note: "管理者としての実績が加わる" },
  am2: { amount: 7000, max: 8, note: null },
  manager1: { amount: 8000, max: 10, note: "事業所全体の経営数値に責任を持つ" },
  manager2: { amount: 10000, max: 10, note: "法人全体への影響が最も大きい" },
};
// 等級要件達成率（固定枠）の配点＝100 − 他7項目の合計
for (const c of COMPANIES) {
  const rest = Object.values(c.scheme).reduce((s, [, w]) => s + w, 0);
  c.fixedWeight = 100 - rest;
}

const CYCLES = [
  { key: "2025h1", name: "2025年度 上期", start: "2025-04-01", end: "2025-09-30", status: "closed" },
  { key: "2025h2", name: "2025年度 下期", start: "2025-10-01", end: "2026-03-31", status: "closed" },
  { key: "2026h1", name: "2026年度 上期", start: "2026-04-01", end: "2026-09-30", status: "open" },
];

const EMPLOYEES = [
  { key: "e1", name: "田中 陽子", grade: "beginner", dept: "第1事業所", hired: "2025-04-01" },
  { key: "e2", name: "佐藤 健太", grade: "regular", dept: "第1事業所", hired: "2023-04-01" },
  { key: "e3", name: "鈴木 美咲", grade: "regular", dept: "第2事業所", hired: "2023-10-01" },
  { key: "e4", name: "高橋 直樹", grade: "chief", dept: "第1事業所", hired: "2021-04-01" },
  { key: "e5", name: "伊藤 さやか", grade: "chief", dept: "第2事業所", hired: "2021-04-01" },
  { key: "e6", name: "渡辺 拓也", grade: "am1", dept: "第1事業所", hired: "2019-04-01" },
  { key: "e7", name: "山本 千夏", grade: "am2", dept: "第2事業所", hired: "2018-04-01" },
  { key: "e8", name: "中村 和彦", grade: "manager1", dept: "本部", hired: "2016-04-01" },
];

/**
 * デモ用の「実力の目安」。1.0 は全項目Aで昇給要件を満たす人。
 * 昇給・昇格の両方の判定結果が画面で確認できるように、通る人と通らない人を意図的に混ぜている。
 */
const STRENGTH = {
  "e2:2025h1": 1, "e5:2025h2": 1, "e7:2025h2": 1,
  e1: 0.35, e2: 0.7, e3: 0.5, e4: 0.8, e5: 0.75, e6: 0.6, e7: 0.85, e8: 0.9,
};

export const DEMO_PASSWORD = "Hyoka2026!demo";

/* ───────────────── 本体 ───────────────── */

export async function buildSeed() {
  const sql = [];
  const pw = await hashPassword(DEMO_PASSWORD);

  const companies = [];
  const users = [];
  const accounts = [];
  const grades = [];
  const gradeRequirements = [];
  const promotionRequirements = [];
  const behaviorGuidelines = [];
  const behaviorLevels = [];
  const promotionThresholds = [];
  const kpiCategories = [];
  const kpiItems = [];
  const kpiRankCriteria = [];
  const kpiQuestionRows = [];
  const schemes = [];
  const schemeItems = [];
  const schemeRankRatios = [];
  const cycles = [];
  const forms = [];
  const formQuestions = [];
  const formResponses = [];
  const formAnswers = [];
  const evaluations = [];
  const evaluationItems = [];
  const evaluationBehaviors = [];
  const evaluationRequirements = [];
  const evaluationGates = [];
  const raiseSettings = [];
  const raisePolicies = [];
  const raisePatterns = [];
  const raiseExceptions = [];
  const raiseRevisions = [];
  const offices = [];
  const kgiCoefficients = [];
  const employeeNotes = [];

  // システム全体管理者（会社に属さない）
  users.push({
    id: "usr_super", name: "青木 統括", email: "super@hyoka-demo.jp",
    email_verified: 1, image: null, company_id: null, role: "SUPER_ADMIN", grade_id: null, office_id: null, manager_id: null,
    employee_code: "SYS-001", department: "システム管理", hired_at: "2015-04-01",
    profile_note: "全会社の評価状況を横断で確認する担当。", is_active: 1, created_at: NOW, updated_at: NOW,
  });
  accounts.push({
    id: "acc_super", account_id: "usr_super", provider_id: "credential", user_id: "usr_super",
    access_token: null, refresh_token: null, id_token: null, access_token_expires_at: null,
    refresh_token_expires_at: null, scope: null, password: pw, created_at: NOW, updated_at: NOW,
  });

  for (const co of COMPANIES) {
    const cid = `cmp_${co.key}`;
    companies.push({
      id: cid, name: co.name, slug: co.key, business_type: "給付事業", is_active: 1,
      is_template: co.isTemplate ? 1 : 0,
      template_source_id: co.isTemplate ? null : "cmp_template",
      created_at: NOW, updated_at: NOW,
    });

    /* 事業所 */
    const offId = (code) => `off_${co.key}_${code}`;
    (co.offices ?? []).forEach((o, i) => {
      offices.push({
        id: offId(o.code), company_id: cid, code: o.code, name: o.name, display_order: i + 1,
        raise_adjust_rate: 1, is_active: 1, created_at: NOW, updated_at: NOW,
      });
    });

    /* 等級 */
    const gid = (code) => `grd_${co.key}_${code}`;
    gradesDef.forEach((g, i) => {
      grades.push({
        id: gid(g.code), company_id: cid, code: g.code, name: g.name, point_group: g.pointGroup,
        display_order: i + 1, target_cap: g.targetCap, autonomy_level: g.autonomy,
        responsibility_level: g.resp, deadline_note: g.deadline, behavior_band: g.band,
        is_active: 1, created_at: NOW, updated_at: NOW,
      });
    });

    /* 等級要件 */
    gradeReqs.forEach((r, i) => {
      gradeRequirements.push({
        id: `greq_${co.key}_${i}`, company_id: cid, grade_id: gid(r.gradeCode), category: r.category,
        seq: r.seq, text: r.text, is_active: 1, created_at: NOW, updated_at: MASTER_AT,
      });
    });

    /* 昇格要件 */
    promoReqs.forEach((r, i) => {
      promotionRequirements.push({
        id: `preq_${co.key}_${i}`, company_id: cid, grade_id: gid(r.gradeCode), kind: r.kind,
        transition_label: r.transitionLabel, seq: r.seq, text: r.text, is_gate: r.isGate,
        is_active: 1, created_at: NOW, updated_at: MASTER_AT,
      });
    });

    /* 行動指針 */
    behaviors.forEach((b, i) => {
      const bgId = `bg_${co.key}_${b.band}_${b.aspect}`;
      behaviorGuidelines.push({
        id: bgId, company_id: cid, band: b.band, aspect: b.aspect, aspect_name: b.aspectName,
        seq: b.seq, is_active: 1, created_at: NOW, updated_at: NOW,
      });
      b.levels.forEach((lv, j) => {
        behaviorLevels.push({
          id: `blv_${co.key}_${i}_${j}`, company_id: cid, guideline_id: bgId, score: lv.score,
          label: lv.label, text: lv.text, created_at: NOW, updated_at: MASTER_AT,
        });
      });
    });

    /* 昇格に必要な点数（アンケートには絶対に出さない値） */
    [
      { from: "beginner", to: "regular", label: "B→R", behavior: 10 },
      { from: "regular", to: "chief", label: "R→C", behavior: 8 },
      { from: "chief", to: "am1", label: "C→AM", behavior: 12 },
      { from: "am1", to: "am2", label: "AMⅠ→AMⅡ", behavior: 12 },
      { from: "am2", to: "manager1", label: "AM→M", behavior: 12 },
      { from: "manager1", to: "manager2", label: "MⅠ→MⅡ", behavior: 12 },
    ].forEach((t, i) => {
      promotionThresholds.push({
        id: `pth_${co.key}_${i}`, company_id: cid, from_grade_id: gid(t.from), to_grade_id: gid(t.to),
        label: t.label, required_behavior_points: t.behavior, required_kpi_points: 100,
        is_provisional: 1, created_at: NOW, updated_at: MASTER_AT,
      });
    });

    /* KPIカテゴリ */
    CATEGORIES.forEach((c, i) => {
      kpiCategories.push({
        id: `cat_${co.key}_${c.code}`, company_id: cid, code: c.code, name: c.name,
        description: c.description, display_order: i + 1, created_at: NOW, updated_at: NOW,
      });
    });

    /* KPI項目 33件 */
    kpiMaster.forEach((m) => {
      const no = Number(m.No);
      const catCode = categoryOfItem.get(no);
      const direction = /低いほど|少ないほど|逆転/.test(m["評価方向"] ?? "") ? "lower" : "higher";
      kpiItems.push({
        id: `kpi_${co.key}_${no}`, company_id: cid, no, name: m["項目名"],
        category_id: catCode ? `cat_${co.key}_${catCode}` : null,
        measure_type: m["実績区分"], unit: m["実績値の単位"], direction,
        formula: m["実績値の計算式（設問IDで表記）"], formula_note: m["自動決定・固定値の扱い"],
        intent: m["＊評価の意図"], data_source: m["データ取得元"], judge_timing: m["判断時期"],
        a_type: m["A水準の型"], a_standard: m["Aランクの基準"], controllability: m["制御可能性"],
        a_rationale: m["なぜその水準をAとするか"], remarks: m["備考"],
        is_fixed_slot: no === 1 ? 1 : 0,
        is_provisional: /新規（素案）/.test(m["備考"] ?? "") ? 1 : 0,
        provisional_note: /新規（素案）/.test(m["備考"] ?? "") ? "元スプレッドシートで素案のまま確定していない項目です。" : null,
        is_active: 1, created_at: NOW, updated_at: MASTER_AT,
      });
    });

    /* ランク基準 165件（元シートに無い 33-E は補完して「仮」を立てる） */
    const rankRows = [...kpiRanks];
    if (!kpiRanks.some((r) => r["項目No"] === "33" && r["ランク"] === "E")) {
      rankRows.push({
        項目No: "33", 項目名: "契約件数", ランク: "E", "基準（表示用）": "90%未満", 下限: "", 上限: "90",
        "境界の判定条件": "x < 90", 実績値の単位: "%", 評価方向: "高いほど良い", ランクの意味: "未達",
        対象等級: "Chief／AM／Manager", 検索キー: "33-E", __filled: true,
      });
    }
    rankRows.forEach((r, i) => {
      const no = Number(r["項目No"]);
      kpiRankCriteria.push({
        id: `krc_${co.key}_${no}_${r["ランク"]}`, company_id: cid, kpi_item_id: `kpi_${co.key}_${no}`,
        rank: r["ランク"], display_label: r["基準（表示用）"],
        lower_bound: num(r["下限"]), upper_bound: num(r["上限"]),
        boundary_expr: r["境界の判定条件"], meaning: r["ランクの意味"], target_grades: r["対象等級"],
        is_provisional: r.__filled ? 1 : 0,
        provisional_note: r.__filled ? "元スプレッドシートにEランクの行が無かったため、D（90%以上95%未満）の下に接続する形で補完しました。" : null,
        created_at: NOW, updated_at: MASTER_AT,
      });
    });

    /* KPI設問 73件 */
    kpiQuestions.forEach((qq, i) => {
      const no = Number(qq["項目No"]);
      const roleRaw = qq["計算での役割"] ?? "";
      const role = roleRaw.includes("分子") ? "numerator" : roleRaw.includes("分母") ? "denominator" : roleRaw.includes("直接") ? "direct" : "identify";
      kpiQuestionRows.push({
        id: `kq_${co.key}_${qq["設問ID"]}`, company_id: cid,
        kpi_item_id: Number.isFinite(no) ? `kpi_${co.key}_${no}` : null,
        question_key: qq["設問ID"], text: qq["フォーム設問文"],
        input_type: qq["回答形式"]?.includes("プルダウン") ? "select" : qq["回答形式"]?.includes("テキスト") ? "text" : "number",
        unit: qq["単位"], required: qq["必須"] === "必須" ? 1 : 0, validation: qq["入力チェック"],
        role, target_grades: qq["対象等級"], display_order: i + 1, created_at: NOW, updated_at: NOW,
      });
    });

    /* 評価セット（8項目＋配点100点） */
    const schemeId = `sch_${co.key}`;
    schemes.push({
      id: schemeId, company_id: cid, name: co.schemeName, status: "active",
      effective_from: "2026-04-01", effective_to: null, total_points: 100, raise_requires_all_a: 1,
      note: "等級要件達成率を固定枠とし、7カテゴリから1項目ずつ選んでいます。配点は叩き台の初期値です。",
      created_at: NOW, updated_at: NOW,
    });
    const chosen = [{ no: 1, weight: co.fixedWeight, cat: null, fixed: 1 }];
    CATEGORIES.forEach((c) => {
      const pick = co.scheme[c.code];
      if (pick) chosen.push({ no: pick[0], weight: pick[1], cat: c.code, fixed: 0 });
    });
    chosen.forEach((ci, i) => {
      schemeItems.push({
        id: `si_${co.key}_${ci.no}`, company_id: cid, scheme_id: schemeId, kpi_item_id: `kpi_${co.key}_${ci.no}`,
        category_id: ci.cat ? `cat_${co.key}_${ci.cat}` : null, weight: ci.weight,
        is_fixed_slot: ci.fixed, display_order: i + 1, created_at: NOW, updated_at: MASTER_AT,
      });
    });
    // ランク→点数の按分（叩き台の初期値。管理画面から変更できる）
    [["A", 1], ["B", 0.8], ["C", 0.6], ["D", 0.4], ["E", 0]].forEach(([rk, ratio]) => {
      schemeRankRatios.push({
        id: `srr_${co.key}_${rk}`, company_id: cid, scheme_id: schemeId, rank: rk, ratio,
        is_provisional: 1, created_at: NOW, updated_at: MASTER_AT,
      });
    });

    /* 昇給ルール本体（元シート「昇給ルール（仮）」【1】【4】【6】） */
    raisePolicies.push({ id: `rp_${co.key}`, company_id: cid, ...RAISE_POLICY, is_provisional: 1, created_at: NOW, updated_at: NOW });

    /* 判定パターン（同【3】） */
    RAISE_PATTERNS.forEach((p, i) => {
      raisePatterns.push({
        id: `rpat_${co.key}_${i}`, company_id: cid, seq: i + 1,
        pattern: p[0], judgment: p[1], treatment: p[2], created_at: NOW,
      });
    });

    /* 特例・例外 7件（同【7】） */
    RAISE_EXCEPTIONS.forEach((x, i) => {
      raiseExceptions.push({
        id: `rexc_${co.key}_${i}`, company_id: cid, seq: i + 1,
        case_text: x[0], handling: x[1], excludes_judgement: x[2],
        is_provisional: 1, created_at: NOW, updated_at: NOW,
      });
    });

    /* 昇給額と回数上限（同【2】【5】。実際の値は昇給設定画面から変更する） */
    gradesDef.forEach((g) => {
      const rr = RAISE_BY_GRADE[g.code];
      raiseSettings.push({
        id: `rs_${co.key}_${g.code}`, company_id: cid, grade_id: gid(g.code),
        monthly_amount: rr.amount, months: 6, annual_amount: rr.amount * 6,
        max_count: rr.max,
        cap_note: "上限に達した後は、昇格（上位等級への移行）しない限り昇給しない",
        note: rr.note,
        is_provisional: 1, created_at: NOW, updated_at: NOW,
      });
    });

    /* 事業所KGI達成係数 */
    [
      ["121%以上", 121, null, 1.5], ["111〜120%", 111, 121, 1.2], ["100〜110%", 100, 111, 1.0],
      ["95〜99%", 95, 100, 0.6], ["90〜94%", 90, 95, 0.4], ["89%以下", null, 90, 0.2],
    ].forEach((k, i) => {
      kgiCoefficients.push({
        id: `kgi_${co.key}_${i}`, company_id: cid, scope: "事業所", label: k[0],
        lower_bound: k[1], upper_bound: k[2], coefficient: k[3], display_order: i + 1,
        is_provisional: 1, created_at: NOW, updated_at: MASTER_AT,
      });
    });

    // テンプレート会社は制度の原本だけを持ち、人・サイクル・回答は持たない
    if (co.isTemplate) continue;

    /* 利用者（管理者・マネージャー・評価される側） */
    const adminId = `usr_${co.key}_admin`;
    const managerId = `usr_${co.key}_mgr`;
    users.push({
      id: adminId, name: `${co.name} 管理者`, email: `admin@${co.key}.hyoka-demo.jp`, email_verified: 1, image: null,
      company_id: cid, role: "COMPANY_ADMIN", grade_id: null, office_id: offId("hq"), manager_id: null, employee_code: "ADM-001",
      department: "本部", hired_at: "2017-04-01", profile_note: "制度の設定と評価の確定を担当。", is_active: 1,
      created_at: NOW, updated_at: NOW,
    });
    users.push({
      id: managerId, name: `${co.name} マネージャー`, email: `manager@${co.key}.hyoka-demo.jp`, email_verified: 1, image: null,
      company_id: cid, role: "MANAGER", grade_id: gid("manager1"), office_id: offId("hq"), manager_id: adminId, employee_code: "MGR-001",
      department: "本部", hired_at: "2018-04-01", profile_note: "各事業所の評価状況を確認する立場（変更はできない）。", is_active: 1,
      created_at: NOW, updated_at: NOW,
    });
    [adminId, managerId].forEach((uid) => {
      accounts.push({
        id: `acc_${uid}`, account_id: uid, provider_id: "credential", user_id: uid, access_token: null,
        refresh_token: null, id_token: null, access_token_expires_at: null, refresh_token_expires_at: null,
        scope: null, password: pw, created_at: NOW, updated_at: NOW,
      });
    });

    const empIds = [];
    EMPLOYEES.forEach((e) => {
      const uid = `usr_${co.key}_${e.key}`;
      empIds.push({ ...e, id: uid });
      users.push({
        id: uid, name: e.name, email: `${e.key}@${co.key}.hyoka-demo.jp`, email_verified: 1, image: null,
        company_id: cid, role: "EMPLOYEE", grade_id: gid(e.grade), office_id: offId(deptToOffice(e.dept)), manager_id: managerId,
        employee_code: `EMP-${e.key.slice(1).padStart(3, "0")}`, department: e.dept, hired_at: e.hired,
        profile_note: null, is_active: 1, created_at: NOW, updated_at: NOW,
      });
      accounts.push({
        id: `acc_${uid}`, account_id: uid, provider_id: "credential", user_id: uid, access_token: null,
        refresh_token: null, id_token: null, access_token_expires_at: null, refresh_token_expires_at: null,
        scope: null, password: pw, created_at: NOW, updated_at: NOW,
      });
      employeeNotes.push({
        id: `en_${uid}`, company_id: cid, employee_id: uid, author_id: managerId, cycle_id: null,
        body: `${e.name}さんは${e.dept}所属。次のサイクルでは記録の期限管理を重点的に見る。`,
        visibility: "manager", created_at: NOW, updated_at: NOW,
      });
    });

    /* サイクル・フォーム・回答・評価 */
    CYCLES.forEach((cy) => {
      const cycleId = `cyc_${co.key}_${cy.key}`;
      cycles.push({
        id: cycleId, company_id: cid, name: cy.name, period_start: cy.start, period_end: cy.end,
        scheme_id: schemeId, status: cy.status, created_at: NOW, updated_at: NOW,
      });

      gradesDef.forEach((g) => {
        const formId = `frm_${co.key}_${cy.key}_${g.code}`;
        forms.push({
          id: formId, company_id: cid, grade_id: gid(g.code), cycle_id: cycleId,
          title: `${cy.name} ${g.name} 実績アンケート`,
          description: "半期の実績を入力してください。点数や評価基準はこの画面には表示されません。",
          version: 1, status: cy.status === "open" ? "published" : "closed",
          public_token: `${co.key}-${cy.key}-${g.code}`,
          opens_at: cy.start, closes_at: cy.end, created_at: NOW, updated_at: NOW,
        });

        let order = 0;
        const fq = [];
        const push = (r) => { fq.push({ id: `fq_${formId}_${fq.length}`, company_id: cid, form_id: formId, display_order: ++order, created_at: NOW, updated_at: NOW, ...r }); };

        // 支援・運営（等級要件の○×）
        for (const cat of ["support", "operation"]) {
          gradeReqs.filter((r) => r.gradeCode === g.code && r.category === cat).forEach((r, i) => {
            const idx = gradeReqs.findIndex((x) => x === r);
            push({
              section: cat, question_type: "yesno",
              title: r.text, help_text: null, unit: null, required: 1,
              validation_min: null, validation_max: null, options_json: null,
              grade_requirement_id: `greq_${co.key}_${idx}`, promotion_requirement_id: null,
              behavior_guideline_id: null, kpi_item_id: null, kpi_question_key: null, is_gate: 0,
            });
          });
        }
        // 昇格要件（受講後報告書提出＝必須ゲート／独学後テスト）
        for (const kind of ["report", "test"]) {
          promoReqs.filter((r) => r.gradeCode === g.code && r.kind === kind).forEach((r) => {
            const idx = promoReqs.findIndex((x) => x === r);
            push({
              section: kind === "report" ? "training" : "test", question_type: "yesno",
              title: r.text,
              help_text: kind === "report" ? "受講後の報告書を提出済みの場合は「はい」を選んでください。" : "テストに合格している場合は「はい」を選んでください。",
              unit: null, required: 1, validation_min: null, validation_max: null, options_json: null,
              grade_requirement_id: null, promotion_requirement_id: `preq_${co.key}_${idx}`,
              behavior_guideline_id: null, kpi_item_id: null, kpi_question_key: null, is_gate: 1,
            });
          });
        }
        // 行動指針（等級帯がある等級のみ）
        if (g.band) {
          behaviors.filter((b) => b.band === g.band).forEach((b) => {
            push({
              section: "behavior", question_type: "single",
              title: b.aspectName, help_text: "もっとも近いものを1つ選んでください。",
              unit: null, required: 1, validation_min: null, validation_max: null,
              options_json: JSON.stringify(b.levels.map((lv) => ({ value: String(lv.score), label: `【${lv.label}】${lv.text}`, score: lv.score }))),
              grade_requirement_id: null, promotion_requirement_id: null,
              behavior_guideline_id: `bg_${co.key}_${b.band}_${b.aspect}`,
              kpi_item_id: null, kpi_question_key: null, is_gate: 0,
            });
          });
        }
        // KPI設問（この会社の評価セットに入っていて、この等級が対象の項目のみ）
        chosen.forEach((ci) => {
          const item = kpiMaster.find((m) => Number(m.No) === ci.no);
          // 評価セットの8項目は全等級に同じ配点で適用する（叩き台の方針。詳細は docs/product/backlog.md）
          kpiQuestions.filter((qq) => Number(qq["項目No"]) === ci.no).forEach((qq) => {
            const chk = qq["入力チェック"] ?? "";
            push({
              section: "kpi", question_type: qq["回答形式"]?.includes("プルダウン") ? "single" : "number",
              title: qq["フォーム設問文"],
              help_text: `${item?.["項目名"] ?? ""}の集計に使います。`,
              unit: qq["単位"] === "-" ? null : qq["単位"], required: qq["必須"] === "必須" ? 1 : 0,
              validation_min: chk.includes("1以上") ? 1 : chk.includes("0以上") ? 0 : null,
              validation_max: null,
              options_json: qq["回答形式"]?.includes("プルダウン") && /3,2,1,0,-1/.test(chk)
                ? JSON.stringify([3, 2, 1, 0, -1].map((s) => ({ value: String(s), label: `${s}点`, score: s })))
                : null,
              grade_requirement_id: null, promotion_requirement_id: null, behavior_guideline_id: null,
              kpi_item_id: `kpi_${co.key}_${ci.no}`, kpi_question_key: qq["設問ID"], is_gate: 0,
            });
          });
        });
        formQuestions.push(...fq);

        // 過去サイクルのみ、回答と評価結果を作る
        if (cy.status !== "closed") return;
        empIds.filter((e) => e.grade === g.code).forEach((e) => {
          const r = rng(`${co.key}-${cy.key}-${e.key}`);
          const respId = `res_${co.key}_${cy.key}_${e.key}`;
          formResponses.push({
            id: respId, company_id: cid, form_id: formId, cycle_id: cycleId, employee_id: e.id,
            grade_id: gid(g.code), office_id: offId(deptToOffice(e.dept)), import_source: null, status: "submitted",
            submitted_at: T(new Date(`${cy.end}T09:00:00Z`)), respondent_note: null,
            created_at: NOW, updated_at: NOW,
          });

          const gradeDef = gradesDef.find((x) => x.code === g.code);
          // 本人の実力の目安。1.0 は全項目Aで昇給要件を満たす人（デモで判定の両方を見せるため）
          const strength = STRENGTH[`${e.key}:${cy.key}`] ?? STRENGTH[e.key] ?? 0.5;

          const answersByKey = {};
          const answerRows = [];
          let reqAchieved = 0, reqTotal = 0;
          let behaviorTotal = 0;
          const gateRows = [];
          const reqRows = [];
          const behRows = [];

          fq.forEach((qrow) => {
            let valNum = null, valText = null;
            if (qrow.question_type === "yesno") {
              const ok = strength >= 1 ? 1 : r() > 0.15 + 0.4 * (1 - strength) ? 1 : 0;
              valNum = ok; valText = ok ? "はい" : "いいえ";
              if (qrow.grade_requirement_id) {
                reqTotal++; if (ok) reqAchieved++;
                reqRows.push({ gr: qrow.grade_requirement_id, category: qrow.section, text: qrow.title, achieved: ok });
              }
              if (qrow.is_gate) gateRows.push({ pr: qrow.promotion_requirement_id, kind: qrow.section === "training" ? "report" : "test", text: qrow.title, achieved: ok });
            } else if (qrow.question_type === "single" && qrow.behavior_guideline_id) {
              const opts = JSON.parse(qrow.options_json);
              const sorted = [...opts].sort((a, b) => b.score - a.score);
              const pick = strength >= 1 ? sorted[0] : sorted[Math.floor(r() * (strength > 0.7 ? 2 : 4))];
              valNum = pick.score; valText = pick.label;
              behaviorTotal += pick.score;
              behRows.push({ gid: qrow.behavior_guideline_id, score: pick.score, label: pick.label });
            } else {
              valNum = fakeNumber(qrow, r);
            }
            if (qrow.kpi_question_key) answersByKey[qrow.kpi_question_key] = valNum;
            answerRows.push({
              id: `fa_${respId}_${qrow.id.split("_").pop()}`, company_id: cid, response_id: respId,
              question_id: qrow.id, value_number: valNum, value_text: valText, value_json: null,
              created_at: NOW, updated_at: NOW, __key: qrow.kpi_question_key,
            });
          });

          /* 集計 */
          const evalId = `ev_${co.key}_${cy.key}_${e.key}`;
          const vars = { ...answersByKey, 等級別の半期目標設定上限数: gradeDef.targetCap, 等級別の1人あたり必要回数: gradeDef.pointGroup === "AM" ? 3 : 2 };

          /*
           * KPIの数値回答は乱数のままだと基準表から大きく外れ、ほぼ全員Eになってしまう。
           * 目標ランクを先に決め、その帯に入る実績値になるよう「分子にあたる設問」の回答を逆算して
           * 上書きする。計算式はどれも各変数について1次式なので、f(0) と f(1) から解ける。
           * こうすると画面に出る回答と実績値が食い違わない。
           */
          chosen.forEach((ci) => {
            if (ci.no === 1) return; // 等級要件達成率は○×の回答から素直に決まる
            const m = kpiMaster.find((x) => Number(x.No) === ci.no);
            const crits = rankRows.filter((x) => Number(x["項目No"]) === ci.no);
            const direction = /低いほど|少ないほど|逆転/.test(m["評価方向"] ?? "") ? "lower" : "higher";
            const targetRank = pickTargetRank(r, strength);
            const crit = crits.find((x) => x["ランク"] === targetRank) ?? crits[0];
            if (!crit) return;
            const target = targetValueIn(crit, direction);
            if (target === null) return;

            const formula = m["実績値の計算式（設問IDで表記）"];
            const qs = kpiQuestions.filter((x) => Number(x["項目No"]) === ci.no);
            const primary = (qs.find((x) => (x["計算での役割"] ?? "").includes("分子")) ?? qs[0])?.["設問ID"];
            if (!primary || !(primary in vars)) return;

            const at0 = evalFormula(formula, { ...vars, [primary]: 0 });
            const at1 = evalFormula(formula, { ...vars, [primary]: 1 });
            if (at0 === null || at1 === null) return;
            const slope = at1 - at0;
            if (slope === 0) return;
            const solved = Math.max(0, Math.round((target - at0) / slope));

            vars[primary] = solved;
            answersByKey[primary] = solved;
            const row = answerRows.find((x) => x.__key === primary);
            if (row) row.value_number = solved;
          });

          answerRows.forEach((row) => {
            const { __key, ...rest } = row;
            formAnswers.push(rest);
          });

          // 等級要件達成率＝達成数÷半期の目標設定上限数（100%で頭打ち）。src/lib/domain/scoring.ts と同じ決まり。
          const reqRate = Math.round(Math.min(100, (reqAchieved / Math.max(1, gradeDef.targetCap)) * 100) * 10) / 10;

          let total = 0, maxTotal = 0;
          const itemRows = [];
          chosen.forEach((ci, idx) => {
            const m = kpiMaster.find((x) => Number(x.No) === ci.no);
            const crits = rankRows.filter((x) => Number(x["項目No"]) === ci.no);
            const direction = /低いほど|少ないほど|逆転/.test(m["評価方向"] ?? "") ? "lower" : "higher";
            let actual = null;
            if (ci.no === 1) {
              actual = reqRate;
            } else {
              actual = evalFormula(m["実績値の計算式（設問IDで表記）"], vars);
            }
            if (actual === null) return;
            const hit = pickRank(actual, crits, direction);
            const ratio = { A: 1, B: 0.8, C: 0.6, D: 0.4, E: 0 }[hit.rank];
            const pts = Math.round(ci.weight * ratio * 10) / 10;
            total += pts; maxTotal += ci.weight;
            const cat = CATEGORIES.find((c) => c.code === ci.cat);
            itemRows.push({
              id: `ei_${evalId}_${ci.no}`, company_id: cid, evaluation_id: evalId,
              kpi_item_id: `kpi_${co.key}_${ci.no}`, category_id: ci.cat ? `cat_${co.key}_${ci.cat}` : null,
              item_name: m["項目名"], category_name: cat ? cat.name : "等級要件（固定枠）",
              unit: m["実績値の単位"], direction,
              numerator: null, denominator: null, actual_value: actual, override_value: null, override_reason: null,
              rank: hit.rank, points: pts, max_points: ci.weight,
              threshold_label: hit.crit?.["基準（表示用）"] ?? null,
              threshold_lower: num(hit.crit?.["下限"]), threshold_upper: num(hit.crit?.["上限"]),
              rationale: `実績値 ${actual}${m["実績値の単位"]} が「${hit.crit?.["基準（表示用）"] ?? "該当なし"}」に当てはまるため ${hit.rank} と判定しました。`,
              calc_note: m["実績値の計算式（設問IDで表記）"],
              is_provisional: /新規（素案）/.test(m["備考"] ?? "") ? 1 : 0,
              display_order: idx + 1, created_at: NOW,
            });
          });

          const allA = itemRows.length > 0 && itemRows.every((x) => x.rank === "A");
          const th = { beginner: 10, regular: 8, chief: 12, am1: 12, am2: 12, manager1: 12, manager2: 12 }[g.code];
          const gateFail = gateRows.filter((x) => !x.achieved);
          const reasons = [];
          if (gateFail.length) reasons.push(`昇格要件が未達です（${gateFail.slice(0, 2).map((x) => x.text).join("、")}${gateFail.length > 2 ? " ほか" : ""}）。`);
          if (total < 100) reasons.push(`KPI評価点が${Math.round(total * 10) / 10}点で、昇格に必要な100点に達していません。`);
          if (g.band && behaviorTotal < th) reasons.push(`行動指針の評価が${behaviorTotal}点で、昇格に必要な${th}点に達していません。`);

          evaluations.push({
            id: evalId, company_id: cid, cycle_id: cycleId, employee_id: e.id, grade_id: gid(g.code),
            response_id: respId, scheme_id: schemeId,
            office_id: offId(deptToOffice(e.dept)), computed_at: T(new Date(`${cy.end}T12:00:00Z`)),
            total_score: Math.round(total * 10) / 10, max_score: maxTotal,
            requirement_rate: reqRate,
            requirement_achieved: reqAchieved, requirement_total: reqTotal,
            behavior_total: g.band ? behaviorTotal : null,
            raise_eligible: allA ? 1 : 0,
            promotion_eligible: reasons.length === 0 ? 1 : 0,
            promotion_blocked_reason: reasons.length ? reasons.join("") : null,
            required_kpi_points_snapshot: 100, required_behavior_points_snapshot: g.band ? th : null,
            evaluator_id: managerId,
            evaluator_comment: allA ? "全項目Aのため昇給要件を満たしています。次期はチームへの波及を期待します。" : "未達の項目について、期首に分母と行動計画をすり合わせましょう。",
            status: "finalized", finalized_at: T(new Date(`${cy.end}T12:00:00Z`)),
            created_at: NOW, updated_at: NOW,
          });
          evaluationItems.push(...itemRows);
          reqRows.forEach((x, i) => evaluationRequirements.push({
            id: `er_${evalId}_${i}`, company_id: cid, evaluation_id: evalId, grade_requirement_id: x.gr,
            category: x.category, text: x.text, achieved: x.achieved, created_at: NOW,
          }));
          gateRows.forEach((x, i) => evaluationGates.push({
            id: `eg_${evalId}_${i}`, company_id: cid, evaluation_id: evalId, promotion_requirement_id: x.pr,
            kind: x.kind, text: x.text, achieved: x.achieved, created_at: NOW,
          }));
          behRows.forEach((x, i) => {
            const b = behaviors.find((bb) => `bg_${co.key}_${bb.band}_${bb.aspect}` === x.gid);
            evaluationBehaviors.push({
              id: `eb_${evalId}_${i}`, company_id: cid, evaluation_id: evalId, guideline_id: x.gid,
              aspect: b.aspect, aspect_name: b.aspectName, score: x.score,
              level_label: x.label, comment: null, created_at: NOW,
            });
          });
        });
      });
    });
  }

  sql.push(...insert("companies", companies));
  sql.push(...insert("offices", offices));
  sql.push(...insert("users", users));
  sql.push(...insert("accounts", accounts));
  sql.push(...insert("grades", grades));
  sql.push(...insert("grade_requirements", gradeRequirements));
  sql.push(...insert("promotion_requirements", promotionRequirements));
  sql.push(...insert("behavior_guidelines", behaviorGuidelines));
  sql.push(...insert("behavior_levels", behaviorLevels));
  sql.push(...insert("promotion_thresholds", promotionThresholds));
  sql.push(...insert("kpi_categories", kpiCategories));
  sql.push(...insert("kpi_items", kpiItems));
  sql.push(...insert("kpi_rank_criteria", kpiRankCriteria));
  sql.push(...insert("kpi_questions", kpiQuestionRows));
  sql.push(...insert("evaluation_schemes", schemes));
  sql.push(...insert("scheme_items", schemeItems));
  sql.push(...insert("scheme_rank_ratios", schemeRankRatios));
  sql.push(...insert("evaluation_cycles", cycles));
  sql.push(...insert("forms", forms));
  sql.push(...insert("form_questions", formQuestions));
  sql.push(...insert("form_responses", formResponses));
  sql.push(...insert("form_answers", formAnswers));
  sql.push(...insert("evaluations", evaluations));
  sql.push(...insert("evaluation_items", evaluationItems));
  sql.push(...insert("evaluation_behaviors", evaluationBehaviors));
  sql.push(...insert("evaluation_requirements", evaluationRequirements));
  sql.push(...insert("evaluation_gates", evaluationGates));
  sql.push(...insert("raise_settings", raiseSettings));
  sql.push(...insert("raise_policies", raisePolicies));
  sql.push(...insert("raise_patterns", raisePatterns));
  sql.push(...insert("raise_exceptions", raiseExceptions));
  sql.push(...insert("raise_revisions", raiseRevisions));
  sql.push(...insert("kgi_coefficients", kgiCoefficients));
  sql.push(...insert("employee_notes", employeeNotes));

  return {
    sql,
    counts: {
      会社: companies.length, 事業所: offices.length, 利用者: users.length, 等級: grades.length,
      昇給ルール: raisePolicies.length, 判定パターン: raisePatterns.length, 昇給の特例: raiseExceptions.length,
      昇給額: raiseSettings.length,
      等級要件: gradeRequirements.length, 昇格要件: promotionRequirements.length,
      行動指針: behaviorGuidelines.length, 行動指針の段階: behaviorLevels.length,
      KPI項目: kpiItems.length, ランク基準: kpiRankCriteria.length, KPI設問: kpiQuestionRows.length,
      評価セット: schemes.length, 選択項目: schemeItems.length,
      サイクル: cycles.length, フォーム: forms.length, フォーム設問: formQuestions.length,
      回答: formResponses.length, 回答明細: formAnswers.length,
      評価結果: evaluations.length, 評価明細: evaluationItems.length,
    },
  };
}

/* ───────────────── 補助関数 ───────────────── */

/** 部署名から事業所コードを引く（デモ利用者の所属を事業所マスタに合わせる） */
function deptToOffice(dept) {
  if (dept === "第1事業所") return "office1";
  if (dept === "第2事業所") return "office2";
  return "hq";
}

/** 目標ランクを決める。strength が高いほどAが出やすい。1.0 なら必ずA。 */
function pickTargetRank(r, strength) {
  if (strength >= 1) return "A";
  const x = r();
  const pA = 0.2 + 0.6 * strength;
  if (x < pA) return "A";
  if (x < pA + 0.2) return "B";
  if (x < pA + 0.33) return "C";
  if (x < pA + 0.4) return "D";
  return "E";
}

/** ランク基準の帯のなかに確実に入る実績値を選ぶ。 */
function targetValueIn(crit, direction) {
  const lo = num(crit["下限"]), hi = num(crit["上限"]);
  if (lo !== null && hi !== null) return Math.round(((lo + hi) / 2) * 10) / 10;
  if (direction === "lower") {
    if (hi !== null) return hi <= 0 ? 0 : Math.round(hi * 0.6 * 10) / 10;
    if (lo !== null) return Math.round((lo + Math.max(1, lo * 0.1)) * 10) / 10;
    return null;
  }
  if (lo !== null) return Math.round((lo + Math.max(1, lo * 0.05)) * 10) / 10;
  if (hi !== null) return Math.max(0, Math.round((hi - Math.max(1, hi * 0.1)) * 10) / 10);
  return null;
}

function fakeNumber(qrow, r) {
  const t = qrow.title ?? "";
  // 「起きてほしくない事象」は0〜数件。それ以外は0を返さない（分母になり得るため）
  if (/欠員|超過|遅延|未達|ミス|漏れ|事故|苦情|退職/.test(t)) return Math.floor(r() * 3);
  if (/開所|営業|稼働|延べ/.test(t)) return Math.floor(110 + r() * 15);
  if (/定員|予算|上限|必要|対象|想定/.test(t)) return Math.floor(20 + r() * 30);
  return Math.floor(18 + r() * 30);
}

function evalFormula(formula, vars) {
  if (!formula) return null;
  try {
    // src/lib/domain/formula.ts の stripNotes と同じ規則で末尾の日本語注釈を落とす
    let s = formula.replace(/※[\s\S]*$/, "").trim();
    for (;;) {
      const m = /[（(]([^（()）]*)[）)]\s*$/.exec(s);
      if (!m || !/[ぁ-んァ-ヶ一-龥]/.test(m[1])) break;
      s = s.slice(0, m.index).trim();
    }
    const src = s
      .replace(/[÷／]/g, "/").replace(/[×✕✖]/g, "*").replace(/[−–—]/g, "-").replace(/[（]/g, "(").replace(/[）]/g, ")");
    const names = [...new Set(src.match(/[A-Za-z_][A-Za-z0-9_]*|【[^】]+】/g) ?? [])];
    let expr = src;
    for (const n of names) {
      const key = n.replace(/[【】]/g, "");
      const v = vars[key];
      if (v === undefined || v === null || Number.isNaN(v)) return null;
      expr = expr.split(n).join(`(${v})`);
    }
    if (!/^[-+*/().\d\s]+$/.test(expr)) return null;
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict";return (${expr});`)();
    if (!Number.isFinite(val)) return null;
    return Math.round(val * 100) / 100;
  } catch {
    return null;
  }
}

function pickRank(value, crits, direction) {
  const order = ["A", "B", "C", "D", "E"];
  const sorted = [...crits].sort((a, b) => order.indexOf(a["ランク"]) - order.indexOf(b["ランク"]));
  for (const c of sorted) {
    const lo = num(c["下限"]), hi = num(c["上限"]);
    if (direction === "lower") {
      if (hi !== null && !(value <= hi)) continue;
      if (lo !== null && !(value > lo)) continue;
      return { rank: c["ランク"], crit: c };
    }
    if (lo !== null && !(value >= lo)) continue;
    if (hi !== null && !(value < hi)) continue;
    return { rank: c["ランク"], crit: c };
  }
  return { rank: "E", crit: sorted[sorted.length - 1] ?? null };
}
