import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 ease-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 active:scale-[0.96]",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black shadow-lg hover:shadow-xl hover:bg-gray-100 border border-transparent", // High contrast primary
        destructive:
          "bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30", // Classy destructive
        outline:
          "border border-white/20 bg-transparent text-white shadow-sm hover:bg-white/10 hover:border-white/30",
        secondary:
          "bg-white/10 text-white backdrop-blur-md border border-white/10 shadow-sm hover:bg-white/20", // Glassy secondary
        ghost:
          "hover:bg-white/10 text-white/80 hover:text-white",
        link:
          "text-white underline-offset-4 hover:underline",
        gradient:
          "bg-gradient-to-b from-white to-gray-300 text-black shadow-lg border border-white/20 hover:opacity-90", // Metallic look
        glass:
          "glass-button text-white shadow-glass-sm",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3 text-xs rounded-lg",
        lg: "h-14 px-8 text-base rounded-2xl",
        icon: "size-10 rounded-xl",
        xs: "h-7 px-2 text-xs rounded-md",
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
