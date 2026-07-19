"use client"

import * as React from "react"
import { Input as HeroInput } from "@heroui/react"

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof HeroInput>>(
  (props, ref) => {
    return (
      <HeroInput
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export default Input;
