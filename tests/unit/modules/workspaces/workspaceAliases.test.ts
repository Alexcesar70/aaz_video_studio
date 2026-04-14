import { describe, it, expect, assertType } from 'vitest'
import type { Organization } from '@/lib/organizations'
import type { Workspace, WorkspaceStatus } from '@/modules/workspaces'

/**
 * PR #8 — Validação estática dos aliases de tipo.
 *
 * Os aliases são TYPE-ONLY: não há runtime. Esses "testes" servem como
 * gate de compilação — se alguém alterar a shape do Organization e
 * esquecer de rebasear Workspace, o TypeScript quebra aqui PRIMEIRO.
 */

describe('Workspace / Organization type aliases (ADR-0004)', () => {
  it('Workspace aceita qualquer Organization (shape idêntico)', () => {
    const org: Organization = {
      id: 'ws-1',
      slug: 'ws-1',
      name: 'Workspace Teste',
      plan: 'trial',
      status: 'active',
      ownerId: 'u1',
      type: 'individual',
      maxUsers: 1,
      walletId: 'wallet-1',
      products: ['aaz_studio'],
      leaderCanCreate: false,
      billingEmail: 'owner@example.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Assignable: Workspace = Organization
    const ws: Workspace = org
    expect(ws.id).toBe('ws-1')
    expect(ws.type).toBe('individual')
    expect(ws.maxUsers).toBe(1)

    // Assignable na direção oposta também
    const backToOrg: Organization = ws
    expect(backToOrg).toBe(org)
  })

  it('WorkspaceStatus é subconjunto dos OrgStatus legados', () => {
    const statuses: WorkspaceStatus[] = ['active', 'suspended', 'cancelled']
    expect(statuses).toHaveLength(3)

    // Type-level assertion (compila ou não compila)
    assertType<WorkspaceStatus>('active' as const)
    assertType<WorkspaceStatus>('suspended' as const)
  })

  it('re-exports CRUD do módulo têm shape esperado', async () => {
    // Garante que imports nomeados existem em runtime
    const mod = await import('@/modules/workspaces')
    expect(typeof mod.createWorkspace).toBe('function')
    expect(typeof mod.getWorkspaceById).toBe('function')
    expect(typeof mod.getWorkspaceBySlug).toBe('function')
    expect(typeof mod.listWorkspaces).toBe('function')
    expect(typeof mod.updateWorkspace).toBe('function')
    expect(typeof mod.suspendWorkspace).toBe('function')
    expect(typeof mod.reactivateWorkspace).toBe('function')
    expect(typeof mod.bootstrapDefaultWorkspace).toBe('function')
    expect(mod.DEFAULT_WORKSPACE_ID).toBe('aaz-com-jesus')
  })
})
