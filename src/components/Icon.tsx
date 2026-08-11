import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Hash,
  Layers,
  Lock,
  LogOut,
  Mail,
  Pencil,
  Power,
  ShieldCheck,
  User,
  UserRound,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * アイコンは「意味」で呼ぶ。
 *
 * 画面側で lucide の部品名（Building2 など）を直に書くと、
 * 同じ意味に別々の絵が付いて、見た目が意味を持たなくなる。
 * ここで意味 → 絵 を1対1に固定し、差し替えるときもこの表だけ直す。
 *
 * 絵だけで意味が通じないものには、必ず文字を添える（アイコン単独のボタンを作らない）。
 */
const ICONS = {
  user: User,
  avatar: UserRound,
  building: Building2,
  hash: Hash,
  calendar: CalendarDays,
  shield: ShieldCheck,
  layers: Layers,
  users: Users,
  power: Power,
  /** 会社の管理者しか変えられないことを表す */
  lock: Lock,
  /** 本人が変えられることを表す */
  pencil: Pencil,
  mail: Mail,
  key: Lock,
  signout: LogOut,
  chevron: ChevronDown,
  check: Check,
} satisfies Record<string, ComponentType<{ size?: number; strokeWidth?: number; className?: string }>>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const C = ICONS[name];
  // 意味は隣の文字が持つ。読み上げでは絵を飛ばす
  return <C size={size} strokeWidth={1.75} className={className} aria-hidden />;
}

export function hasIcon(name: string): name is IconName {
  return name in ICONS;
}
