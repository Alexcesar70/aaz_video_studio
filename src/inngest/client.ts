/**
 * Cliente Inngest singleton.
 *
 * Em produção, o `eventKey` e `signingKey` vêm das env vars INNGEST_EVENT_KEY
 * e INNGEST_SIGNING_KEY configuradas na Vercel. Em dev local, o Inngest dev
 * server (http://localhost:8288) captura tudo automaticamente sem chaves.
 *
 * Ref: https://www.inngest.com/docs/reference/client
 */

import { Inngest } from 'inngest'

export const INNGEST_APP_ID = 'aaz-studio'

export const inngest = new Inngest({
  id: INNGEST_APP_ID,
  // As chaves são lidas automaticamente do env pelo SDK:
  //   INNGEST_EVENT_KEY  — para autenticar o send()
  //   INNGEST_SIGNING_KEY — usado pelo handler /api/inngest para validar
})
