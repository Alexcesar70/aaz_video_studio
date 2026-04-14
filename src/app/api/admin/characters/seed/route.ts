import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { seedAazLeadCharacters } from '@/modules/library'

/**
 * POST /api/admin/characters/seed
 *
 * Popula o Redis com os 7 AAZ Lead Characters como records `Asset`
 * no organizationId='aaz-com-jesus'.
 *
 * IDEMPOTENTE:
 *   - strategy=skip (default): não sobrescreve existentes.
 *   - strategy=update: sobrescreve preservando imageUrls já anexadas.
 *
 * As rotas de geração NÃO usam ainda esses registros — isso acontece
 * quando a flag USE_DB_ONLY_CHARACTERS for promovida. Antes dessa flag
 * ligar, `/api/assets` continua mesclando o const LEAD_CHARACTERS.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = requireSuperAdmin(request)

    const body = await request.json().catch(() => ({}))
    const strategy = body?.strategy === 'update' ? 'update' : 'skip'

    const results = await seedAazLeadCharacters({
      strategy,
      createdBy: admin.id,
    })

    const summary = {
      total: results.length,
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      skipped: results.filter((r) => r.action === 'skipped').length,
      strategy,
    }

    return NextResponse.json({ summary, results })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/admin/characters/seed]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
