/**
 * Lista de funções Inngest registradas.
 *
 * Toda função nova deve ser importada aqui e incluída no array
 * `inngestFunctions`. O handler /api/inngest usa esta lista para
 * expor ao dashboard do Inngest.
 */

import { videoGenerationJobFunction } from './videoGeneration'
import { sendNotificationEmailFunction } from './sendNotificationEmail'

export const inngestFunctions = [
  videoGenerationJobFunction,
  sendNotificationEmailFunction,
] as const
