"use client"

import * as React from "react"
import { Dropdown } from "@heroui/react"
import { ChevronRightIcon } from "lucide-react"

const DropdownContext = React.createContext<{
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
} | null>(null);

function DropdownMenu({ open, onOpenChange, defaultOpen, children }: any) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const isOpen = open !== undefined ? open : internalOpen;
  
  const handleOpenChange = React.useCallback((val: boolean) => {
    if (onOpenChange) {
      onOpenChange(val);
    } else {
      setInternalOpen(val);
    }
  }, [onOpenChange]);

  const value = React.useMemo(() => ({
    isOpen,
    onOpenChange: handleOpenChange
  }), [isOpen, handleOpenChange]);

  return (
    <DropdownContext.Provider value={value}>
      <Dropdown isOpen={isOpen} onOpenChange={handleOpenChange}>{children}</Dropdown>
    </DropdownContext.Provider>
  );
}

function DropdownMenuTrigger({ children, asChild, ...props }: any) {
  const context = React.useContext(DropdownContext);
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, {
      onClick: (e: any) => {
        (children.props as any).onClick?.(e);
        context?.onOpenChange?.(true);
      }
    });
  }

  return (
    <button type="button" onClick={() => context?.onOpenChange?.(true)} {...props}>
      {children}
    </button>
  );
}

function DropdownMenuPortal({ children }: any) {
  return <>{children}</>;
}

function DropdownMenuContent({ children, ...props }: any) {
  return (
    <Dropdown.Popover {...props}>
      <Dropdown.Menu className="outline-none">
        {children}
      </Dropdown.Menu>
    </Dropdown.Popover>
  );
}

function DropdownMenuGroup({ children, ...props }: any) {
  return <div {...props}>{children}</div>;
}

function DropdownMenuLabel({ className, ...props }: any) {
  return <div className="px-2 py-1.5 text-xs text-muted font-semibold" {...props} />;
}

function DropdownMenuItem({
  variant = "default",
  asChild,
  onClick,
  children,
  ...props
}: any) {
  const handlePress = (e: any) => {
    if (onClick) {
      onClick(e);
    }
  };

  const id = props.id || props.value || (typeof children === "string" ? children : Math.random().toString());

  return (
    <Dropdown.Item
      id={id}
      variant={variant === "destructive" ? "danger" : "default"}
      onPress={handlePress}
      {...props}
    >
      {children}
    </Dropdown.Item>
  );
}

function DropdownMenuSub({ children, ...props }: any) {
  return <Dropdown.SubmenuTrigger {...props}>{children}</Dropdown.SubmenuTrigger>;
}

function DropdownMenuSubTrigger({
  children,
  ...props
}: any) {
  return (
    <Dropdown.Item
      id={props.id || Math.random().toString()}
      {...props}
    >
      {children}
      <Dropdown.SubmenuIndicator className="ml-auto">
        <ChevronRightIcon className="size-3.5 text-muted" />
      </Dropdown.SubmenuIndicator>
    </Dropdown.Item>
  );
}

function DropdownMenuSubContent({ children, ...props }: any) {
  return (
    <Dropdown.Popover {...props}>
      <Dropdown.Menu className="outline-none">
        {children}
      </Dropdown.Menu>
    </Dropdown.Popover>
  );
}

function DropdownMenuCheckboxItem({
  children,
  checked,
  ...props
}: any) {
  return (
    <Dropdown.Item
      id={props.id || Math.random().toString()}
      {...props}
    >
      {children}
      {checked && <Dropdown.ItemIndicator className="ml-auto" />}
    </Dropdown.Item>
  );
}

function DropdownMenuRadioGroup({ children, ...props }: any) {
  return <div {...props}>{children}</div>;
}

function DropdownMenuRadioItem({
  children,
  checked,
  ...props
}: any) {
  return (
    <Dropdown.Item
      id={props.id || Math.random().toString()}
      {...props}
    >
      {children}
      {checked && <Dropdown.ItemIndicator className="ml-auto" />}
    </Dropdown.Item>
  );
}

function DropdownMenuSeparator({ className, ...props }: any) {
  return <div className="h-px bg-border -mx-1 my-1" {...props} />;
}

function DropdownMenuShortcut({ className, ...props }: any) {
  return <span className="ml-auto text-xs tracking-widest text-muted" {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
