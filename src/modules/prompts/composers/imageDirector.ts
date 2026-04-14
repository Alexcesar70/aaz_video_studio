import type { AssetType } from '@/lib/assets'
import { getMood } from '@/lib/moods'
import { AAZ_STYLE_BLOCK } from '@/lib/imageDirectorSystem'
import type { StyleProfileRepository } from '@/modules/library'
import { getStyleProfile } from '@/modules/library'

/**
 * Image Director composer — caminho novo (flag USE_STYLE_PROFILES).
 *
 * Diferente do legado (`getImageDirectorSystemPrompt`), este composer é
 * STYLE-AGNOSTIC: os guides (character/scenario/item) referenciam "o
 * style profile selecionado" em vez de hardcoded "clay aesthetic". A
 * mensagem técnica que orienta o Claude a reiterar o estilo vem do
 * próprio `StyleProfile.promptBlock`, não do guide.
 *
 * Quando o workspace usa `clay-massinha` (seed do AAZ), o output é
 * funcionalmente equivalente ao legado. Quando usa `anime`, o prompt
 * final orienta Claude a gerar anime consistente sem tropeçar em
 * "clay" hardcoded.
 *
 * Fallback: se o StyleProfile não for encontrado no DB (seed não
 * rodou), usa AAZ_STYLE_BLOCK como safety net — mantém funcionamento
 * do universo AAZ mesmo com o seed faltando.
 */

const CHARACTER_GUIDE_GENERIC = `For CHARACTERS:
- Full-body or 3/4 portrait, neutral pose, facing camera or slight 3/4
- White or very soft gradient studio background (no environment)
- Describe: age, build, skin tone, hair (color, texture, style), eyes, facial features, outfit (every piece, every color), footwear, any accessories
- The style profile's visual language MUST be reflected in surface treatment, palette, shading and framing
- Include a brief posture/attitude one-liner at end`

const SCENARIO_GUIDE_GENERIC = `For SCENARIOS / ENVIRONMENTS:
- Wide shot, no characters visible (unless explicitly requested)
- Describe: location type, time of day, key landmarks, sky, ground/terrain, vegetation, architectural elements, atmospheric detail (dust, mist, warm light)
- The style profile's visual language MUST be reflected in palette, rendering quality and atmosphere
- Lens feel: "cinematic wide shot, depth of field"`

const ITEM_GUIDE_GENERIC = `For ITEMS / PROPS:
- Centered product-shot composition
- Soft white/gradient background
- Object shown clearly, isometric or 3/4 angle
- Describe: object type, material, color, size cues, texture details, any ornamentation
- The style profile's visual language MUST be reflected in surface treatment and rendering`

const COMMON_RULES_GENERIC = `Rules:
1. The output is ONE single image prompt in English, 80-200 words.
2. ALWAYS close the prompt by reiterating the style profile's signature (texture, palette, rendering quality benchmark).
3. Describe visually — do not explain, do not use storytelling tone.
4. Do NOT include backstory, emotions as adjectives, or abstract concepts. Only what a camera can see.
5. If the creator's description is vague, fill in sensible defaults consistent with the style profile.`

export interface ResolvedImageDirectorSystem {
  prompt: string
  source: 'db' | 'fallback'
  version?: number
  slug: string
}

const DEFAULT_STYLE_PROFILE_SLUG = 'clay-massinha'

interface BuildParams {
  styleBlock: string
  assetType: AssetType
  moodId?: string | null
  styleProfileName?: string
}

/**
 * Pura. Sem I/O. Compõe o system prompt do Image Director.
 */
export function buildImageDirectorSystem(params: BuildParams): string {
  let guide: string = CHARACTER_GUIDE_GENERIC
  if (params.assetType === 'scenario') guide = SCENARIO_GUIDE_GENERIC
  else if (params.assetType === 'item') guide = ITEM_GUIDE_GENERIC

  const mood = getMood(params.moodId ?? undefined)
  const moodBlock = mood.imagePromptInjection
    ? `\nMANDATORY MOOD / LIGHTING — "${mood.shortLabel}" (${mood.narrative}):\n${mood.imagePromptInjection}\nThe mood MUST visibly affect lighting direction, palette, shadows and atmosphere in the final prompt. Integrate it naturally — do not tack it on at the end.\n`
    : ''

  const profileName = params.styleProfileName ?? 'the active style profile'

  return `You are the Image Director for a Creative Studio. You convert a creator's short description (in Portuguese or English) into a polished image generation prompt (in English) optimized for Nano Banana Pro / Flux / Imagen 3.

MANDATORY STYLE PROFILE — ${profileName}:
${params.styleBlock}
${moodBlock}
${guide}

${COMMON_RULES_GENERIC}

Return ONLY a raw JSON object with this exact shape:
{
  "prompt": "...",          // the image prompt in English
  "name_suggestion": "...", // short PT-BR name suggestion for the asset (2-4 words)
  "tags": ["...", "..."]    // 3-6 relevant search tags in PT-BR
}
No markdown, no code fences, no comments. Just the JSON object.`
}

/**
 * Resolve o system prompt completo do Image Director com fallback
 * transparente para o bloco de estilo legado.
 */
export async function resolveImageDirectorSystem(
  deps: { repo: StyleProfileRepository },
  params: {
    assetType: AssetType
    moodId?: string | null
    styleProfileSlug?: string
    workspaceId?: string | null
  },
): Promise<ResolvedImageDirectorSystem> {
  const slug = params.styleProfileSlug ?? DEFAULT_STYLE_PROFILE_SLUG

  const profile = await getStyleProfile(deps, {
    slug,
    workspaceId: params.workspaceId,
  })

  const styleBlock = profile?.promptBlock ?? AAZ_STYLE_BLOCK
  const styleProfileName = profile?.name
  const source: 'db' | 'fallback' = profile ? 'db' : 'fallback'

  const prompt = buildImageDirectorSystem({
    styleBlock,
    assetType: params.assetType,
    moodId: params.moodId,
    styleProfileName,
  })

  return {
    prompt,
    source,
    version: profile?.version,
    slug,
  }
}
