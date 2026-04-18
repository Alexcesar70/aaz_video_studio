import type { PromptAnalysis } from '../domain/PromptAnalysis'

export interface SmartPrompterDeps {
  callAI: (system: string, messages: { role: string; content: string }[]) => Promise<string>
}

export interface RefineInput {
  prompt: string
  engine?: string
  variables?: Record<string, string>
  styleProfile?: string
}

const SYSTEM = `You are the SmartPrompter — a specialist in refining video/image generation prompts.

Your job: take the user's prompt and make it BETTER for AI generation engines (Seedance, Kling, Flux, etc).

WHAT YOU DO:
1. Analyze the prompt for clarity, specificity, and visual direction
2. Add missing details: camera angle, lighting, movement, mood, composition
3. Fix common mistakes: vague descriptions, contradictions, missing subjects
4. Adapt to the engine's strengths (Seedance = motion, Flux = detail, etc)
5. Incorporate any provided variables (mood, palette, etc)

RULES:
- Keep the creator's INTENT intact — refine, don't rewrite
- Be specific: "warm golden hour side-lighting" not "nice lighting"
- Include motion cues for video: "slow dolly forward", "static wide shot"
- Return structured JSON

Respond ONLY with valid JSON:
{
  "refinedPrompt": "the improved prompt in English",
  "suggestions": [
    {
      "category": "lighting|composition|movement|emotion|style|technical",
      "original": "what was vague",
      "refined": "what you changed to",
      "reason": "why this is better"
    }
  ],
  "score": 85,
  "summary": "one-line summary of what was improved"
}`

export async function refinePrompt(
  deps: SmartPrompterDeps,
  input: RefineInput,
): Promise<PromptAnalysis> {
  const userMsg = [
    `Prompt to refine: "${input.prompt}"`,
    input.engine ? `Target engine: ${input.engine}` : '',
    input.styleProfile ? `Style profile: ${input.styleProfile}` : '',
    input.variables && Object.keys(input.variables).length > 0
      ? `Scene variables:\n${Object.entries(input.variables).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n')

  const reply = await deps.callAI(SYSTEM, [{ role: 'user', content: userMsg }])

  try {
    const match = reply.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : reply)
    return {
      originalPrompt: input.prompt,
      refinedPrompt: parsed.refinedPrompt ?? input.prompt,
      suggestions: parsed.suggestions ?? [],
      score: parsed.score ?? 50,
      summary: parsed.summary ?? '',
    }
  } catch {
    return {
      originalPrompt: input.prompt,
      refinedPrompt: input.prompt,
      suggestions: [],
      score: 50,
      summary: 'Não foi possível refinar.',
    }
  }
}
