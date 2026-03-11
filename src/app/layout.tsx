import type { Metadata } from "next"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { ToastProvider } from "@/components/toast-provider"
import { ErrorBoundary } from "@/components/error-boundary"

export const metadata: Metadata = {
  title: "CashFlow - Personal Finance",
  description: "Local-first personal finance management",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <Sidebar />
        <main id="main-content" className="md:ml-64 min-h-screen">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
        <ToastProvider />
      </body>
    </html>
  )
}
