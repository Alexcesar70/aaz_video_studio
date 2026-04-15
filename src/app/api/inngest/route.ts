/**
 * Webhook Inngest.
 *
 * O serviço do Inngest chama este endpoint para:
 *   - GET  → inspecionar funções registradas (sync do dashboard)
 *   - POST → invocar a execução de uma função (dispatch)
 *   - PUT  → registrar a app quando um novo deploy acontece
 *
 * Ref: https://www.inngest.com/docs/learn/serving-inngest-functions
 */

import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { inngestFunctions } from '@/inngest/functions'

// Inngest SDK requer Node runtime (usa crypto, buffer, etc.).
// Evita que o Next.js infira edge runtime em algum contexto.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...inngestFunctions],
})
