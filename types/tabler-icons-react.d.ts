declare module "@tabler/icons-react" {
  import * as React from "react";
  export interface TablerIconProps {
    size?: number;
    className?: string;
    stroke?: string;
    strokeWidth?: number;
  }
  export const IconMask: React.FC<TablerIconProps>;
  export const IconEye: React.FC<TablerIconProps>;
  export const IconSwords: React.FC<TablerIconProps>;
  export const IconShield: React.FC<TablerIconProps>;
  export const IconFeather: React.FC<TablerIconProps>;
  export const IconScale: React.FC<TablerIconProps>;
  export const IconCrown: React.FC<TablerIconProps>;
  export const IconFlame: React.FC<TablerIconProps>;
}
