/**
 * Composição do JobRunner de produção baseado em Inngest.
 *
 * Este é o "ponto de colagem" entre o módulo `jobs` (agnóstico de
 * infra) e o Inngest SDK (infra). Toda rota que precisa enfileirar um
 * job usa `createProductionJobRunner()`.
 */

import { InngestJobRunner } from '@/modules/jobs'
import { inngest } from './client'
import { eventNameForKind } from './events'

export function createProductionJobRunner(): InngestJobRunner {
  return new InngestJobRunner(inngest, eventNameForKind)
}
