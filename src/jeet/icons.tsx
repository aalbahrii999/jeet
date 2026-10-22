import type { SVGProps } from "react";
type Props = SVGProps<SVGSVGElement> & { size?: number };
const paths = {
  Home: ["m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"],
  Dumbbell: ["m6.5 6.5 11 11M4 3l-1 1v5l4 4 2-2M20 21l1-1v-5l-4-4-2 2M3 8l5-5M16 21l5-5"],
  Flame: ["M12 3c1 5 6 6 6 11a6 6 0 0 1-12 0c0-2 1-4 3-6 0 3 1 4 2 4 2-3 1-6 1-9z"],
  CalendarDays: ["M7 2v4M17 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M7 13h2M15 13h2M7 17h2M15 17h2"],
  BarChart3: ["M4 3v18h17M8 16v-5M13 16V7M18 16v-8"],
  Settings: ["m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0"],
  Ruler: ["m3 16 13-13 5 5L8 21zM7 12l2 2M11 8l2 2M15 4l2 2"],
  Timer: ["M9 2h6M12 5v2M19 5l2 2M12 11v4l2 1M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  Vibrate: ["M8 3h8v18H8zM4 7l-2 3 2 4-2 3M20 7l2 3-2 4 2 3"],
  X: ["m6 6 12 12M6 18 18 6"], Plus: ["M12 5v14M5 12h14"], Check: ["m5 12 4 4L19 6"],
  ChevronLeft: ["m15 5-7 7 7 7"], ChevronRight: ["m9 5 7 7-7 7"], ArrowUp: ["M12 20V4m-6 6 6-6 6 6"], ArrowDown: ["M12 4v16m-6-6 6 6 6-6"],
  ArrowUpRight: ["M5 19 19 5M5 5h14v14"], Pencil: ["m15 4 5 5M3 21l1-6L17 2l5 5L9 20z"],
  Trash2: ["M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"],
  Copy: ["M8 8h13v13H8zM16 8V3H3v13h5"], Search: ["M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6"],
  Camera: ["M3 7h4l2-3h6l2 3h4v14H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0"],
  Play: ["m8 4 13 8-13 8z"], FileDown: ["M14 2H4v20h16V8zM14 2v6h6M12 11v7m-3-3 3 3 3-3"],
  Download: ["M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"], Upload: ["M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5"],
  ShieldCheck: ["m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6zM8 12l3 3 5-6"],
  Sparkles: ["m12 3 2 6 7 3-7 3-2 6-2-6-7-3 7-3z"], Library: ["M3 4h4v17H3zM10 4h4v17h-4zM17 4l4-1 3 17-4 1z"],
  RotateCcw: ["M3 3v6h6M3 9a9 9 0 1 1 0 6"], Heart: ["M20 4c-4-3-8 2-8 2S8 1 4 4C-2 9 12 21 12 21S26 9 20 4"],
  TrendingUp: ["m3 17 6-6 4 4 8-10M14 5h7v7"], Ellipsis: ["M5 12h.01M12 12h.01M19 12h.01"],
};
export type IconName = keyof typeof paths;
export function Icon({ name, size = 22, ...props }: Props & { name: IconName }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name].map((d, i) => <path key={i} d={d} />)}</svg>;
}
const icon = (name: IconName) => function NamedIcon(props: Props) { return <Icon name={name} {...props} />; };
export const Home = icon("Home"), Dumbbell = icon("Dumbbell"), Flame = icon("Flame"), CalendarDays = icon("CalendarDays"), BarChart3 = icon("BarChart3"), Settings = icon("Settings"), Ruler = icon("Ruler"), Timer = icon("Timer"), Vibrate = icon("Vibrate"), X = icon("X"), Plus = icon("Plus"), Check = icon("Check"), ChevronLeft = icon("ChevronLeft"), ChevronRight = icon("ChevronRight"), ArrowUp = icon("ArrowUp"), ArrowDown = icon("ArrowDown"), ArrowUpRight = icon("ArrowUpRight"), Pencil = icon("Pencil"), Trash2 = icon("Trash2"), Copy = icon("Copy"), Search = icon("Search"), Camera = icon("Camera"), Play = icon("Play"), FileDown = icon("FileDown"), Download = icon("Download"), Upload = icon("Upload"), ShieldCheck = icon("ShieldCheck"), Sparkles = icon("Sparkles"), Library = icon("Library"), RotateCcw = icon("RotateCcw"), Heart = icon("Heart"), TrendingUp = icon("TrendingUp"), Ellipsis = icon("Ellipsis");
