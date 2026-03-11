"use client"

import React from "react"
import { BarChart3 } from "lucide-react"

interface ChartErrorBoundaryProps {
  children: React.ReactNode
}

interface ChartErrorBoundaryState {
  hasError: boolean
}

export class ChartErrorBoundary extends React.Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Chart rendering error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
          <BarChart3 className="h-8 w-8" />
          <p className="text-sm">Chart could not be rendered</p>
        </div>
      )
    }

    return this.props.children
  }
}
