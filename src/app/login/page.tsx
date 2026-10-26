import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { getViewer, homePathFor } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const viewer = await getViewer();
  const { next } = await searchParams;
  // 外部サイトへ飛ばされないよう、戻り先は自サイト内のパスだけを受け付ける（DD-032 の6）。
  // 使えない値は空にして、役割ごとの既定の行き先へ回す
  const safeNext = safeRedirectPath(next, "") || undefined;
  if (viewer) redirect(safeNext ?? homePathFor(viewer.role));

  return (
    <main className="narrow-form mx-auto flex min-h-screen flex-col justify-center px-5 py-10">
      <div className="mb-6">
        <h1 className="page-title text-num-s">人事評価管理システム</h1>
        <p className="page-lede">
          会社から配られたメールアドレスとパスワードでログインしてください。
        </p>
      </div>
      <LoginForm next={safeNext} />
    </main>
  );
}
