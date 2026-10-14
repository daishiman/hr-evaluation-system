import { apiViewerFor, handle } from "@/lib/api";
import { getDb } from "@/lib/db";
import {
  readThemePreferenceUsage,
  themePreferenceSchema,
  upsertThemePreference,
} from "@/lib/theme-preferences";

export const dynamic = "force-dynamic";

/**
 * ログイン中の利用者が「現在選んでいる外観」を保存する。
 *
 * 利用者IDは本文に持たせず、検証済みセッションだけを正本にする。
 * 同じ利用者は常に1行で、同値の再選択は実質的なno-opになる。
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const viewer = await apiViewerFor("appearance.save");
    const choice = themePreferenceSchema.parse(await req.json());
    const db = await getDb();
    await upsertThemePreference(db, viewer.id, choice);
    return { message: "現在の外観設定を記録しました。" };
  });
}

/** 現在の利用人数と割合。個人を識別できる値は返さない。 */
export async function GET() {
  return handle(async () => {
    await apiViewerFor("appearance.read");
    return readThemePreferenceUsage(await getDb());
  });
}
