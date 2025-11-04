import { memo } from "react";
import type { CardIconId } from "@/lib/game/types";
import {
  IconMask,
  IconEye,
  IconSwords,
  IconShield,
  IconFeather,
  IconScale,
  IconCrown,
  IconFlame,
} from "@tabler/icons-react";

interface CardSymbolProps {
  icon: CardIconId;
  size?: number;
  className?: string;
}

const IconTargetGlyph = (props: { size?: number; className?: string; stroke?: string; strokeWidth?: number }) => {
  const size = props.size ?? 28;
  const stroke = props.stroke ?? "currentColor";
  const strokeWidth = props.strokeWidth ?? 1.8;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={props.className}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="3" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="21" />
      <line x1="3" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="21" y2="12" />
    </svg>
  );
};

const ICON_COMPONENTS: Record<CardIconId, (props: { size?: number; className?: string; stroke?: string; strokeWidth?: number }) => JSX.Element> = {
  mask: (props) => <IconMask {...props} />,
  eye: (props) => <IconEye {...props} />,
  swords: (props) => <IconSwords {...props} />,
  shield: (props) => <IconShield {...props} />,
  quill: (props) => <IconFeather {...props} />,
  balance: (props) => <IconScale {...props} />,
  crown: (props) => <IconCrown {...props} />,
  flame: (props) => <IconFlame {...props} />,
  target: (props) => <IconTargetGlyph {...props} />,
};

export const CardSymbol = memo(function CardSymbol({ icon, size = 28, className }: CardSymbolProps) {
  const Component = ICON_COMPONENTS[icon];
  // 太めのストロークで暗色背景でも視認性を担保
  return <Component size={size} className={className} stroke="currentColor" strokeWidth={1.8} />;
});

