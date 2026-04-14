import { test, expect } from '@playwright/test'
import { getAdminCredentials, login } from '../fixtures/auth'

/**
 * Smoke #2 — Studio page carrega
 * Valida que o front principal renderiza sem erro de runtime
 * depois do login.
 */
test.describe('smoke: studio', () => {
  test('página /studio carrega após login', async ({ page, request }) => {
    const creds = getAdminCredentials()
    test.skip(!creds, 'E2E_ADMIN_EMAIL/PASSWORD não configurados')

    await login(request, creds!)

    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    const res = await page.goto('/studio')
    expect(res?.ok()).toBe(true)

    // Aguarda o app render — qualquer elemento que hoje está no Studio.
    // Usamos um seletor tolerante para não quebrar por mudança cosmética.
    await page.waitForLoadState('networkidle')

    expect(errors, `runtime errors: ${errors.join('; ')}`).toHaveLength(0)
  })
})
