import * as React from "react"
import { cn } from "@/lib/utils"

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = "Select"

export { Select }
