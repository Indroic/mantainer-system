"use client"

import * as React from "react"
import {
  ModalRoot,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalCloseTrigger
} from "@heroui/react"
import { cn } from "../lib/utils"

const DialogContext = React.createContext<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} | null>(null);

function Dialog({ open, onOpenChange, defaultOpen, children }: any) {
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
    open: isOpen,
    onOpenChange: handleOpenChange
  }), [isOpen, handleOpenChange]);

  return (
    <DialogContext.Provider value={value}>
      <ModalRoot isOpen={isOpen} onOpenChange={handleOpenChange}>
        {children}
      </ModalRoot>
    </DialogContext.Provider>
  );
}

function DialogTrigger({ children, asChild }: any) {
  const context = React.useContext(DialogContext);
  
  const handleOpen = () => {
    context?.onOpenChange?.(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, {
      onClick: (e: any) => {
        (children.props as any).onClick?.(e);
        handleOpen();
      }
    });
  }

  return (
    <button type="button" onClick={handleOpen}>
      {children}
    </button>
  );
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DialogOverlay() {
  return null;
}

function DialogClose({ children, asChild }: any) {
  const context = React.useContext(DialogContext);
  
  const handleClose = () => {
    context?.onOpenChange?.(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, {
      onClick: (e: any) => {
        (children.props as any).onClick?.(e);
        handleClose();
      }
    });
  }

  return (
    <button type="button" onClick={handleClose}>
      {children}
    </button>
  );
}

function DialogContent({ children, className, ...props }: any) {
  return (
    <ModalBackdrop className="bg-backdrop">
      <ModalContainer size="sm">
        <ModalDialog className={cn("bg-background border border-border text-foreground shadow-2xl p-6 relative rounded-2xl max-w-md", className)} {...props}>
          {children}
          <ModalCloseTrigger className="absolute top-4 right-4 text-muted hover:text-foreground p-1 rounded-lg" />
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
}

function DialogHeader({ className, ...props }: any) {
  return <div className={cn("flex flex-col gap-1 text-left pb-4", className)} {...props} />;
}

function DialogFooter({ className, ...props }: any) {
  return <div className={cn("flex justify-end gap-2 pt-4", className)} {...props} />;
}

function DialogTitle({ className, ...props }: any) {
  return <h3 className={cn("text-base font-semibold text-foreground", className)} {...props} />;
}

function DialogDescription({ className, ...props }: any) {
  return <p className={cn("text-xs text-muted mt-1", className)} {...props} />;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
export default Dialog;
