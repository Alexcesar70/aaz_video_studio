import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import {
  seedDefaultTemplates,
  RedisPromptTemplateRepository,
} from '@/modules/prompts'

/**
 * POST /api/admin/prompts/seed
 * Popula (ou atualiza) os prompt templates globais a partir das fontes
 * legadas em src/lib/*DirectorSystem.ts.
 *
 * IDEMPOTENTE: se os templates já existem e o content é idêntico, é no-op.
 * Se o content mudou, incrementa version.
 *
 * Pode ser executado a qualquer momento depois do deploy do PR #2.
 * As rotas de geração NÃO usam ainda esses templates — isso acontece no
 * PR #3 atrás da flag USE_DB_PROMPTS.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = requireSuperAdmin(request)

    const repo = new RedisPromptTemplateRepository()
    const results = await seedDefaultTemplates({
      repo,
      updatedBy: admin.id,
    })

    const summary = {
      total: results.length,
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      unchanged: results.filter((r) => r.action === 'unchanged').length,
    }

    return NextResponse.json({ summary, results })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/admin/prompts/seed]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
