import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("行動指針の画面・フォーム・評価の境界", () => {
  it("Server Component は Client Component から等級帯の定数を読まない", () => {
    const clientEditor = read("src/components/BehaviorGuidelineEditor.tsx");
    const behaviorPage = read("src/app/admin/behavior/page.tsx");
    const mastersPage = read("src/app/admin/masters/page.tsx");

    expect(clientEditor).not.toContain("export const BAND_LABEL");
    expect(behaviorPage).toContain('from "@/lib/domain/behavior"');
    expect(mastersPage).toContain('from "@/lib/domain/behavior"');
    expect(behaviorPage).not.toContain('BAND_LABEL, BehaviorGuidelineEditor } from "@/components/BehaviorGuidelineEditor"');
  });

  it("等級ごとの現在値と選択欄を同じカードに置く（等級タブで1件ずつ編集する）", () => {
    const page = read("src/app/admin/behavior/page.tsx");
    const editor = read("src/components/BehaviorBandAssignmentEditor.tsx");

    expect(page).toContain("<BehaviorBandAssignmentEditor");
    expect(page).not.toContain("<CardRow");
    /* 2026-08-12、「昇格の条件・要件」画面と同じ等級タブ切り替えに揃えた。
       縦に全等級を並べる代わりに、選ばれた1等級分だけを描く。 */
    expect(page).toMatch(/<BehaviorBandAssignmentEditor\s+key=\{selectedGrade\.id\}/);
    expect(editor).toContain("grade: BehaviorAssignmentGradeRow");
    expect(editor).toContain("この等級に出す行動指針");
    expect(editor).toContain("行動指針を出さない");
    expect(editor).toContain("現在値へ戻す");
    expect(editor).toContain("いまは選べません");
  });

  it("行動指針画面も等級タブの切り替えで下書き状態を作り直す（昇格画面と同じ作法）", () => {
    const page = read("src/app/admin/behavior/page.tsx");
    expect(page).toContain("等級を選ぶ");
    expect(page).toMatch(/href=\{`\/admin\/behavior\?grade=\$\{g\.id\}/);
    expect(page).toContain('<span className="tag">編集中の等級');
  });

  it("基準セットは会社の設定を正本にし、コードに固定しない", () => {
    const page = read("src/app/admin/behavior/page.tsx");
    const domain = read("src/lib/domain/behavior.ts");
    const bodySchema = read("src/app/api/masters/body-schema.ts");
    const apply = read("src/app/api/masters/apply-master-update.ts");

    // 選べる基準は DB（behavior_band_sets）から来る。定数の総当たりに戻さない。
    expect(page).toContain("listBehaviorBandSets(companyId)");
    expect(page).toContain("bandSets.map((set) => set.code)");
    expect(domain).not.toContain("export const BEHAVIOR_BANDS");
    // 等級への割り当ては「自社に実在し、使用中の基準か」をサーバー側で確かめる。
    expect(bodySchema).not.toContain("z.enum(BEHAVIOR_BANDS)");
    expect(apply).toContain("s.behaviorBandSets.code, body.behaviorBand");
    // 空の基準は等級に割り当てさせない（設問0件のアンケートができるため）。
    expect(page).toContain("guidelines.some((g) => g.band === set.code && g.isActive)");
  });

  it("基準セットの操作は必ず自社の中だけで解決する", () => {
    const route = read("src/app/api/masters/apply-master-update.ts");
    const apply = read("src/app/api/masters/apply-behavior-master-update.ts");
    expect(route).toContain("applyBehaviorMasterUpdate");

    /* 会社の基準を一度だけ読み、その中から id / code を探す形にしている。
       id で直接 DB を引く形に戻すと、他社の基準を指す id を送られたときに通る。 */
    expect(apply).toContain("eq(s.behaviorBandSets.companyId, companyId)");
    expect(apply).toContain("sets.find((set) => set.id === body.id)");
    expect(apply).toContain("sets.find((set) => set.code === body.copyFromBand)");
    // 複製元の観点・段階も自社スコープで読む
    expect(apply).toContain("eq(s.behaviorGuidelines.companyId, companyId), eq(s.behaviorGuidelines.band, source.code)");
    // 観点の追加先も「自社にあるセットか」を確かめてから作る
    expect(apply).toContain("eq(s.behaviorBandSets.companyId, companyId), eq(s.behaviorBandSets.code, band)");
  });

  it("使用中の基準セットは止められず、消すのは一度も使っていないものだけ", () => {
    const apply = read("src/app/api/masters/apply-behavior-master-update.ts");
    const setEditor = read("src/components/BehaviorBandSetEditor.tsx");

    /* 2026-08-12、1文40文字の決まりに合わせて2文に割った。中身（どこを直すか・そのあと何ができるか）は同じ。 */
    expect(apply).toContain("先に「どの等級に出すか」で、ほかの基準か「適用しない」に変えてください。");
    expect(apply).toContain("そのあとで使用を止められます。");
    /* 「使わない」を扱うこの経路からは物理削除しない。
       消す操作は delete-master-item.ts に分けてあり、そちらが
       「一度でも使ったか」を数えてから消す（判定の実物は delete-master-item.test.ts）。 */
    expect(apply).not.toContain("db.delete(s.behaviorBandSets)");
    expect(apply).not.toContain("db.delete(s.behaviorGuidelines)");
    expect(setEditor).toContain('from "@/components/ConfirmButton"');
    expect(setEditor).toContain("すでに公開したアンケートと確定済みの評価はそのまま残ります");
  });

  it("消せない項目には、画面に理由と次にすることが出る", () => {
    const setEditor = read("src/components/BehaviorBandSetEditor.tsx");
    const guidelineEditor = read("src/components/BehaviorGuidelineEditor.tsx");
    const gradeEditor = read("src/components/GradeRequirementEditor.tsx");
    const promoEditor = read("src/components/PromotionRequirementEditor.tsx");

    /* ボタンを消すだけで黙らない。「なぜ消せないか」と「代わりに何をすればよいか」を
       その場に出す（無言の読み取り専用を作らない）。

       2026-08-12、出し方だけを変えた（spec §22-5）。全行に同じ長い1文を並べる代わりに、
       行には「使用中（◯件）」の印、押すと使っている場所、理由と代わりの手段はカードの下に1か所。
       情報は1つも減らしていないので、検査は「4つとも画面のどこかに出ている」ことに読み替える。

       同日さらに、押して開いた先の出し方を変えた。placesText は場所の名前を「・」で
       つないで先頭2件に省く（＝1行が70文字を超え、しかも残りが読めない）。
       開いた先に省く理由は無いので、画面側は UsedByDetail で全件を並びにする。
       placesText はサーバーが返す文（deleteBlockedReason）に残っている。 */
    for (const source of [guidelineEditor, gradeEditor, promoEditor, setEditor]) {
      // ①消せないという事実（行の印）と、②使っている場所（押すと全件が並びで出る）
      expect(source).toContain("blockedMark");
      expect(source).toContain("UsedByDetail");
      // ③消せない理由 ④代わりの手段（カードの下に1か所・押すと出る）
      expect(source).toContain("BLOCKED_WHY");
      expect(source).toContain("BLOCKED_WHAT");
      expect(source).toContain("BLOCKED_KEEP");
      // 畳んだものを開く場所が必ずある（畳む＝隠すにしない）
      expect(source).toContain("BLOCKED_HELP_LABEL");
      expect(source).toContain("Disclosure");
      expect(source).toContain("DELETE_LABEL");
    }
    /* 開く場所（InlineDetail）と全件の並びは、4つの画面で1つの部品に集約している。
       ここが省略に戻ったら気づけるよう、部品そのものを見る。 */
    const usedByDetail = read("src/components/UsedByDetail.tsx");
    expect(usedByDetail).toContain("InlineDetail");
    expect(usedByDetail).toContain("usedBy.map");
    expect(usedByDetail).not.toContain("placesText");
    expect(usedByDetail).toContain("<ul");

    /* 基準セットは「等級に出す設定になっていないか」も見るので、専用の次の一手を出す。
       等級名の並びは行の中にすでに出ているので、この文では繰り返さない
       （繰り返すと、等級が増えたぶんだけ長い1文が行に出る）。
       名前を含む文はサーバーの返事（bandSetBlockedReason）に残してある。 */
    expect(setEditor).toContain("BAND_SET_ASSIGNED_NEXT");
    expect(setEditor).toContain("usedByGradeNames");
    expect(read("src/app/api/masters/delete-master-item.ts")).toContain("bandSetBlockedReason");
    expect(setEditor).toContain("DELETE_LABEL");
    // 「使わない」「もう一度使う」は消さずに残す（消すのはそれに加えた3つ目の選択肢）
    expect(guidelineEditor).toContain("使わない");
    expect(read("src/components/VersionedMasterSections.tsx")).toContain("もう一度使う");
  });

  it("使用しない状態は、カード全体の見た目と札の両方で分かる（色だけに頼らない）", () => {
    const ui = read("src/components/ui.tsx");
    const css = read("src/app/globals.css");

    // 面と枠線の変化は共通の1箇所（data-off）にまとめる。画面ごとに書き散らさない。
    expect(ui).toContain('data-off={off ? "true" : undefined}');
    expect(css).toContain('.card[data-off="true"]');
    expect(css).toContain("border-style: dashed");
    // 本文の文字色は薄くしない（読みやすさの下限を割るため）。区別は面・線・札で付ける。
    // border-color は変えてよいので、文字色（color: 単体）だけを見る。
    expect(css).not.toMatch(/\.card\[data-off="true"\][^}]*[^-]color:\s*var\(--ink-muted\)/);
  });

  it("等級切替時は昇格フォームと下書き状態を作り直す", () => {
    const page = read("src/app/admin/masters/promotion/page.tsx");
    expect(page).toMatch(/<RecordForm\s+key=\{grade\.id\}/);
    expect(page).toMatch(/<PromotionRequirementEditor\s+key=\{grade\.id\}/);
  });

  it("無効な行動指針を次のアンケートに入れない", () => {
    const formBuild = read("src/lib/form-build.ts");
    const editor = read("src/components/BehaviorGuidelineEditor.tsx");
    const queries = read("src/lib/queries.ts");
    const adminListQuery = queries.slice(
      queries.indexOf("export async function listBehaviorGuidelines"),
      queries.indexOf("/* ───────────────── KPI・評価セット", queries.indexOf("export async function listBehaviorGuidelines")),
    );
    expect(formBuild).toContain("eq(s.behaviorGuidelines.isActive, true)");
    expect(adminListQuery).not.toContain("behaviorGuidelines.isActive");
    expect(editor).toContain('from "@/components/ConfirmButton"');
    expect(editor).toContain('isActive: false');
    expect(editor).toContain('isActive: true');
    expect(editor).toContain("すでに公開したアンケートと確定済みの評価はそのまま残ります");
  });

  it("アンケートの中身を見る画面は公開済みの設問だけを読む（基準を直しても動かない）", () => {
    const list = read("src/app/forms/page.tsx");
    const detail = read("src/app/forms/[id]/page.tsx");

    /* 基準セットを作る・複製する・呼び名を変えても、すでに公開したアンケートは
       1文字も変わらないこと。設問は公開したときの写し（form_questions）なので、
       この画面が行動指針のマスタを直接読み始めたらその保証が崩れる。 */
    for (const source of [list, detail]) {
      expect(source).not.toContain("behaviorGuidelines");
      expect(source).not.toContain("behaviorBandSets");
      expect(source).not.toContain("listBehaviorGuidelines");
    }
    expect(detail).toContain("listFormQuestions(");
  });

  it("評価の観点名は現在のマスタではなく公開済み設問の写しを使う", () => {
    const evaluate = read("src/lib/evaluate.ts");
    expect(evaluate).toContain("aspectName: q.title");
    expect(evaluate).not.toContain("aspectName: g?.aspectName ?? q.title");
  });
});
