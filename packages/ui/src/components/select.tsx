"use client"

import { Select as HeroSelect, ListBox } from "@heroui/react"
import { ChevronDownIcon } from "lucide-react"

function Select({ value, onValueChange, children, ...props }: any) {
  return (
    <HeroSelect
      selectedKey={value}
      onSelectionChange={onValueChange}
      {...props}
    >
      {children}
    </HeroSelect>
  );
}

function SelectGroup({ children, ...props }: any) {
  return <div {...props}>{children}</div>;
}

function SelectValue({ placeholder, ...props }: any) {
  return (
    <HeroSelect.Value {...props}>
      {({ isPlaceholder, defaultChildren }: any) => {
        if (isPlaceholder) {
          return <span className="text-muted">{placeholder}</span>;
        }
        return defaultChildren;
      }}
    </HeroSelect.Value>
  );
}

function SelectTrigger({
  children,
  ...props
}: any) {
  return (
    <HeroSelect.Trigger
      {...props}
    >
      {children}
      <HeroSelect.Indicator>
        <ChevronDownIcon className="size-4 text-muted" />
      </HeroSelect.Indicator>
    </HeroSelect.Trigger>
  )
}

function SelectContent({
  children,
  ...props
}: any) {
  return (
    <HeroSelect.Popover {...props}>
      <ListBox className="outline-none">
        {children}
      </ListBox>
    </HeroSelect.Popover>
  )
}

// Para evitar lints de props no usadas, removemos los argumentos innecesarios
function SelectLabel(props: any) {
  return <div className="px-2 py-2 text-xs text-muted" {...props} />;
}

function SelectItem({
  value,
  children,
  ...props
}: any) {
  return (
    <ListBox.Item
      id={value}
      textValue={typeof children === "string" ? children : undefined}
      {...props}
    >
      {children}
    </ListBox.Item>
  )
}

function SelectSeparator(props: any) {
  return <div className="h-px bg-border -mx-1 my-1" {...props} />;
}

function SelectScrollUpButton() {
  return null;
}

function SelectScrollDownButton() {
  return null;
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
