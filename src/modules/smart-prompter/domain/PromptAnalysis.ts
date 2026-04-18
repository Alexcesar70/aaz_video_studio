export interface PromptSuggestion {
  category: 'composition' | 'lighting' | 'movement' | 'emotion' | 'style' | 'technical'
  original: string
  refined: string
  reason: string
}

export interface PromptAnalysis {
  originalPrompt: string
  refinedPrompt: string
  suggestions: PromptSuggestion[]
  score: number
  summary: string
}
