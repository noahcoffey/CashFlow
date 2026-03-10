import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  indicatorColor?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorColor, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative h-3 w-full overflow-hidden rounded-full bg-zinc-800", className)}
      {...props}
    >
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${Math.min(Math.max(value, 0), 100)}%`,
          backgroundColor: indicatorColor || (value > 90 ? '#EF4444' : value > 75 ? '#F59E0B' : '#22C55E'),
        }}
      />
    </div>
  )
)
Progress.displayName = "Progress"

export { Progress }
