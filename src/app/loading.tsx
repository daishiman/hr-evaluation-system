export default function Loading() {
  return (
    <main className="narrow-form" aria-live="polite" aria-busy="true">
      <p className="page-title">画面を読み込んでいます</p>
      <p className="page-lede">最新の評価状況を確認しています。少しだけお待ちください。</p>
      <div className="skeleton h-12 w-full" aria-hidden="true" />
      <div className="skeleton mt-3 h-28 w-full" aria-hidden="true" />
    </main>
  );
}
