import { describe, expect, it } from 'vitest'
import sw from '../../../../public/sw.js?raw'

describe('service worker API cache policy', () => {
  it('uses bumped cache versions', () => {
    expect(sw).toContain("const CACHE = 'tj-v3-v13'")
    expect(sw).toContain("const API_CACHE = 'tj-v3-api-v4'")
  })

  it('does not use stale-while-revalidate for financial API GETs', () => {
    expect(sw).not.toContain('staleWhileRevalidate')
    expect(sw).toContain("url.pathname.startsWith('/api/v1/')")
    expect(sw).toContain('e.respondWith(networkFirstApi(req))')
  })

  it('does not cache non-GET API mutations', () => {
    expect(sw).toContain("if (req.method !== 'GET') return")
  })

  it('does not cache auth API forever', () => {
    expect(sw).toContain('API_CACHE_MAX_AGE_MS')
    expect(sw).toContain("url.pathname.startsWith('/api/v1/auth')")
    expect(sw).toContain('freshCachedApiResponse')
  })

  it('keys API cache by auth hash to avoid cross-user fallback data', () => {
    expect(sw).toContain('__tj_auth')
    expect(sw).toContain("req.headers.get('Authorization')")
    expect(sw).toContain("crypto.subtle.digest('SHA-256'")
  })
})
