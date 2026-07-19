"use client"

import * as React from "react"
import { Skeleton as HeroSkeleton } from "@heroui/react"

export const Skeleton = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof HeroSkeleton>>(
  (props, ref) => <HeroSkeleton ref={ref} {...props} />
);
Skeleton.displayName = "Skeleton";

export default Skeleton;
