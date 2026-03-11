import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const middlewareSource = fs.readFileSync(
  path.resolve(__dirname, '../../middleware.ts'),
  'utf-8'
)

describe('security headers middleware', () => {
  it('sets X-Frame-Options to DENY', () => {
    expect(middlewareSource).toContain("'X-Frame-Options': 'DENY'")
  })

  it('sets X-Content-Type-Options to nosniff', () => {
    expect(middlewareSource).toContain("'X-Content-Type-Options': 'nosniff'")
  })

  it('sets Referrer-Policy', () => {
    expect(middlewareSource).toContain("'Referrer-Policy': 'strict-origin-when-cross-origin'")
  })

  it('sets X-XSS-Protection', () => {
    expect(middlewareSource).toContain("'X-XSS-Protection': '1; mode=block'")
  })

  it('sets Permissions-Policy to deny camera, mic, geolocation', () => {
    expect(middlewareSource).toContain("'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'")
  })

  it('sets Content-Security-Policy with default-src self', () => {
    expect(middlewareSource).toContain("default-src 'self'")
  })

  it('CSP allows unsafe-inline for scripts (needed for Next.js)', () => {
    expect(middlewareSource).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
  })

  it('CSP allows unsafe-inline for styles (needed for Tailwind)', () => {
    expect(middlewareSource).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('CSP blocks framing via frame-ancestors', () => {
    expect(middlewareSource).toContain("frame-ancestors 'none'")
  })

  it('excludes static assets from middleware matcher', () => {
    expect(middlewareSource).toContain('_next/static')
    expect(middlewareSource).toContain('_next/image')
    expect(middlewareSource).toContain('favicon.ico')
  })

  it('exports middleware function and config', () => {
    expect(middlewareSource).toContain('export function middleware')
    expect(middlewareSource).toContain('export const config')
  })
})
