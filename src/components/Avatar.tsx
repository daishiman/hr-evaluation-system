import { clsx } from "clsx";

/**
 * 名前の頭文字で描く丸いアイコン。
 *
 * 顔写真は持たない前提なので、名前から作る。
 * 色は名前から決めて毎回同じにする（同じ人がいつも同じ色に見えることで、
 * 一覧を上から読まなくても「自分の行」を見つけられる）。
 */

/** 色相を増やしすぎないよう、落ち着いた6色に固定する。 */
const TONES = 6;

export function avatarTone(seed: string): number {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum = (sum + seed.charCodeAt(i) * (i + 1)) % 9973;
  return sum % TONES;
}

/** 日本語の氏名は先頭1文字、英字は2文字までを取る。 */
export function avatarInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  if (/^[\x20-\x7e]+$/.test(trimmed)) {
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]!.toUpperCase()).join("");
  }
  return trimmed[0]!;
}

export function Avatar({
  name,
  seed,
  size = 32,
  className,
}: {
  name: string;
  /** 色を決める種。指定しなければ名前を使う */
  seed?: string;
  size?: number;
  className?: string;
}) {
  const tone = avatarTone(seed ?? name);
  return (
    <span
      className={clsx("avatar", className)}
      data-tone={tone}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {avatarInitials(name)}
    </span>
  );
}
