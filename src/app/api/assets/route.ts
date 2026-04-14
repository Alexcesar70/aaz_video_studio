import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import {
  type Asset,
  type AssetType,
  ASSET_PREFIX,
  DRAFT_PREFIX,
  DRAFT_TTL_SECONDS,
  LEAD_CHARACTERS,
  isLeadId,
  slugify,
} from '@/lib/assets'
import { getAuthUser } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { emitEvent } from '@/lib/activity'
import { isFeatureEnabled } from '@/lib/featureFlags'

/**
 * GET /api/assets
 * Lista todos os assets (leads + custom + drafts opcionalmente).
 *
 * Query params:
 *   ?type=character|scenario|item  — filtra por tipo
 *   ?drafts=1                       — inclui rascunhos
 *
 * Sempre retorna os LEAD_CHARACTERS (quando type=character ou sem filtro)
 * mesclados com os custom assets do Redis.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    const orgId = authUser?.organizationId

    const redis = await getRedis()
    const params = request.nextUrl.searchParams
    const type = params.get('type') as AssetType | null
    const includeDrafts = params.get('drafts') === '1'

    // ── Custom assets (promovidos) ──
    const pattern = type ? `${ASSET_PREFIX}${type}:*` : `${ASSET_PREFIX}*`
    const keys = await redis.keys(pattern)
    let customAssets: Asset[] = []
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) {
        try {
          customAssets.push(JSON.parse(val) as Asset)
        } catch {}
      }
    }

    // Multi-tenant filtering: users in an org see their org's data + legacy data
    if (orgId) {
      customAssets = customAssets.filter(
        a => a.organizationId === orgId || !a.organizationId
      )
    }

    // ── Drafts (opcional) ──
    let drafts: Asset[] = []
    if (includeDrafts) {
      const draftPattern = type ? `${DRAFT_PREFIX}${type}:*` : `${DRAFT_PREFIX}*`
      const draftKeys = await redis.keys(draftPattern)
      for (const key of draftKeys) {
        const val = await redis.get(key)
        if (val) {
          try {
            drafts.push(JSON.parse(val) as Asset)
          } catch {}
        }
      }
      // Multi-tenant filtering for drafts too
      if (orgId) {
        drafts = drafts.filter(
          d => d.organizationId === orgId || !d.organizationId
        )
      }
    }

    // ── Assembling final list ──
    //
    // Feature flag USE_DB_ONLY_CHARACTERS (PR #4, ver ADR-0002):
    //   OFF (default): comportamento legado — mescla o const LEAD_CHARACTERS
    //     com customAssets, garantindo que usuários AAZ vejam os 7 leads
    //     mesmo se o seed do DB não rodou.
    //   ON: caminho novo, puramente DB, workspace-scoped. Assume que o
    //     POST /api/admin/characters/seed rodou na org aaz-com-jesus.
    //     Novos workspaces (universos diferentes) veem só seus próprios
    //     personagens, sem contaminação AAZ.
    //
    // Quando PR #9 consolidar, o caminho legado e o const LEAD_CHARACTERS
    // desaparecem e a flag é removida.
    const dbOnlyMode = isFeatureEnabled('USE_DB_ONLY_CHARACTERS', {
      userId: authUser?.id,
      workspaceId: orgId,
    })

    let all: Asset[]
    if (dbOnlyMode) {
      all = [...customAssets]
      all.sort((a, b) => {
        if (a.isOfficial && !b.isOfficial) return -1
        if (!a.isOfficial && b.isOfficial) return 1
        return (b.createdAt || '').localeCompare(a.createdAt || '')
      })
    } else {
      // ── Legacy merge ──
      let leads: Asset[] = []
      if (!type || type === 'character') {
        // Se algum lead tem refs salvas no Redis (via POST), mesclamos
        // as imageUrls — leads não são deletáveis mas podem ganhar refs extras.
        leads = LEAD_CHARACTERS.map(lead => {
          const override = customAssets.find(a => a.id === lead.id && a.type === 'character')
          if (override) {
            return {
              ...lead,
              imageUrls: [...lead.imageUrls, ...override.imageUrls],
              tags: override.tags ?? lead.tags,
            }
          }
          return lead
        })
      }

      // Remove do customAssets os que já foram mesclados com lead
      const leadIds = new Set(LEAD_CHARACTERS.map(c => c.id))
      const filteredCustoms = customAssets.filter(
        a => !(a.type === 'character' && leadIds.has(a.id))
      )

      all = [...leads, ...filteredCustoms]
      all.sort((a, b) => {
        // Leads primeiro, depois por data desc
        if (a.isOfficial && !b.isOfficial) return -1
        if (!a.isOfficial && b.isOfficial) return 1
        return (b.createdAt || '').localeCompare(a.createdAt || '')
      })
    }

    return NextResponse.json({ assets: all, drafts, source: dbOnlyMode ? 'db' : 'merge' })
  } catch (err) {
    console.error('[/api/assets GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar assets.' }, { status: 500 })
  }
}

/**
 * POST /api/assets
 * Cria um novo asset (custom ou rascunho).
 *
 * Body:
 *   { id?, type, name, description?, imageUrls[], prompt?, engineId?,
 *     sourceRefUrl?, isDraft?, emoji?, tags? }
 *
 * Se `id` não vier, gera um slug a partir do `name`. Valida unicidade:
 * se o slug colidir com um lead oficial, erro (leads são imutáveis).
 * Se colidir com outro custom, erro pra forçar o usuário a renomear.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Permission check ──
    const postAuth = getAuthUser(request)
    if (postAuth && !hasPermission(postAuth.permissions, postAuth.role, PERMISSIONS.MANAGE_ASSETS)) {
      return NextResponse.json({ error: 'Sem permissão para gerenciar assets.' }, { status: 403 })
    }

    const body = await request.json() as Partial<Asset>

    if (!body.type || !['character', 'scenario', 'item'].includes(body.type)) {
      return NextResponse.json({ error: 'type inválido (character|scenario|item).' }, { status: 400 })
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name é obrigatório.' }, { status: 400 })
    }
    if (!body.imageUrls?.length) {
      return NextResponse.json({ error: 'pelo menos 1 imageUrl é obrigatório.' }, { status: 400 })
    }

    const id = (body.id?.trim() || slugify(body.name)).toLowerCase()
    const isDraft = !!body.isDraft

    // Leads são imutáveis — bloqueia criação com id de lead (exceto drafts,
    // que ficam num namespace separado e não podem sobrescrever lead).
    if (isLeadId(id) && body.type === 'character' && !isDraft) {
      return NextResponse.json({
        error: `"${id}" é um personagem oficial — escolha outro id.`
      }, { status: 409 })
    }

    const redis = await getRedis()

    // Checa unicidade entre customs (não-drafts)
    if (!isDraft) {
      const existingKey = `${ASSET_PREFIX}${body.type}:${id}`
      const existing = await redis.get(existingKey)
      if (existing) {
        return NextResponse.json({
          error: `Já existe um ${body.type} com id "${id}". Escolha outro.`
        }, { status: 409 })
      }
    }

    const authUser = getAuthUser(request)
    const now = new Date().toISOString()
    const asset: Asset = {
      id,
      type: body.type,
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      imageUrls: body.imageUrls,
      prompt: body.prompt,
      engineId: body.engineId,
      sourceRefUrl: body.sourceRefUrl,
      isOfficial: false,
      isDraft: isDraft || undefined,
      emoji: body.emoji,
      tags: body.tags,
      createdBy: authUser?.id,
      // Multi-tenant: stamp organizationId on creation
      organizationId: authUser?.organizationId,
      createdAt: now,
      updatedAt: now,
    }

    const prefix = isDraft ? DRAFT_PREFIX : ASSET_PREFIX
    // Drafts têm id único por timestamp+random pra evitar colisão entre
    // variações da mesma geração
    const storageId = isDraft
      ? `${id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      : id
    const key = `${prefix}${body.type}:${storageId}`

    if (isDraft) {
      await redis.set(key, JSON.stringify({ ...asset, id: storageId }), { EX: DRAFT_TTL_SECONDS })
    } else {
      await redis.set(key, JSON.stringify(asset))
    }

    // Activity event — só pra não-drafts (draft é ruído)
    if (authUser && !isDraft) {
      emitEvent({
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        organizationId: authUser.organizationId,
        type: 'asset_saved',
        meta: {
          assetId: storageId,
          assetType: body.type,
          label: body.name,
          engineId: body.engineId,
        },
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, asset: { ...asset, id: storageId } })
  } catch (err) {
    console.error('[/api/assets POST]', err)
    return NextResponse.json({ error: 'Erro ao criar asset.' }, { status: 500 })
  }
}
