export type SpielbergMode = 'briefing' | 'scene' | 'review' | 'creators'

export interface SpielbergMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface CapturedVariable {
  key: string
  value: string
  source: 'user' | 'spielberg'
  category: 'hard' | 'soft'
}

export interface SpielbergConversation {
  id: string
  mode: SpielbergMode
  messages: SpielbergMessage[]
  variables: CapturedVariable[]
  context: Record<string, unknown>
  createdAt: string
}

export function createConversation(
  mode: SpielbergMode,
  context: Record<string, unknown> = {},
): SpielbergConversation {
  return {
    id: `conv_${Date.now()}`,
    mode,
    messages: [],
    variables: [],
    context,
    createdAt: new Date().toISOString(),
  }
}

export function addMessage(
  conversation: SpielbergConversation,
  role: 'user' | 'assistant',
  content: string,
): SpielbergConversation {
  return {
    ...conversation,
    messages: [
      ...conversation.messages,
      { role, content, timestamp: new Date().toISOString() },
    ],
  }
}

export function addVariables(
  conversation: SpielbergConversation,
  newVars: CapturedVariable[],
): SpielbergConversation {
  const existing = new Map(conversation.variables.map(v => [v.key, v]))
  for (const v of newVars) existing.set(v.key, v)
  return { ...conversation, variables: Array.from(existing.values()) }
}
