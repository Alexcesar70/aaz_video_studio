/**
 * GET /api/admin/feature-flags/status
 *
 * Endpoint de diagnóstico — retorna o estado RESOLVIDO de todas as
 * feature flags do sistema pro usuário autenticado (super_admin-only).
 *
 * Usa `resolveAllFlags()` de `src/lib/featureFlags.ts`, que aplica a
 * mesma precedência usada em runtime (`FF_{FLAG}=off` > `FF_{FLAG}_USERS`
 * > `FF_{FLAG}=on` > default OFF).
 *
 * Útil pra:
 *   - Validar rollout targetado: após setar `FF_USE_DB_PROMPTS_USERS=<id>`
 *     e redeployar, este endpoint confirma que a flag está `true` pro user
 *     logado SEM precisar gerar conteúdo (que custaria wallet).
 *   - Debug de split por workspace.
 *   - Reproduzir em prod o cenário exato que o usuário está vendo.
 *
 * Query params:
 *   ?workspace=<id>  — se presente, sobrescreve o workspaceId do user
 *                      (útil pra simular outro workspace).
 *
 * Response:
 *   {
 *     context: { userId, workspaceId, role },
 *     flags:   { USE_DB_PROMPTS: true, USE_STYLE_PROFILES: false, ... },
 *     env:     { FF_USE_DB_PROMPTS: null, FF_USE_DB_PROMPTS_USERS: "alex",
 *                ... }   // raw env vars, pra conferir digitação
 *   }
 *
 * Segurança: só lê env vars cujo nome começa com `FF_`. Não expõe segredos
 * (valores são só 'on'/'off' ou csv de IDs, públicos por natureza).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { resolveAllFlags } from '@/lib/featureFlags'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const admin = requireSuperAdmin(request)

    const url = request.nextUrl
    const workspaceOverride = url.searchParams.get('workspace') ?? undefined

    const context = {
      userId: admin.id,
      workspaceId: workspaceOverride ?? admin.workspaceId,
    }

    const flags = resolveAllFlags(context)

    // Raw env vars prefixadas com FF_ (pra debug de digitação)
    const envRaw: Record<string, string | null> = {}
    for (const key of Object.keys(process.env).sort()) {
      if (key.startsWith('FF_')) {
        envRaw[key] = process.env[key] ?? null
      }
    }

    return NextResponse.json({
      context: {
        userId: admin.id,
        workspaceId: admin.workspaceId ?? null,
        workspaceIdUsed: context.workspaceId ?? null,
        role: admin.role,
      },
      flags,
      env: envRaw,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[GET /api/admin/feature-flags/status]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
