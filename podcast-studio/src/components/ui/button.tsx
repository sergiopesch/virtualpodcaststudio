import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "gradient-primary text-white shadow-md hover:shadow-lg hover:scale-105 focus-visible:ring-primary/30",
        destructive:
          "bg-red-600 text-white shadow-md hover:bg-red-700 hover:shadow-lg focus-visible:ring-red-500/30",
        outline:
          "border border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-gray-50 hover:border-gray-400 focus-visible:ring-primary/30",
        secondary:
          "bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200 focus-visible:ring-gray-500/30",
        ghost:
          "hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-500/30",
        link: 
          "text-primary underline-offset-4 hover:underline focus-visible:ring-primary/30",
        gradient:
          "gradient-primary text-white shadow-md hover:shadow-lg hover:scale-105 focus-visible:ring-primary/30",
        glass:
          "glass text-gray-900 shadow-sm hover:shadow-md focus-visible:ring-primary/30",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        xs: "h-6 px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
