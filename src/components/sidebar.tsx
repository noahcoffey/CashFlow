"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  BarChart3,
  CheckSquare,
  Upload,
  Settings,
  Sparkles,
  CalendarClock,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/subscriptions", label: "Subscriptions", icon: CalendarClock },
  { href: "/reconcile", label: "Reconcile", icon: CheckSquare },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-emerald-500 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">
            CashFlow
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Personal Finance</p>
        </div>

        <nav className="flex-1 p-4 space-y-1" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          {mounted && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                  theme === "light"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
                aria-label="Light mode"
              >
                <Sun className="h-3.5 w-3.5" />
                Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                  theme === "dark"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
                aria-label="Dark mode"
              >
                <Moon className="h-3.5 w-3.5" />
                Dark
              </button>
              <button
                onClick={() => setTheme("system")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                  theme === "system"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
                aria-label="System theme"
              >
                <Monitor className="h-3.5 w-3.5" />
                Auto
              </button>
            </div>
          )}
          <div className="text-xs text-zinc-400 dark:text-zinc-600">Local-first. Your data stays yours.</div>
        </div>
      </aside>
    </>
  )
}
