import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const layoutSource = readFileSync(join(__dirname, '../../app/layout.tsx'), 'utf-8')
const sidebarSource = readFileSync(join(__dirname, '../../components/sidebar.tsx'), 'utf-8')
const themeProviderSource = readFileSync(join(__dirname, '../../components/theme-provider.tsx'), 'utf-8')
const toastProviderSource = readFileSync(join(__dirname, '../../components/toast-provider.tsx'), 'utf-8')
const globalsCss = readFileSync(join(__dirname, '../../app/globals.css'), 'utf-8')

describe('Theme provider setup', () => {
  it('ThemeProvider wraps next-themes with class attribute', () => {
    expect(themeProviderSource).toContain('attribute="class"')
    expect(themeProviderSource).toContain('defaultTheme="dark"')
    expect(themeProviderSource).toContain('enableSystem')
  })

  it('layout.tsx uses ThemeProvider', () => {
    expect(layoutSource).toContain('<ThemeProvider>')
    expect(layoutSource).toContain('import { ThemeProvider }')
  })

  it('layout.tsx does not hardcode dark class on html', () => {
    expect(layoutSource).not.toContain('className="dark"')
    expect(layoutSource).toContain('suppressHydrationWarning')
  })
})

describe('CSS supports both themes', () => {
  it('defines light mode variables as default', () => {
    expect(globalsCss).toContain('--color-background: #ffffff')
    expect(globalsCss).toContain('--color-foreground: #09090b')
  })

  it('defines dark mode variables in .dark class', () => {
    expect(globalsCss).toContain('.dark {')
    expect(globalsCss).toContain('--color-background: #09090b')
    expect(globalsCss).toContain('--color-foreground: #fafafa')
  })
})

describe('Sidebar theme toggle', () => {
  it('imports useTheme from next-themes', () => {
    expect(sidebarSource).toContain("import { useTheme } from \"next-themes\"")
  })

  it('has light, dark, and system theme buttons', () => {
    expect(sidebarSource).toContain('setTheme("light")')
    expect(sidebarSource).toContain('setTheme("dark")')
    expect(sidebarSource).toContain('setTheme("system")')
  })

  it('imports Sun, Moon, and Monitor icons', () => {
    expect(sidebarSource).toContain('Sun')
    expect(sidebarSource).toContain('Moon')
    expect(sidebarSource).toContain('Monitor')
  })

  it('uses dark: prefixes for theme-aware sidebar colors', () => {
    expect(sidebarSource).toContain('dark:bg-zinc-950')
    expect(sidebarSource).toContain('dark:border-zinc-800')
  })
})

describe('Toast provider is theme-aware', () => {
  it('uses resolvedTheme from next-themes', () => {
    expect(toastProviderSource).toContain('useTheme')
    expect(toastProviderSource).toContain('resolvedTheme')
  })

  it('does not hardcode dark theme', () => {
    expect(toastProviderSource).not.toContain('theme="dark"')
  })
})

describe('UI components support both themes', () => {
  const components = {
    card: readFileSync(join(__dirname, '../../components/ui/card.tsx'), 'utf-8'),
    input: readFileSync(join(__dirname, '../../components/ui/input.tsx'), 'utf-8'),
    select: readFileSync(join(__dirname, '../../components/ui/select.tsx'), 'utf-8'),
    dialog: readFileSync(join(__dirname, '../../components/ui/dialog.tsx'), 'utf-8'),
    button: readFileSync(join(__dirname, '../../components/ui/button.tsx'), 'utf-8'),
    badge: readFileSync(join(__dirname, '../../components/ui/badge.tsx'), 'utf-8'),
    skeleton: readFileSync(join(__dirname, '../../components/ui/skeleton.tsx'), 'utf-8'),
  }

  for (const [name, source] of Object.entries(components)) {
    it(`${name} uses dark: prefixes`, () => {
      expect(source).toContain('dark:')
    })
  }
})
