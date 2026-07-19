"use client"

import * as React from "react"
import { Button as HeroButton } from "@heroui/react"
import { cn } from "@mantainer-system/ui/lib/utils"

export interface ButtonProps extends Omit<React.ComponentProps<typeof HeroButton>, "size" | "variant"> {
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  disabled?: boolean
}

// Función de compatibilidad pura para los estilos de la app web
export function buttonVariants({ variant = "default", size = "default" }: any = {}) {
  let v = variant === "default" ? "primary" : variant;
  if (v === "destructive") v = "danger";
  let s = size === "default" ? "" : size;
  return cn(
    "button",
    v && `button--${v}`,
    s && `button--${s}`
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", disabled, isDisabled, ...props }, ref) => {
    let heroVariant: "primary" | "secondary" | "outline" | "ghost" | "danger" = "primary";
    if (variant === "default") heroVariant = "primary";
    else if (variant === "secondary") heroVariant = "secondary";
    else if (variant === "outline") heroVariant = "outline";
    else if (variant === "ghost") heroVariant = "ghost";
    else if (variant === "destructive") heroVariant = "danger";
    else if (variant === "link") heroVariant = "ghost";

    let heroSize: "sm" | "md" | "lg" = "md";
    if (size === "xs" || size === "sm" || size === "icon-sm" || size === "icon-xs") heroSize = "sm";
    else if (size === "lg" || size === "icon-lg") heroSize = "lg";

    const isIconOnly = size?.startsWith("icon");

    return (
      <HeroButton
        ref={ref}
        variant={heroVariant}
        size={heroSize}
        isIconOnly={isIconOnly}
        isDisabled={isDisabled || disabled}
        {...(props as any)}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
export default Button;
