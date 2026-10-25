#!/usr/bin/env bash
# 本番 D1 の書き出しを age の公開鍵で暗号化する。`.github/scripts/encrypt-d1-backup.sh` に置いて使う。
#
# deploy.yml と migrate.yml から2回呼ばれる。
#   check   … 受け手の公開鍵（D1_BACKUP_AGE_RECIPIENT）の形を確かめる。書き出しの前に流す。
#   encrypt … backup.sql を backup.sql.age にして、平文の backup.sql を消す。
#
# このリポジトリは Public で、Actions の Artifact はログインした誰もが落とせる。
# だから平文の書き出しを Artifact に置かない。CI が持つのは公開鍵だけで、
# 開く鍵（秘密鍵）は利用者の手元に置く（DD-031）。
#
# 受け手は repo の Variables に置く。空白か改行で区切って複数を書ける
# （鍵を1本なくしても開けるように、2本を置いておく使い方を想定）。
# 受け手が無いか形が違うときは、書き出す前に止める。移行もデプロイもしない。
#
# 手元でも同じものを流せる:
#   D1_BACKUP_AGE_RECIPIENT=age1... bash .github/scripts/encrypt-d1-backup.sh check

set -euo pipefail

# package.json の db:backup が書き出す先。
PLAIN="backup.sql"
SEALED="${PLAIN}.age"
# age の出力は必ずこの1行で始まる。違えば暗号化されていないとみなす。
HEADER="age-encryption.org/v1"

# 受け手を1本ずつ取り出して形を確かめ、通ったものを RECIPIENTS に入れる。
# age の X25519 の公開鍵は「age1」と bech32 の58文字（1・b・i・o を使わない）。
read_recipients() {
  RECIPIENTS=()
  local -a keys=()
  local key
  # 空白と改行で区切る。`for key in $raw` は * などを展開してしまうので使わない。
  IFS=$' \t\n' read -r -d '' -a keys <<<"${D1_BACKUP_AGE_RECIPIENT:-}" || true
  # ${keys[@]+...} は、空の配列を set -u で展開すると落ちる古い bash（macOS の 3.2）のため。
  for key in ${keys[@]+"${keys[@]}"}; do
    if [[ ! "$key" =~ ^age1[02-9ac-hj-np-z]{58}$ ]]; then
      # 値そのものは公開鍵だが、貼り間違えた秘密鍵かもしれないので表示しない。
      echo "::error::D1_BACKUP_AGE_RECIPIENT に age の公開鍵（age1 で始まる62文字）ではない値があります。書き出す前に止めます。"
      exit 1
    fi
    RECIPIENTS+=("$key")
  done
  if [ "${#RECIPIENTS[@]}" -eq 0 ]; then
    echo "::error::D1_BACKUP_AGE_RECIPIENT が設定されていません。本番 D1 の書き出しを暗号化できないので、書き出す前に止めます（docs/deploy-notes.md の「書き出しの暗号化」）。"
    exit 1
  fi
}

case "${1:-}" in
  check)
    read_recipients
    echo "受け手の公開鍵: ${#RECIPIENTS[@]} 本"
    ;;
  encrypt)
    read_recipients
    if [ ! -s "${PLAIN}" ]; then
      echo "::error::${PLAIN} がありません（または空です）。"
      exit 1
    fi
    args=()
    for key in "${RECIPIENTS[@]}"; do
      args+=(-r "$key")
    done
    rm -f "${SEALED}"
    if ! age "${args[@]}" -o "${SEALED}" "${PLAIN}"; then
      rm -f "${SEALED}"
      echo "::error::${PLAIN} を暗号化できませんでした。"
      exit 1
    fi
    # 先頭を確かめる。暗号化されていないものを Artifact に上げないため、
    # 合わなければ出力を消してから止める（保管の step は always() で動くので）。
    if [ "$(head -n 1 "${SEALED}")" != "${HEADER}" ]; then
      rm -f "${SEALED}"
      echo "::error::${SEALED} が age の形式になっていません。保管せずに止めます。"
      exit 1
    fi
    rm -f "${PLAIN}"
    echo "暗号化しました: ${SEALED}（受け手 ${#RECIPIENTS[@]} 本）。平文の ${PLAIN} は消しました。"
    ;;
  *)
    echo "使い方: $0 check|encrypt" >&2
    exit 2
    ;;
esac
