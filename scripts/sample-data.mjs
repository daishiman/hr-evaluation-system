/**
 * 見本用（サンプル）の会社と、その会社の過去の評価を組み立てる。
 *
 * ねらいは「確定済みの評価が画面でどう見えるか」を、本物のデータに触らずに確かめられるようにすること。
 *
 * 大事な決めごとが3つある。
 *
 * 1. サンプルは専用の会社（cmp_sample）だけに入れる。
 *    会社が違えば、既にある会社の一覧・アンケート・評価には1行も混ざらない。
 *    投入SQLは INSERT だけで、既存の行を書き換える UPDATE も、既存を消す DELETE も作らない。
 * 2. 消し方を同時に用意する。投入した表と同じ一覧から削除SQLを組み立てるので、消し漏れが起きない。
 * 3. パスワードは呼び出し側が1人ずつ作って渡す（この中では作らない・持たない・出力しない）。
 *
 * 中身の組み立ては scripts/seed-data.mjs の buildSeed をそのまま使う。
 * 制度マスタ・アンケート・回答・確定済み評価の作り方を2か所に書かないため。
 */
import { buildSeed } from "./seed-data.mjs";

/** サンプル会社のID。削除もこの1文字列だけを手がかりにする。 */
export const SAMPLE_COMPANY_ID = "cmp_sample";

/**
 * サンプル会社。名前に「サンプル」を入れて、会社を選ぶ画面で本物と見分けられるようにする。
 * 評価セットの7項目はテンプレート（システム標準）と同じにして、標準的な見え方を確かめられるようにした。
 */
export const SAMPLE_COMPANY = {
  key: "sample",
  name: "見本商事（サンプル）",
  scheme: { sales: 9, occupancy: 10, compliance: 16, safety: 2, hr: 11, quality: 13, growth: 27 },
  schemeName: "サンプル評価セット",
  offices: [
    { code: "hq", name: "本部" },
    { code: "office1", name: "第1事業所" },
    { code: "office2", name: "第2事業所" },
  ],
};

/**
 * 期。確定済みを4期ぶん作る（点数の推移が折れ線として読めるのは3点以上から）。
 * 最後の1期だけ受付中にして、「まだ評価が出ていない期」の見え方も確かめられるようにする。
 */
export const SAMPLE_CYCLES = [
  { key: "2024h1", name: "2024年度 上期（サンプル）", start: "2024-04-01", end: "2024-09-30", status: "closed" },
  { key: "2024h2", name: "2024年度 下期（サンプル）", start: "2024-10-01", end: "2025-03-31", status: "closed" },
  { key: "2025h1", name: "2025年度 上期（サンプル）", start: "2025-04-01", end: "2025-09-30", status: "closed" },
  { key: "2025h2", name: "2025年度 下期（サンプル）", start: "2025-10-01", end: "2026-03-31", status: "closed" },
  { key: "2026h1", name: "2026年度 上期（サンプル）", start: "2026-04-01", end: "2026-09-30", status: "open" },
];

/**
 * 一般の利用者。7等級すべてを1人以上そろえる（等級ごとに配点の組み立てが違うことを見比べられるように）。
 * 名前はすべて「サンプル」で始める。名簿の並び替えでも本物と混ざらない。
 */
export const SAMPLE_EMPLOYEES = [
  { key: "s1", name: "サンプル 一郎", grade: "beginner", dept: "第1事業所", hired: "2023-04-01" },
  { key: "s2", name: "サンプル 二郎", grade: "beginner", dept: "第2事業所", hired: "2023-04-01" },
  { key: "s3", name: "サンプル 三郎", grade: "regular", dept: "第1事業所", hired: "2021-04-01" },
  { key: "s4", name: "サンプル 四季", grade: "regular", dept: "第2事業所", hired: "2021-10-01" },
  { key: "s5", name: "サンプル 五月", grade: "chief", dept: "第1事業所", hired: "2019-04-01" },
  { key: "s6", name: "サンプル 六実", grade: "chief", dept: "第2事業所", hired: "2019-04-01" },
  { key: "s7", name: "サンプル 七海", grade: "am1", dept: "第1事業所", hired: "2017-04-01" },
  { key: "s8", name: "サンプル 八重", grade: "am2", dept: "第2事業所", hired: "2016-04-01" },
  { key: "s9", name: "サンプル 九条", grade: "manager1", dept: "本部", hired: "2014-04-01" },
  { key: "s10", name: "サンプル 十和", grade: "manager2", dept: "本部", hired: "2012-04-01" },
];

/**
 * 期ごとの「実力の目安」（1.0 は全項目Aで昇給要件を満たす人）。
 * 伸びている人・下がっている人・横ばいの人を混ぜてあり、推移のグラフが平らにならないようにしている。
 * `キー:期` の指定が無ければ `キー` の既定値を使う。
 */
