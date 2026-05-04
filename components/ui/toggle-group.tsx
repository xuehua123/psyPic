"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleGroupItemVariants = cva(
  "inline-flex h-7 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-2.5 text-[13px] font-medium transition-[color,background-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50 hover:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
        outline:
          "border border-transparent text-muted-foreground data-[state=on]:border-accent/30 data-[state=on]:bg-accent/10 data-[state=on]:text-accent"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

const ToggleGroupContext = React.createContext<{
  variant?: VariantProps<typeof toggleGroupItemVariants>["variant"];
}>({ variant: "default" });

function ToggleGroup({
  className,
  variant,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleGroupItemVariants>) {
  return (
    <ToggleGroupContext.Provider value={{ variant }}>
      <ToggleGroupPrimitive.Root
        data-slot="toggle-group"
        className={cn(
          "inline-flex h-9 w-full items-center justify-stretch gap-1 rounded-md border border-border bg-muted p-1",
          className
        )}
        {...props}
      >
        {children}
      </ToggleGroupPrimitive.Root>
    </ToggleGroupContext.Provider>
  );
}

function ToggleGroupItem({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleGroupItemVariants>) {
  const ctx = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        toggleGroupItemVariants({ variant: variant ?? ctx.variant }),
        className
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
