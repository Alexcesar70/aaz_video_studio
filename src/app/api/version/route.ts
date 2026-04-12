import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    version: '6.0',
    buildTime: '2026-04-12T18:00:00Z',
    features: [
      'real-cost-tracking', 'admin-badges', 'month-year-selector',
      'user-detail-modal', 'segmind-balance', 'claude-real-cost',
      'utilization-rate', 'monthly-projection', 'episode-costs',
      'multi-tenant', 'org-isolation', 'super-admin-console',
      'granular-permissions', 'wallet-integration', 'brl-conversion',
      'extrato-export', 'admin-link',
    ],
  })
}
