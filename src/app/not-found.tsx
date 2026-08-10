import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-20 text-center">
      <h1 className="page-title">ページが見つかりません</h1>
      <p className="page-lede">アドレスが変わったか、閲覧できる権限がない可能性があります。</p>
      <Link href="/" className="btn btn-primary">ホームへ戻る</Link>
    </main>
  );
}
