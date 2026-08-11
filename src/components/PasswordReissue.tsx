import { RecordForm } from "@/components/RecordForm";
import { Disclosure } from "@/components/ui";

/**
 * パスワードの再発行（管理者が本人の代わりに出し直す）。
 *
 * 社員の画面（会社の管理者）とシステム全体の利用者画面で、同じ作法にするために
 * ここ1箇所に集める。人が思いついた文字列を管理者が手打ちすると、会社ごとに
 * 同じ値を使い回したり当てやすい値になりやすいため、新規発行（利用者の追加・
 * CSV一括取込）と同じ生成の仕組み（src/lib/domain/initial-password.ts）で作った
 * 値を初期表示にする。
 *
 * 見せ方も新規発行に揃える:
 *  - 伏せ字にしない（渡す側が読み上げ・書き写しをするため）
 *  - 「作り直す」「写す」を添える
 *  - 送信後は今回の値だけを残して表示し、「次の入力を始める」まで作り直さない
 *  - 発行後は仮のもの扱い（mustChangePassword）になり、本人に変更のお願いが出る
 */
export function PasswordReissue({ url, userId, name }: { url: string; userId: string; name: string }) {
  return (
    <Disclosure summary="仮パスワードを再発行する" meta="ご本人がログインできなくなったときに使います">
      <RecordForm
        url={url}
        method="PATCH"
        fixed={{ userId }}
        submitLabel="この仮パスワードを発行する"
        description={`発行すると、いまのパスワードは使えなくなり、${name}さんはログインし直しになります。発行後の画面に出る値を、この画面を離れる前にご本人へ安全な方法でお伝えください。最初のログインのあと、変更のお願いが表示されます。`}
        resetAfterSubmit
        fields={[
          {
            name: "password",
            label: "仮パスワード",
            type: "password",
            required: true,
            generate: true,
            help: "この場で作った値を出しています。読み違えやすい文字（0とO、1とl）は入っていません。",
          },
        ]}
      />
    </Disclosure>
  );
}
