import { LinkButton } from "@/components/ui";
import { BackButton } from "@/components/BackButton";

export default function NotFound() {
  return (
    /* 幅と余白は globals.css の main / .narrow-form だけが決める。
       この画面だけ max-w-* と padding を直書きすると、他の画面と余白が食い違う。 */
    <main className="narrow-form text-center">
      <h1 className="page-title">ページが見つかりません</h1>
      <p className="page-lede">アドレスが変わったか、閲覧できる権限がない可能性があります。</p>
      <div className="flex flex-wrap justify-center gap-3">
        <BackButton label="前の画面へ戻る" />
        <LinkButton href="/" variant="primary">ホームへ戻る</LinkButton>
      </div>
    </main>
  );
}
