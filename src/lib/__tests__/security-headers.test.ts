import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware, config } from '../../middleware'

describe('security headers middleware', () => {
  function callMiddleware(path: string) {
    const request = new NextRequest(new URL(path, 'http://localhost:3000'))
    return middleware(request)
  }

  it('sets X-Frame-Options to DENY', () => {
    const response = callMiddleware('/dashboard')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('sets X-Content-Type-Options to nosniff', () => {
    const response = callMiddleware('/dashboard')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('sets Referrer-Policy', () => {
    const response = callMiddleware('/dashboard')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('sets X-XSS-Protection', () => {
    const response = callMiddleware('/dashboard')
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
  })

  it('sets Permissions-Policy to deny camera, mic, geolocation', () => {
    const response = callMiddleware('/dashboard')
    expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()')
  })

  it('sets Content-Security-Policy with correct directives', () => {
    const response = callMiddleware('/dashboard')
    const csp = response.headers.get('Content-Security-Policy')!
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('applies headers to API routes', () => {
    const response = callMiddleware('/api/transactions')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
  })

  it('exports matcher that excludes static assets', () => {
    expect(config.matcher[0]).toContain('_next/static')
    expect(config.matcher[0]).toContain('_next/image')
    expect(config.matcher[0]).toContain('favicon.ico')
  })
})
