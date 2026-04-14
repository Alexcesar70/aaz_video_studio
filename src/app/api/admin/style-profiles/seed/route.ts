import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import {
  seedDefaultStyleProfiles,
  RedisStyleProfileRepository,
} from '@/modules/library'

/**
 * POST /api/admin/style-profiles/seed
 *
 * Popula os 6 StyleProfiles globais (clay-massinha, 3d-stylized, anime,
 * cartoon-classic, cinematic-realism, motion-graphics).
 *
 * IDEMPOTENTE: action=unchanged quando conteúdo é idêntico. Se o texto
 * de um preset foi editado no código e redeployado, o seed detecta e
 * incrementa version.
 *
 * O preset clay-massinha é importado de AAZ_STYLE_BLOCK (legado) —
 * garantindo paridade com o comportamento atual do universo AAZ. Os
 * outros 5 são receitas novas.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = requireSuperAdmin(request)

    const repo = new RedisStyleProfileRepository()
    const results = await seedDefaultStyleProfiles({
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
    console.error('[POST /api/admin/style-profiles/seed]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
