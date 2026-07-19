"use client"

import * as React from "react"
import { Label as HeroLabel } from "@heroui/react"

export const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<typeof HeroLabel>>(
  (props, ref) => {
    return (
      <HeroLabel
        ref={ref}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export default Label;
