# ADR-0009: ThumbnailDirector + Creator Profile

**Status:** Aceito
**Data:** 2026-04-18
**Decisor:** Alexandre

## Contexto

Criadores de conteúdo precisam de thumbnails consistentes com a
identidade visual do canal. O sistema já tem Directors especializados
(Scene, Image, Lyrics) mas nenhum focado em thumbnails.

Além disso, o fluxo do Creators (YouTube/TikTok/Instagram) precisa
de um espaço onde o criador configure seu perfil de canal — estilo
visual, referências, branding — que alimenta tanto o ThumbnailDirector
quanto o Spielberg nas sugestões de conteúdo.

## Decisão

### 1. ThumbnailDirector como módulo especializado

Seguindo o padrão Uncle Bob dos Directors existentes:

```
src/modules/prompts/
  composers/thumbnailDirector.ts     ← resolve system prompt
  
src/modules/prompts/usecases/
  seedDefaultTemplates.ts            ← inclui template 'thumbnail_director'

src/app/api/thumbnail-director/
  route.ts                           ← POST: gera prompt de thumbnail
```

O ThumbnailDirector recebe:
- Título do vídeo
- Nicho/categoria
- Público-alvo
- Referências visuais do canal (thumbnails anteriores do criador)
- (opcional) Benchmarks do nicho (top thumbnails via YouTube API)
- Style Profile do workspace (clay, anime, etc)

Retorna:
- Prompt otimizado pra gerar thumbnail (Nano Banana/Flux)
- Em 16:9 (1280x720)
- Com direção específica: expressão facial, texto overlay, cores, composição

### 2. Creator Profile (perfil de canal)

Cada creator pode ter N canais conectados. Cada canal tem:

```
CreatorChannel {
  id: string
  platform: 'youtube' | 'tiktok' | 'instagram'
  channelName: string
  channelUrl?: string
  subscriberCount?: number
  
  // Identidade visual
  referenceImages: string[]    ← thumbnails de referência (uploadados)
  brandColors?: string[]       ← cores dominantes (extraídas ou manuais)
  fontStyle?: string           ← estilo de tipografia (bold, script, etc)
  thumbnailStyle?: string      ← descrição do estilo ("close-up com texto grande")
  
  // Analytics (preenchido via YouTube API quando conectado)
  topVideos?: Array<{ title, views, thumbnailUrl }>
  avgRetention?: number
  
  // OAuth (quando conectado via API)
  accessToken?: string
  refreshToken?: string
  connectedAt?: string
}
```

Entidade vive em `src/modules/creators/` seguindo Clean Arch:
- `domain/CreatorChannel.ts`
- `ports/CreatorChannelRepository.ts`
- `infra/RedisCreatorChannelRepository.ts`
- `usecases/connectChannel.ts`, `uploadReference.ts`, etc.

### 3. Fluxo na UI

```
/creators
├── [escolha de plataforma]
├── [perfil do canal]         ← NOVO
│   ├── Info do canal (nome, URL, subs)
│   ├── Referências visuais (upload de thumbnails do estilo do canal)
│   ├── Cores da marca (picker ou extração automática)
│   └── Estilo de thumbnail (descrição ou seleção de exemplos)
├── [criar conteúdo]
│   ├── Briefing → Spielberg gera roteiro
│   ├── Thumbnail → ThumbnailDirector gera usando referências do canal
│   └── SEO → título + descrição + hashtags
└── [analytics] (futuro, via YouTube API)
```

### 4. ThumbnailDirector System Prompt (esboço)

```
Você é o ThumbnailDirector — especialista em criar thumbnails que
maximizam CTR (click-through rate) em plataformas de vídeo.

REGRAS UNIVERSAIS DE THUMBNAILS EFICAZES:
- Rosto humano com emoção forte (surpresa, alegria, choque) aumenta CTR em 30-50%
- Máximo 3-5 palavras de texto, fonte bold sem serifa
- Contraste alto: fundo vs sujeito vs texto
- Composição em terço ou regra de Z (olho percorre esquerda→direita→baixo)
- Cores complementares ao vermelho do YouTube / preto do TikTok
- Resolução 1280x720 (16:9), sem bordas escuras
- Evitar: texto pequeno, imagens genéricas, muitos elementos

REFERÊNCIAS DO CRIADOR (quando disponíveis):
{referenceImages}
{brandColors}
{thumbnailStyle}

BENCHMARKS DO NICHO (quando disponíveis):
{topThumbnails}

Gere um prompt de imagem detalhado que produza uma thumbnail
profissional seguindo essas diretrizes.
```

## Consequências

### Positivas
- ThumbnailDirector segue mesma arquitetura dos outros Directors (DIP, PromptTemplate, seedável)
- Creator Profile centraliza identidade visual do canal — reusável por Spielberg, ThumbnailDirector, e futuro analytics
- Referências do canal garantem consistência visual entre vídeos
- Benchmarking de nicho traz inteligência competitiva

### Negativas
- Mais um módulo (`creators`) pra manter
- YouTube API tem quota limitada (10k units/dia) — precisa cache agressivo
- Upload de referências consome Blob storage

### Trade-offs
- Começar sem YouTube API (upload manual de refs) → adicionar API depois
- ThumbnailDirector funciona sem referências (usa só boas práticas universais) → melhora com referências
