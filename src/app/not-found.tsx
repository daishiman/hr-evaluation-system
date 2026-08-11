import Link from "next/link";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-20 text-center">
      <h1 className="page-title">ページが見つかりません</h1>
      <p className="page-lede">アドレスが変わったか、閲覧できる権限がない可能性があります。</p>
      <LinkButton href="/" variant="primary">ホームへ戻る</LinkButton>
    </main>
  );
}
