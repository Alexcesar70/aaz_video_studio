import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    version: '3.1',
    buildTime: '2026-04-12T10:00:00Z',
    features: ['real-cost-tracking', 'admin-badges', 'month-year-selector', 'user-detail-modal'],
  })
}
