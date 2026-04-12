import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    version: '2.1',
    buildTime: '2026-04-12T05:30:00Z',
    commit: '0ae54c4',
    features: ['real-cost-tracking', 'admin-badges'],
  })
}
