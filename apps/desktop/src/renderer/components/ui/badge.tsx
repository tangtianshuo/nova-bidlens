import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-sm)] border text-[11px] font-bold",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)] px-1.5 py-0.5",
        accent:
          "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] px-1.5 py-0.5",
        added:
          "bg-[var(--color-added-bg)] text-[var(--color-added)] border-[var(--color-added-border)] px-1.5 py-0.5",
        deleted:
          "bg-[var(--color-deleted-bg)] text-[var(--color-deleted)] border-[var(--color-deleted-border)] px-1.5 py-0.5",
        modified:
          "bg-[var(--color-modified-bg)] text-[var(--color-modified)] border-[var(--color-modified-border)] px-1.5 py-0.5",
        uncertain:
          "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border-[var(--color-border)] px-1.5 py-0.5",
        table:
          "bg-[var(--detector-table-bg)] text-[var(--detector-table)] border-[var(--color-border)] px-1.5 py-0.5",
        "risk-high":
          "bg-[var(--risk-high-bg)] text-[var(--risk-high)] border-[var(--risk-high-border)] px-1.5 py-0.5",
        "risk-medium":
          "bg-[var(--risk-medium-bg)] text-[var(--risk-medium)] border-[var(--risk-medium-border)] px-1.5 py-0.5",
        "risk-low":
          "bg-[var(--risk-low-bg)] text-[var(--risk-low)] border-[var(--risk-low-border)] px-1.5 py-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, className }))}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
