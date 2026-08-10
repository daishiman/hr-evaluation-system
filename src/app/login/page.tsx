import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const viewer = await getViewer();
  if (viewer) redirect(homePathFor(viewer.role));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6">
        <h1 className="page-title text-[22px]">人事評価管理システム</h1>
        <p className="page-lede">
          会社から配られたメールアドレスとパスワードでログインしてください。
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