export const SAMPLE_STRENGTH = {
  s1: 0.3, "s1:2024h2": 0.45, "s1:2025h1": 0.6, "s1:2025h2": 0.75,
  s2: 0.55, "s2:2024h2": 0.5, "s2:2025h1": 0.45, "s2:2025h2": 0.35,
  s3: 0.7,
  s4: 0.5, "s4:2024h2": 0.65, "s4:2025h1": 0.8, "s4:2025h2": 1,
  s5: 0.85, "s5:2025h1": 0.75, "s5:2025h2": 0.9,
  s6: 0.4, "s6:2024h2": 0.3, "s6:2025h1": 0.5, "s6:2025h2": 0.55,
  s7: 0.6, "s7:2024h2": 0.7, "s7:2025h1": 0.65, "s7:2025h2": 0.9,
  s8: 0.9, "s8:2024h2": 1, "s8:2025h1": 0.8, "s8:2025h2": 0.95,
  s9: 0.75, "s9:2024h2": 0.7, "s9:2025h1": 0.85, "s9:2025h2": 0.8,
  s10: 0.5, "s10:2024h2": 0.6, "s10:2025h1": 0.55, "s10:2025h2": 0.7,
};

/**
 * 上長コメント。入っているものと入っていないものを両方作る。
 * 2024年度上期だけコメント無しにしてあるので、「コメントがまだ書かれていない評価票」の見え方も確かめられる。
 */
export function sampleEvaluatorComment({ employee, cycle, allA }) {
  if (cycle.key === "2024h1") return null;
  if (allA) {
    return `${employee.name}さんは全項目Aで、昇給要件を満たしています。次の期はチームへの共有をお願いします。（サンプル）`;
  }
  return `${employee.name}さんの未達だった項目について、期首に分母の取り方と行動計画をすり合わせましょう。（サンプル）`;
}

/**
 * サンプル会社ぶんの投入SQLと削除SQLを組み立てる。
 *
 * @param {object} opts
 * @param {(userId: string) => Promise<string>} opts.passwordHashFor
 *        利用者1人ごとのパスワードハッシュを返す関数。平文はここに渡さない。
 */
export async function buildSampleSeed({ passwordHashFor }) {
  const { sql, tableRows, counts } = await buildSeed({
    companies: [SAMPLE_COMPANY],
    cycles: SAMPLE_CYCLES,
    employees: SAMPLE_EMPLOYEES,
    strength: SAMPLE_STRENGTH,
    // 全体管理者は既にいる。作り直すと本物のアカウントとぶつかるので作らない。
    includeSuperAdmin: false,
    passwordHashFor,
    // 誰も知らない仮パスワードで作るので、最初のログインで必ず変更してもらう。
    mustChangePassword: true,
    evaluatorComment: sampleEvaluatorComment,
  });

  return { sql, removeSql: buildRemoveSql(tableRows), counts, tableRows };
}

/**
 * 投入した表の一覧から、そのまま削除SQLを作る。
 * 「入れた表」と「消す表」を別々に書かないので、表が増えても消し漏れが出ない。
 */
export function buildRemoveSql(tableRows) {
  const belongsToSample = `IN (SELECT id FROM users WHERE company_id = '${SAMPLE_COMPANY_ID}')`;
  const out = [
    "-- 自動生成: scripts/seed-sample.mjs（手で編集しない）",
    "-- 見本商事（サンプル）だけを消す。他の会社の行には一切触れない。",
    "PRAGMA defer_foreign_keys = ON;",
    // ログイン中の端末が残っていると利用者を消せないため、先に切る
    `DELETE FROM sessions WHERE user_id ${belongsToSample};`,
  ];
  for (const [table] of [...tableRows].reverse()) {
    if (table === "companies") out.push(`DELETE FROM companies WHERE id = '${SAMPLE_COMPANY_ID}';`);
    else if (table === "accounts") out.push(`DELETE FROM accounts WHERE user_id ${belongsToSample};`);
    else out.push(`DELETE FROM ${table} WHERE company_id = '${SAMPLE_COMPANY_ID}';`);
  }
  return out;
}

/** 既にある会社のID。サンプルのSQLがこれらを指していたら、それは事故なので止める。 */
const OTHER_COMPANY_KEYS = ["kyufu", "sakura", "mirai"];

/**
 * 組み立てたSQLが「サンプル会社にしか触らない」ことを確かめる。
 *
 * 本番のデータを壊さないことが今回の最重要の約束なので、
 * 目視ではなくここで機械的に止める。破っていたら例外を投げる。
 */
export function assertSampleOnly(statements) {
  const body = statements.join("\n");

  for (const key of OTHER_COMPANY_KEYS) {
    const hit = body.match(new RegExp(`'[a-z_]+_${key}[_'"]`));
    if (hit) throw new Error(`既にある会社（${key}）の行を指しています: ${hit[0]}`);
  }

  for (const stmt of statements) {
    const head = stmt.trim().split(/\s+/).slice(0, 2).join(" ").toUpperCase();
    if (stmt.trim().startsWith("--") || head.startsWith("PRAGMA")) continue;
    if (head === "INSERT INTO") continue;
    if (head === "DELETE FROM") {
      if (!stmt.includes(SAMPLE_COMPANY_ID)) {
        throw new Error(`サンプル会社を指していない削除があります: ${stmt.slice(0, 80)}`);
      }
      continue;
    }
    throw new Error(`INSERT と DELETE 以外の文が混ざっています: ${stmt.slice(0, 80)}`);
  }
  return true;
}
