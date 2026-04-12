import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import {
  type Asset,
  type AssetType,
  ASSET_PREFIX,
  DRAFT_PREFIX,
  DRAFT_TTL_SECONDS,
  isLeadId,
  slugify,
} from '@/lib/assets'
import { getAuthUser } from '@/lib/auth'
import { emitEvent } from '@/lib/activity'

/**
 * PATCH /api/assets/[id]?type=character  (type query obrigatório)
 *
 * Atualiza name, description, imageUrls, tags, emoji, id (rename).
 * Rename: se body.id vier diferente, o Redis key muda (del + set) e é
 * validado contra colisão. Leads podem ganhar imagens extras mas não
 * podem ser renomeados/deletados.
 *
 * Promover rascunho: se o asset atual estiver no namespace de drafts
 * e body.isDraft === false, migra pra o namespace principal.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const redis = await getRedis()
    const url = request.nextUrl
    const type = url.searchParams.get('type') as AssetType | null
    const isDraftSource = url.searchParams.get('draft') === '1'

    if (!type || !['character', 'scenario', 'item'].includes(type)) {
      return NextResponse.json({ error: 'type query inválido.' }, { status: 400 })
    }

    const updates = await request.json() as Partial<Asset>
    const sourcePrefix = isDraftSource ? DRAFT_PREFIX : ASSET_PREFIX
    const currentKey = `${sourcePrefix}${type}:${params.id}`

    const currentVal = await redis.get(currentKey)
    if (!currentVal) {
      // Se é um lead character, permitimos "editar" criando um override
      // no Redis (só pra acumular refs extras / tags)
      if (!isDraftSource && type === 'character' && isLeadId(params.id)) {
        const newAsset: Asset = {
          id: params.id,
          type: 'character',
          name: updates.name ?? '',
          description: updates.description ?? '',
          imageUrls: updates.imageUrls ?? [],
          isOfficial: true,
          tags: updates.tags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        await redis.set(currentKey, JSON.stringify(newAsset))
        return NextResponse.json({ ok: true, asset: newAsset })
      }
      return NextResponse.json({ error: 'Asset não encontrado.' }, { status: 404 })
    }

    const current = JSON.parse(currentVal) as Asset

    // Leads não podem mudar id, name core nem serem convertidos em custom
    const isLead = isLeadId(current.id) && current.type === 'character' && !isDraftSource
    if (isLead && (updates.id || updates.name)) {
      return NextResponse.json(
        { error: 'Personagens oficiais não podem ser renomeados.' },
        { status: 403 }
      )
    }

    // Rename (só pra customs e drafts)
    let newId = current.id
    if (updates.id && updates.id !== current.id && !isLead) {
      newId = slugify(updates.id)
      if (isLeadId(newId) && type === 'character') {
        return NextResponse.json(
          { error: `"${newId}" é um personagem oficial — escolha outro id.` },
          { status: 409 }
        )
      }
      // Checa colisão no namespace principal
      const collision = await redis.get(`${ASSET_PREFIX}${type}:${newId}`)
      if (collision) {
        return NextResponse.json(
          { error: `Já existe ${type} com id "${newId}".` },
          { status: 409 }
        )
      }
    }

    // Promover draft → asset
    const promoting = isDraftSource && updates.isDraft === false

    const updated: Asset = {
      ...current,
      ...updates,
      id: newId,
      type: current.type,
      isOfficial: current.isOfficial,
      isDraft: promoting ? undefined : current.isDraft,
      updatedAt: new Date().toISOString(),
    }

    // Decide onde vai gravar
    const targetPrefix = promoting ? ASSET_PREFIX : sourcePrefix
    const targetKey = `${targetPrefix}${type}:${newId}`

    // Se mudou key (rename ou promoção), deleta a antiga
    if (targetKey !== currentKey) {
      await redis.del(currentKey)
    }

    if (targetPrefix === DRAFT_PREFIX) {
      await redis.set(targetKey, JSON.stringify(updated), { EX: DRAFT_TTL_SECONDS })
    } else {
      await redis.set(targetKey, JSON.stringify(updated))
    }

    // Emit event só quando promove draft → asset
    if (promoting) {
      const authUser = getAuthUser(request)
      if (authUser) {
        emitEvent({
          userId: authUser.id,
          userName: authUser.name,
          userEmail: authUser.email,
          userRole: authUser.role,
          organizationId: authUser.organizationId,
          type: 'asset_promoted',
          meta: {
            assetId: newId,
            assetType: type,
            label: updated.name,
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, asset: updated })
  } catch (err) {
    console.error('[/api/assets PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar asset.' }, { status: 500 })
  }
}

/**
 * DELETE /api/assets/[id]?type=character  (type query obrigatório)
 * ?draft=1 pra deletar rascunho.
 *
 * Leads oficiais NUNCA podem ser deletados (retorna 403).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const redis = await getRedis()
    const url = request.nextUrl
    const type = url.searchParams.get('type') as AssetType | null
    const isDraftSource = url.searchParams.get('draft') === '1'

    if (!type || !['character', 'scenario', 'item'].includes(type)) {
      return NextResponse.json({ error: 'type query inválido.' }, { status: 400 })
    }

    // Bloqueia delete de leads oficiais (só o override no Redis pode sumir,
    // o lead em si está hardcoded em LEAD_CHARACTERS)
    if (!isDraftSource && type === 'character' && isLeadId(params.id)) {
      // Permite apagar o override (refs extras), mas o lead continua existindo
      const key = `${ASSET_PREFIX}character:${params.id}`
      await redis.del(key)
      return NextResponse.json({
        ok: true,
        note: 'Override removido. Lead oficial continua disponível com aparência canônica.'
      })
    }

    const prefix = isDraftSource ? DRAFT_PREFIX : ASSET_PREFIX
    const key = `${prefix}${type}:${params.id}`

    // Carrega antes pra emitir evento com label
    let deletedName: string | undefined
    try {
      const val = await redis.get(key)
      if (val) deletedName = (JSON.parse(val) as Asset).name
    } catch {}

    await redis.del(key)

    const authUser = getAuthUser(request)
    if (authUser && !isDraftSource) {
      emitEvent({
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        organizationId: authUser.organizationId,
        type: 'asset_deleted',
        meta: {
          assetId: params.id,
          assetType: type,
          label: deletedName,
        },
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/assets DELETE]', err)
    return NextResponse.json({ error: 'Erro ao deletar asset.' }, { status: 500 })
  }
}
