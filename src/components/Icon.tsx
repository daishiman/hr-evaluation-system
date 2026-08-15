import {
  BookOpenText,
  Building2,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronsUp,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Compass,
  Gauge,
  Hash,
  House,
  Inbox,
  JapaneseYen,
  Layers,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PenLine,
  Power,
  Scale,
  ShieldCheck,
  Target,
  TriangleAlert,
  User,
  UserCog,
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
 * 絵だけで意味が通じないものには、必ず文字を添える。
 * 例外はメニューを畳んだときのアイコンだけの列（AppSidebar のレール）で、
 * そこでは絵の代わりに aria-label と、hover・キーボードのどちらでも出る
 * 吹き出しが文字を持つ（絵だけに意味を預けない）。
 *
 * メニューの項目に使う絵は、その画面が扱う対象から一意に思い出せるものだけにする
 * （「書類」「歯車」のような、どの画面にも当てはまる汎用の絵を割り当てない）。
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

  /* ── メニューの項目（src/lib/nav.ts が意味ごとに割り当てる） ── */
  /** ホーム */
  home: House,
  /** 制度設定ガイド＝上から順に潰していく手順表 */
  guide: ListChecks,
  /** 等級＝段になっているもの */
  grade: Layers,
  /** 等級要件＝満たしているかを確かめる控え */
  requirement: ClipboardCheck,
  /** 昇格＝上の段へ上がる */
  promotion: ChevronsUp,
  /** 行動指針＝進む向きを示すもの */
  behavior: Compass,
  /** KPI＝狙う的 */
  kpi: Target,
  /** アンケート＝配って書いてもらう用紙 */
  survey: ClipboardList,
  /** アンケートの中身を読む */
  surveyRead: BookOpenText,
  /** 評価を付ける・進み具合を見る */
  evaluation: ClipboardPen,
  /** 評価の結果＝集計されたグラフ */
  result: ChartColumn,
  /** 達成率＝目盛りで見る度合い */
  achievement: Gauge,
  /** 昇給＝お金 */
  raise: JapaneseYen,
  /** 評価の基準＝何をどう量るかの決まり */
  criteria: Scale,
  /** 届いた改善要望＝受け取り箱 */
  inbox: Inbox,
  /** 実績を報告する＝自分で書いて出す */
  report: PenLine,
  /** システム全体の利用者＝アカウントの管理 */
  userAdmin: UserCog,

  /* ── 状態（色だけで状態を伝えないための添え物） ── */
  /** うまくいった */
  success: CircleCheck,
  /** 手を止めて読んでほしい */
  warning: TriangleAlert,
  /** 情報が無い・出せない理由がある */
  info: CircleAlert,

  /* ── メニューの開け閉め ── */
  panelOpen: PanelLeftOpen,
  panelClose: PanelLeftClose,
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
