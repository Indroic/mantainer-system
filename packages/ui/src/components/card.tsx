"use client"

import * as React from "react"
import { Card as HeroCard } from "@heroui/react"

const Card = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof HeroCard>>(
  (props, ref) => <HeroCard ref={ref} {...props} />
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof HeroCard.Header>>(
  (props, ref) => <HeroCard.Header ref={ref} {...props} />
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<typeof HeroCard.Title>>(
  (props, ref) => <HeroCard.Title ref={ref} {...props} />
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<typeof HeroCard.Description>>(
  (props, ref) => <HeroCard.Description ref={ref} {...props} />
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof HeroCard.Content>>(
  (props, ref) => <HeroCard.Content ref={ref} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof HeroCard.Footer>>(
  (props, ref) => <HeroCard.Footer ref={ref} {...props} />
);
CardFooter.displayName = "CardFooter";

const CardAction = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  (props, ref) => <div ref={ref} {...props} />
);
CardAction.displayName = "CardAction";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
}
export default Card;
