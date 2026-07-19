"use client"

import * as React from "react"
import { Chip } from "@heroui/react"

export interface BadgeProps extends Omit<React.ComponentProps<typeof Chip>, "variant" | "color"> {
  variant?: "default" | "secondary" | "destructive" | "outline"
  color?: "default" | "danger" | "success" | "accent" | "warning"
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", color, ...props }, ref) => {
    let heroVariant: "primary" | "secondary" | "tertiary" | "soft" = "primary";
    let heroColor: "default" | "danger" | "success" | "accent" | "warning" = "accent";

    if (variant === "default") {
      heroColor = "accent";
      heroVariant = "primary";
    } else if (variant === "secondary") {
      heroColor = "default";
      heroVariant = "secondary";
    } else if (variant === "destructive") {
      heroColor = "danger";
      heroVariant = "primary";
    } else if (variant === "outline") {
      heroColor = "default";
      heroVariant = "soft";
    }

    if (color) {
      heroColor = color;
    }

    return (
      <Chip
        ref={ref as any}
        variant={heroVariant}
        color={heroColor}
        {...(props as any)}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
export default Badge;
