/**
 * /api/admin/backfill/legacy-organization-id
 *
 * Endpoint super_admin-only que diagnóstica e corrige records legacy
 * do AAZ pré-refactor — aqueles criados ANTES de `POST /api/assets`,
 * `POST /api/projects`, etc começarem a carimbar `organizationId`
 * automaticamente (Phase 2 do multi-tenant).
 *
 * Esses records têm `!organizationId` e hoje "vazam" pra todos os
 * workspaces por causa do filter `r.organizationId === orgId ||
 * !r.organizationId` em /api/assets, /api/projects, /api/scenes,
 * /api/scenarios. O comentário do filter dizia "legacy data is
 * shared for backwards compat" — este endpoint fecha essa ponte.
 *
 * Métodos:
 *
 *   GET → dry-run / diagnose
 *     Lista contagem de órfãos (`!organizationId`) por prefix, com
 *     samples dos 3 primeiros ids de cada tipo pra inspeção.
 *
 *   POST { targetWorkspaceId, confirm: true } → execute
 *     Carimba TODOS os records órfãos com
 *     `organizationId: targetWorkspaceId` e atualiza `updatedAt` se
 *     o campo existir. Idempotente — records que já têm orgId são
 *     pulados.
 *
 * Prefixes processados:
 *   aaz:asset:*      — characters, scenarios, items (lib/assets.ts)
 *   aaz:draft:*      — drafts (lib/assets.ts, TTL)
 *   aaz:project:*    — projects
 *   aaz:ep:*         — episodes
 *   aaz:scene:*      — scenes (subkey `aaz:scene:{epId}:{sceneId}`)
 *   aaz:scenario:*   — cenários SenoideStudio (distinto de asset:scenario)
 *
 * Segurança:
 * - `requireSuperAdmin(request)` — gate igual aos outros endpoints admin.
 * - POST exige `confirm: true` explícito pra evitar clique acidental.
 * - Só ESCREVE em records com `!organizationId`. Nunca sobrescreve.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { getRedis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const PREFIXES = [
  'aaz:asset:',
  'aaz:char:',
  'aaz:draft:',
  'aaz:project:',
  'aaz:ep:',
  'aaz:scene:',
  'aaz:scenario:',
] as const

type Prefix = (typeof PREFIXES)[number]

interface OrphanDiagnostic {
  prefix: Prefix
  totalKeys: number
  orphanCount: number
  stampedCount: number
  invalidJsonCount: number
  sampleOrphanIds: string[] // primeiros 3 ids sem organizationId (pra inspeção)
}

interface BackfillResult {
  prefix: Prefix
  totalKeys: number
  updated: number
  skippedAlreadyStamped: number
  skippedInvalidJson: number
  errors: Array<{ key: string; error: string }>
}

async function scanPrefix(
  redis: Awaited<ReturnType<typeof getRedis>>,
  prefix: Prefix,
): Promise<OrphanDiagnostic> {
  const keys = await redis.keys(`${prefix}*`)
  let orphanCount = 0
  let stampedCount = 0
  let invalidJsonCount = 0
  const sampleOrphanIds: string[] = []

  for (const key of keys) {
    const raw = await redis.get(key)
    if (!raw) continue
    let obj: { organizationId?: string } | null = null
    try {
      obj = JSON.parse(raw) as { organizationId?: string }
    } catch {
      invalidJsonCount++
      continue
    }
    if (obj && typeof obj.organizationId === 'string' && obj.organizationId.length > 0) {
      stampedCount++
    } else {
      orphanCount++
      if (sampleOrphanIds.length < 3) {
        sampleOrphanIds.push(key)
      }
    }
  }

  return {
    prefix,
    totalKeys: keys.length,
    orphanCount,
    stampedCount,
    invalidJsonCount,
    sampleOrphanIds,
  }
}

async function backfillPrefix(
  redis: Awaited<ReturnType<typeof getRedis>>,
  prefix: Prefix,
  targetWorkspaceId: string,
): Promise<BackfillResult> {
  const keys = await redis.keys(`${prefix}*`)
  let updated = 0
  let skippedAlreadyStamped = 0
  let skippedInvalidJson = 0
  const errors: Array<{ key: string; error: string }> = []
  const now = new Date().toISOString()

  for (const key of keys) {
    try {
      const raw = await redis.get(key)
      if (!raw) continue
      let obj: Record<string, unknown> | null = null
      try {
        obj = JSON.parse(raw) as Record<string, unknown>
      } catch {
        skippedInvalidJson++
        continue
      }
      const current = obj.organizationId
      if (typeof current === 'string' && current.length > 0) {
        skippedAlreadyStamped++
        continue
      }
      obj.organizationId = targetWorkspaceId
      // Atualiza updatedAt só se o record já tinha esse campo (pra não
      // criar campo em records que não usam — ex: scenario entry simples).
      if ('updatedAt' in obj) {
        obj.updatedAt = now
      }
      await redis.set(key, JSON.stringify(obj))
      updated++
    } catch (err) {
      errors.push({
        key,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    prefix,
    totalKeys: keys.length,
    updated,
    skippedAlreadyStamped,
    skippedInvalidJson,
    errors,
  }
}

export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)
    const redis = await getRedis()

    const diagnostics: OrphanDiagnostic[] = []
    for (const prefix of PREFIXES) {
      diagnostics.push(await scanPrefix(redis, prefix))
    }

    const totals = diagnostics.reduce(
      (acc, d) => ({
        totalKeys: acc.totalKeys + d.totalKeys,
        orphanCount: acc.orphanCount + d.orphanCount,
        stampedCount: acc.stampedCount + d.stampedCount,
        invalidJsonCount: acc.invalidJsonCount + d.invalidJsonCount,
      }),
      { totalKeys: 0, orphanCount: 0, stampedCount: 0, invalidJsonCount: 0 },
    )

    return NextResponse.json({
      mode: 'dry-run',
      totals,
      byPrefix: diagnostics,
      hint:
        totals.orphanCount > 0
          ? `Há ${totals.orphanCount} records órfãos. Pra carimbar todos com aaz-com-jesus, chame POST com body: { "targetWorkspaceId": "aaz-com-jesus", "confirm": true }`
          : 'Nenhum record órfão encontrado. Nada a fazer.',
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[GET /api/admin/backfill/legacy-organization-id]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = requireSuperAdmin(request)
    const body = (await request.json().catch(() => ({}))) as {
      targetWorkspaceId?: string
      confirm?: boolean
    }

    if (!body.targetWorkspaceId || body.targetWorkspaceId.trim().length === 0) {
      return NextResponse.json(
        { error: 'targetWorkspaceId é obrigatório (ex: "aaz-com-jesus").' },
        { status: 400 },
      )
    }
    if (body.confirm !== true) {
      return NextResponse.json(
        {
          error:
            'confirm deve ser true pra executar. Rode GET primeiro pra ver o que será modificado.',
        },
        { status: 400 },
      )
    }

    const targetWorkspaceId = body.targetWorkspaceId.trim()
    const redis = await getRedis()
    const results: BackfillResult[] = []
    for (const prefix of PREFIXES) {
      results.push(await backfillPrefix(redis, prefix, targetWorkspaceId))
    }

    const totals = results.reduce(
      (acc, r) => ({
        totalKeys: acc.totalKeys + r.totalKeys,
        updated: acc.updated + r.updated,
        skippedAlreadyStamped: acc.skippedAlreadyStamped + r.skippedAlreadyStamped,
        skippedInvalidJson: acc.skippedInvalidJson + r.skippedInvalidJson,
        errors: acc.errors + r.errors.length,
      }),
      { totalKeys: 0, updated: 0, skippedAlreadyStamped: 0, skippedInvalidJson: 0, errors: 0 },
    )

    console.log(
      `[backfill/legacy-organization-id] by=${admin.id} target=${targetWorkspaceId} ` +
        `updated=${totals.updated} skipped=${totals.skippedAlreadyStamped} errors=${totals.errors}`,
    )

    return NextResponse.json({
      mode: 'execute',
      targetWorkspaceId,
      executedBy: admin.id,
      totals,
      byPrefix: results,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/admin/backfill/legacy-organization-id]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
