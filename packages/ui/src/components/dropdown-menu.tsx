"use client"

import * as React from "react"
import { Dropdown, Header, Separator } from "@heroui/react"
import { ChevronRightIcon } from "lucide-react"
import { cn } from "@mantainer-system/ui/lib/utils"

/**
 * Adaptador con la API de shadcn/Radix sobre el `Dropdown` de HeroUI v3.
 *
 * IMPORTANTE: `Dropdown.Menu` es una *colección* de react-aria. Sus hijos se
 * renderizan primero contra un documento simulado que solo entiende componentes
 * de colección (`Item`, `Section`, `Header`, `Separator`). Si se cuela un `<div>`,
 * un `<span>` o texto suelto, react-dom intenta crear nodos reales dentro de ese
 * documento falso y revienta con "createTextNode is not a function".
 *
 * Por eso cada pieza de este archivo mapea a un componente de colección real y
 * NUNCA a un elemento DOM plano.
 */

function DropdownMenu({ open, onOpenChange, defaultOpen, children, ...props }: any) {
  return (
    <Dropdown
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      {...props}
    >
      {children}
    </Dropdown>
  );
}

/**
 * `Dropdown.Trigger` ya es un `Button` de react-aria: es quien ancla el popover
 * y abre el menú. Con `asChild` no podemos anidar el `<button>` del consumidor
 * dentro de otro `<button>`, así que absorbemos su `className` y su contenido.
 */
function DropdownMenuTrigger({ children, asChild, className, ...props }: any) {
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<any>;
    const { className: childClassName, children: childChildren, ...childProps } = child.props;

    return (
      <Dropdown.Trigger className={cn(childClassName, className)} {...childProps} {...props}>
        {childChildren}
      </Dropdown.Trigger>
    );
  }

  return (
    <Dropdown.Trigger className={className} {...props}>
      {children}
    </Dropdown.Trigger>
  );
}

function DropdownMenuPortal({ children }: any) {
  return <>{children}</>;
}

function DropdownMenuContent({ children, className, ...props }: any) {
  return (
    <Dropdown.Popover className={className} {...props}>
      <Dropdown.Menu className="outline-none">{children}</Dropdown.Menu>
    </Dropdown.Popover>
  );
}

function DropdownMenuGroup({ children, ...props }: any) {
  return <Dropdown.Section {...props}>{children}</Dropdown.Section>;
}

function DropdownMenuLabel({ className, ...props }: any) {
  return <Header className={cn("px-2 py-1.5 text-xs font-semibold text-muted", className)} {...props} />;
}

/**
 * Los `id` de una colección deben ser estables entre renders: con
 * `Math.random()` react-aria reconstruía la colección en cada render y perdía
 * foco/selección.
 */
function useItemId(explicitId?: string) {
  const generatedId = React.useId();
  return explicitId ?? generatedId;
}

function DropdownMenuItem({
  variant = "default",
  asChild: _asChild,
  onClick,
  onSelect,
  children,
  id,
  ...props
}: any) {
  const itemId = useItemId(id);

  return (
    <Dropdown.Item
      id={itemId}
      variant={variant === "destructive" ? "danger" : "default"}
      onAction={() => {
        onClick?.();
        onSelect?.();
      }}
      {...props}
    >
      {children}
    </Dropdown.Item>
  );
}

function DropdownMenuSub({ children, ...props }: any) {
  return <Dropdown.SubmenuTrigger {...props}>{children}</Dropdown.SubmenuTrigger>;
}

function DropdownMenuSubTrigger({ children, id, ...props }: any) {
  const itemId = useItemId(id);

  return (
    <Dropdown.Item id={itemId} {...props}>
      {children}
      <Dropdown.SubmenuIndicator className="ml-auto">
        <ChevronRightIcon className="size-3.5 text-muted" />
      </Dropdown.SubmenuIndicator>
    </Dropdown.Item>
  );
}

function DropdownMenuSubContent({ children, className, ...props }: any) {
  return (
    <Dropdown.Popover className={className} {...props}>
      <Dropdown.Menu className="outline-none">{children}</Dropdown.Menu>
    </Dropdown.Popover>
  );
}

function DropdownMenuCheckboxItem({ children, checked, id, ...props }: any) {
  const itemId = useItemId(id);

  return (
    <Dropdown.Item id={itemId} {...props}>
      {children}
      {checked && <Dropdown.ItemIndicator className="ml-auto" />}
    </Dropdown.Item>
  );
}

function DropdownMenuRadioGroup({ children, ...props }: any) {
  return <Dropdown.Section {...props}>{children}</Dropdown.Section>;
}

function DropdownMenuRadioItem({ children, checked, id, ...props }: any) {
  const itemId = useItemId(id);

  return (
    <Dropdown.Item id={itemId} {...props}>
      {children}
      {checked && <Dropdown.ItemIndicator className="ml-auto" />}
    </Dropdown.Item>
  );
}

function DropdownMenuSeparator({ className, ...props }: any) {
  return <Separator className={cn("-mx-1 my-1", className)} {...props} />;
}

function DropdownMenuShortcut({ className, ...props }: any) {
  return <span className={cn("ml-auto text-xs tracking-widest text-muted", className)} {...props} />;
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
