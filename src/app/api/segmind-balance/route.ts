import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getSegmindCredits } from '@/lib/segmind'

export const dynamic = 'force-dynamic'

/**
 * GET /api/segmind-balance
 * Returns the current Segmind account balance.
 * Requires authenticated admin user.
 */
export async function GET(request: NextRequest) {
  const user = getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const apiKey = process.env.SEGMIND_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SEGMIND_API_KEY not configured' },
      { status: 500 }
    )
  }

  const balance = await getSegmindCredits(apiKey)
  return NextResponse.json({ balance })
}
