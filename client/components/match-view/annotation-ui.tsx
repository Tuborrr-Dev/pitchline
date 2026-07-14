import type { CSSProperties } from "react";
import {
  Bot,
  Circle,
  CircleAlert,
  Clock,
  ClockPlus,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Trophy,
} from "lucide-react";

import type { Annotation } from "@/lib/types";

const footballIconPaths = {
  corner: "/football-icons/corner-icon.svg",
  freeKick: "/football-icons/free-kick-icon.svg",
  goal: "/football-icons/goal-icon.svg",
  injury: "/football-icons/medical-cross-icon.svg",
  matchEnd: "/football-icons/match-end-icon.svg",
  penalty: "/football-icons/penalty-icon.svg",
  shot: "/football-icons/shot-icon.svg",
  soccerBall: "/football-icons/soccer-ball-icon.svg",
  substitution: "/football-icons/substitution-icon.svg",
  var: "/football-icons/var-icon.svg",
  whistle: "/football-icons/whistle-icon.svg",
} as const;

type FootballIconName = keyof typeof footballIconPaths;

function normalizeIconKey(value?: string) {
  return value?.trim().replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase();
}

export function footballIconName(icon?: string, action?: string): FootballIconName | null {
  const iconKey = normalizeIconKey(icon);
  const actionKey = normalizeIconKey(action);

  if (actionKey === "free_kick") return "freeKick";
  if (actionKey === "goal") return "goal";
  if (actionKey === "penalty" || actionKey === "penalty_outcome" || actionKey?.includes("penalty")) return "penalty";
  if (actionKey === "var" || actionKey === "var_end") return "var";

  const key = iconKey || actionKey;

  if (!key) return null;
  if (key.includes("corner")) return "corner";
  if (key === "shot" || key === "target" || key.includes("shot")) return "shot";
  if (key === "goal") return "goal";
  if (key === "soccer_ball" || key === "football") return "soccerBall";
  if (key === "whistle" || key === "kickoff" || key === "penalty_shootout_team") return "whistle";
  if (key === "penalty" || key === "penalty_outcome" || key.includes("penalty")) return "penalty";
  if (key === "substitution" || key.includes("substitution")) return "substitution";
  if (key === "medical_cross" || key === "injury" || key.includes("medical")) return "injury";
  if (key === "checkered_flag" || key === "game_finalised" || key === "fulltime" || key === "full_time") return "matchEnd";
  if (key === "var" || key === "var_end" || key === "video") return "var";

  return null;
}

export function annotationId(item: Pick<Annotation, "fixture_id" | "source_action" | "source_id">) {
  return `${item.fixture_id}-${item.source_action}-${item.source_id}`;
}

export function annotationTone(color?: string) {
  switch (color) {
    case "green":
      return "border-l-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)]";
    case "red":
      return "border-l-[#ff4b6e] bg-red-500/10 text-[#d71945]";
    case "gold":
      return "border-l-[#d6a726] bg-amber-500/10 text-[#d6a726]";
    case "gray":
    default:
      return "border-l-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)]";
  }
}

export function FootballActionIcon({
  action,
  className,
  icon,
}: {
  action?: string;
  className?: string;
  icon?: string;
}) {
  const name = footballIconName(icon, action);
  if (!name) return null;

  const path = footballIconPaths[name];
  const style = {
    WebkitMask: `url(${path}) center / contain no-repeat`,
    mask: `url(${path}) center / contain no-repeat`,
  } satisfies CSSProperties;

  return <span aria-hidden="true" className={`inline-block bg-current ${className ?? ""}`} style={style} />;
}

export function AnnotationGlyph({
  action,
  className,
  icon,
}: {
  action?: string;
  className?: string;
  icon?: string;
}) {
  const iconKey = normalizeIconKey(icon);
  const actionKey = normalizeIconKey(action);
  if (icon !== undefined && !iconKey) return null;

  if (footballIconName(icon, action)) {
    return <FootballActionIcon action={action} icon={icon} className={className} />;
  }

  if (actionKey === "additional_time") {
    return <ClockPlus className={className} />;
  }

  switch (iconKey || actionKey) {
    case "clock":
    case "status":
    case "additional_time":
      return <ClockPlus className={className} />;
    case "half_time":
    case "halftime":
      return <Clock className={className} />;
    case "red_card":
    case "red_square":
    case "yellow_card":
      return <ShieldAlert className={className} />;
    case "var":
    case "var_end":
    case "video":
      return <MessageSquare className={className} />;
    case "bot":
      return <Bot className={className} />;
    case "sparkles":
      return <Sparkles className={className} />;
    case "x_mark":
      return <CircleAlert className={className} />;
    case "goal_post":
      return <Trophy className={className} />;
    case undefined:
    case "":
      return null;
    default:
      return <Circle className={className} />;
  }
}
