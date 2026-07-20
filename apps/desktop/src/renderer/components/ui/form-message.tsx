import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const formMessageVariants = cva("text-xs font-medium", {
  variants: {
    variant: {
      error: "text-[var(--color-deleted)]",
      description: "text-[var(--color-text-muted)]",
    },
  },
  defaultVariants: {
    variant: "error",
  },
})

export interface FormMessageProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof formMessageVariants> {}

const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, variant, ...props }, ref) => (
    <p
      ref={ref}
      role="alert"
      className={cn(formMessageVariants({ variant, className }))}
      {...props}
    />
  )
)
FormMessage.displayName = "FormMessage"

export { FormMessage, formMessageVariants }
