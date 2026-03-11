import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

function readComponent(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../', relativePath), 'utf-8')
}

describe('Accessibility: ARIA attributes and semantic HTML', () => {
  describe('Sidebar', () => {
    const source = readComponent('components/sidebar.tsx')

    it('has aria-label on mobile toggle button', () => {
      expect(source).toContain('aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}')
    })

    it('has aria-expanded on mobile toggle button', () => {
      expect(source).toContain('aria-expanded={mobileOpen}')
    })

    it('has aria-label on nav element', () => {
      expect(source).toContain('aria-label="Main navigation"')
    })

    it('has aria-current on active nav links', () => {
      expect(source).toContain('aria-current={isActive ? "page" : undefined}')
    })

    it('has aria-hidden on nav icons', () => {
      expect(source).toContain('<item.icon className="h-4 w-4" aria-hidden="true" />')
    })
  })

  describe('Dialog', () => {
    const source = readComponent('components/ui/dialog.tsx')

    it('has aria-label on close button', () => {
      expect(source).toContain('aria-label="Close"')
    })

    it('has aria-hidden on close icon', () => {
      expect(source).toContain('aria-hidden="true"')
    })
  })

  describe('Progress', () => {
    const source = readComponent('components/ui/progress.tsx')

    it('has role="progressbar"', () => {
      expect(source).toContain('role="progressbar"')
    })

    it('has aria-valuenow', () => {
      expect(source).toContain('aria-valuenow={Math.round(clampedValue)}')
    })

    it('has aria-valuemin and aria-valuemax', () => {
      expect(source).toContain('aria-valuemin={0}')
      expect(source).toContain('aria-valuemax={100}')
    })
  })

  describe('Layout', () => {
    const source = readComponent('app/layout.tsx')

    it('has skip-to-content link', () => {
      expect(source).toContain('href="#main-content"')
      expect(source).toContain('Skip to main content')
    })

    it('has main-content id on main element', () => {
      expect(source).toContain('id="main-content"')
    })
  })

  describe('Settings page icon buttons', () => {
    const source = readComponent('app/settings/page.tsx')

    it('account edit buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Edit ${acc.name}`}')
    })

    it('account delete buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Delete ${acc.name}`}')
    })

    it('alias edit buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Edit ${alias.display_name}`}')
    })

    it('alias delete buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Delete ${alias.display_name}`}')
    })

    it('tag edit buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Edit ${tag.name}`}')
    })

    it('tag delete buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Delete ${tag.name}`}')
    })

    it('rule toggle buttons have aria-labels', () => {
      expect(source).toContain('aria-label={rule.is_active ? `Disable ${rule.name}` : `Enable ${rule.name}`}')
    })

    it('rule edit buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Edit ${rule.name}`}')
    })

    it('rule delete buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Delete ${rule.name}`}')
    })

    it('condition remove buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Remove condition ${i + 1}`}')
    })

    it('action remove buttons have aria-labels', () => {
      expect(source).toContain('aria-label={`Remove action ${i + 1}`}')
    })

    it('all icon-only buttons have aria-hidden on icons', () => {
      // Every Trash2 and Edit2 inside icon buttons should have aria-hidden
      const editIconMatches = source.match(/<Edit2[^/]*\/>/g) || []
      for (const match of editIconMatches) {
        expect(match).toContain('aria-hidden="true"')
      }
      const trashIconMatches = source.match(/<Trash2[^/]*\/>/g) || []
      for (const match of trashIconMatches) {
        expect(match).toContain('aria-hidden="true"')
      }
    })
  })
})
