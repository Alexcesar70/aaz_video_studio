'use client'

import React, { useEffect, useRef } from 'react'

/**
 * Intro one-shot de 6s do Bear Studio. Overlay fullscreen sobre o app
 * (backdrop preto), renderiza a animação "Dust to Bear" do handoff de
 * design (fumaça que condensa num urso bravo e se dissipa).
 *
 * Adaptado do `Bear Dust Loop.html` (handoff) pra React puro, sem
 * dependências externas — canvas 2D + imagem PNG em `/bear-intro/`.
 *
 * Chama `onDone` quando a animação completa (ou quando o user clica
 * pra pular). Componente stateless quanto a visibilidade — controle
 * externo via `useSessionIntro`.
 */

const DURATION_MS = 6000
const FADE_OUT_MS = 450
const BEAR_IMAGE_SRC = '/bear-intro/bear_angry.png'

export interface BearIntroProps {
  onDone: () => void
}

export function BearIntro({ onDone }: BearIntroProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const fxCanvasRef = useRef<HTMLCanvasElement>(null)
  const samplerRef = useRef<HTMLCanvasElement>(null)
  const bearImgRef = useRef<HTMLImageElement>(null)
  const moonDiscRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cv = fxCanvasRef.current
    const sampler = samplerRef.current
    const bearImg = bearImgRef.current
    const moonDisc = moonDiscRef.current
    if (!cv || !sampler || !bearImg || !moonDisc) return

    const ctxMaybe = cv.getContext('2d')
    const sCtxMaybe = sampler.getContext('2d', { willReadFrequently: true })
    if (!ctxMaybe || !sCtxMaybe) return
    // Narrowing pra closures internas (classes capturam por referência)
    const ctx: CanvasRenderingContext2D = ctxMaybe
    const sCtx: CanvasRenderingContext2D = sCtxMaybe

    // ─── helpers de geometria ───────────────────────────────
    let W = 0, H = 0, dpr = 1
    const resize = () => {
      const r = cv.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = r.width * dpr
      cv.height = r.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      W = r.width
      H = r.height
    }
    resize()

    // ─── sample do bear em pontos atratores ─────────────────
    type Attractor = { nx: number; ny: number; weight: number; lum: number }
    let attractors: Attractor[] = []

    const sampleBear = () => {
      if (!bearImg.complete || bearImg.naturalWidth === 0) return
      const sw = sampler.width
      const sh = sampler.height
      sCtx.clearRect(0, 0, sw, sh)
      const imgW = sw * 0.78
      const imgH = sh * 0.78
      sCtx.drawImage(bearImg, (sw - imgW) / 2, (sh - imgH) / 2, imgW, imgH)
      const data = sCtx.getImageData(0, 0, sw, sh).data

      const next: Attractor[] = []
      const step = 2
      for (let y = 0; y < sh; y += step) {
        for (let x = 0; x < sw; x += step) {
          const i = (y * sw + x) * 4
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const lum = r * 0.299 + g * 0.587 + b * 0.114
          if (lum > 60) {
            const weight = Math.min(1, (lum - 60) / 180)
            next.push({ nx: x / sw, ny: y / sh, weight, lum })
          }
        }
      }
      // shuffle pra espalhar assignment dos particles
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[next[i], next[j]] = [next[j], next[i]]
      }
      attractors = next
    }

    const onResize = () => { resize(); sampleBear() }
    window.addEventListener('resize', onResize)

    if (bearImg.complete && bearImg.naturalWidth > 0) {
      sampleBear()
    } else {
      bearImg.addEventListener('load', sampleBear, { once: true })
    }

    // ─── partículas ─────────────────────────────────────────
    class Puff {
      x: number; y: number; birth: number
      vx: number; vy: number; r0: number
      lifespan: number; hue: number; lum: number
      alpha: number; drift: number
      constructor(x: number, y: number, birth: number, opts: { vx?: number; vy?: number } = {}) {
        this.x = x; this.y = y; this.birth = birth
        this.vx = (opts.vx ?? 0) + (Math.random() - 0.5) * 0.4
        this.vy = (opts.vy ?? -0.4) - Math.random() * 0.5
        this.r0 = 8 + Math.random() * 26
        this.lifespan = 2800 + Math.random() * 2400
        this.hue = 12 + Math.random() * 20
        this.lum = 42 + Math.random() * 22
        this.alpha = 0.22 + Math.random() * 0.3
        this.drift = Math.random() * Math.PI * 2
      }
      draw(now: number): boolean {
        const age = now - this.birth
        if (age < 0 || age > this.lifespan) return false
        const t = age / this.lifespan
        const x = this.x + this.vx * age * 0.05 + Math.sin(this.drift + age * 0.002) * 6
        const y = this.y + this.vy * age * 0.05 - age * age * 0.000008
        const r = this.r0 + age * 0.018
        const a = this.alpha * (1 - t) * Math.min(1, t * 8)
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, `hsla(${this.hue},88%,${this.lum}%,${a})`)
        g.addColorStop(0.5, `hsla(${this.hue},78%,${this.lum - 10}%,${a * 0.5})`)
        g.addColorStop(1, `hsla(${this.hue},65%,${this.lum - 20}%,0)`)
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        return true
      }
    }

    class Ember {
      x: number; y: number; birth: number
      vx: number; vy: number; r: number
      lifespan: number; alpha: number; hue: number; drift: number
      constructor(x: number, y: number, birth: number) {
        this.x = x; this.y = y; this.birth = birth
        this.vx = (Math.random() - 0.5) * 0.3
        this.vy = -0.15 - Math.random() * 0.5
        this.r = 0.8 + Math.random() * 1.6
        this.lifespan = 3000 + Math.random() * 3500
        this.alpha = 0.6 + Math.random() * 0.35
        this.hue = 18 + Math.random() * 24
        this.drift = Math.random() * Math.PI * 2
      }
      draw(now: number): boolean {
        const age = now - this.birth
        if (age < 0 || age > this.lifespan) return false
        const t = age / this.lifespan
        const x = this.x + this.vx * age * 0.05 + Math.sin(this.drift + age * 0.003) * 3
        const y = this.y + this.vy * age * 0.05
        const a = this.alpha * (1 - t)
        ctx.fillStyle = `hsla(${this.hue},92%,70%,${a})`
        ctx.beginPath(); ctx.arc(x, y, this.r, 0, Math.PI * 2); ctx.fill()
        return true
      }
    }

    type Phase = 'idle' | 'gather' | 'hold' | 'release'

    class FormParticle {
      x: number; y: number
      vx: number; vy: number
      target: Attractor | null
      r: number; alpha: number; hue: number; lum: number
      constructor() {
        this.x = W / 2 + (Math.random() - 0.5) * W * 0.8
        this.y = H / 2 + (Math.random() - 0.5) * H * 0.4 + H * 0.2
        this.vx = (Math.random() - 0.5) * 2
        this.vy = -1 - Math.random() * 2
        this.target = null
        this.r = 1.2 + Math.random() * 2.2
        this.alpha = 0
        this.hue = 16 + Math.random() * 18
        this.lum = 55 + Math.random() * 15
      }
      update(dt: number, phase: Phase) {
        if (phase === 'gather' && this.target) {
          const tx = this.target.nx * W
          const ty = this.target.ny * H
          const k = 0.003, damp = 0.92
          this.vx = this.vx * damp + (tx - this.x) * k * dt
          this.vy = this.vy * damp + (ty - this.y) * k * dt
          this.x += this.vx * dt * 0.05
          this.y += this.vy * dt * 0.05
        } else if (phase === 'hold' && this.target) {
          const tx = this.target.nx * W
          const ty = this.target.ny * H
          this.x += (tx - this.x) * 0.15 + (Math.random() - 0.5) * 0.4
          this.y += (ty - this.y) * 0.15 + (Math.random() - 0.5) * 0.4
        } else if (phase === 'release') {
          this.vx += (Math.random() - 0.5) * 0.15
          this.vy += -0.02 + (Math.random() - 0.5) * 0.1
          this.x += this.vx * dt * 0.05
          this.y += this.vy * dt * 0.05
        }
      }
      draw(targetAlpha: number) {
        const a = this.alpha = this.alpha + (targetAlpha - this.alpha) * 0.1
        if (a < 0.01) return
        const weight = this.target?.weight ?? 0.5
        const core = a * weight
        ctx.fillStyle = `hsla(${this.hue},92%,${this.lum}%,${core})`
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill()
        if (core > 0.2) {
          const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 4)
          g.addColorStop(0, `hsla(${this.hue},90%,${this.lum + 5}%,${core * 0.3})`)
          g.addColorStop(1, `hsla(${this.hue},80%,${this.lum}%,0)`)
          ctx.fillStyle = g
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 4, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    let puffs: Puff[] = []
    let embers: Ember[] = []
    const NUM_FORM = 900
    const formParticles: FormParticle[] = Array.from({ length: NUM_FORM }, () => new FormParticle())

    // ─── loop ───────────────────────────────────────────────
    const smooth = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)))
    const ease = (x: number) => x * x * (3 - 2 * x)

    const startAt = performance.now()
    let lastTime = startAt
    let releasedKick = false
    let rafId = 0

    const frame = () => {
      const now = performance.now()
      const dt = Math.min(now - lastTime, 50)
      lastTime = now

      const rawPos = (now - startAt) / DURATION_MS
      const cyclePos = Math.min(1, rawPos)

      if (attractors.length > 0 && !formParticles[0].target) {
        for (let i = 0; i < formParticles.length; i++) {
          formParticles[i].target = attractors[i % attractors.length]
        }
      }

      ctx.clearRect(0, 0, W, H)

      // moon (ember disc)
      {
        let scale, opacity, blur
        if (cyclePos < 0.12) {
          const t = ease(cyclePos / 0.12)
          scale = 0.6 + 0.4 * t; opacity = 0.9 * t; blur = 22 - 14 * t
        } else if (cyclePos < 0.45) {
          const t = (cyclePos - 0.12) / 0.33
          scale = 1.0 + 0.15 * t; opacity = 0.9 + 0.08 * t; blur = 8 - 2 * t
        } else if (cyclePos < 0.72) {
          const t = (cyclePos - 0.45) / 0.27
          scale = 1.15 + 0.2 * t; opacity = 0.98 - 0.25 * t; blur = 6 + 12 * t
        } else {
          const t = (cyclePos - 0.72) / 0.28
          scale = 1.35 + 0.5 * t; opacity = 0.73 * (1 - t); blur = 18 + 30 * t
        }
        moonDisc.style.transform = `scale(${scale})`
        moonDisc.style.opacity = String(opacity)
        moonDisc.style.filter = `blur(${blur}px)`
      }

      // bear image reveal
      let bearOp = 0
      if (cyclePos > 0.32 && cyclePos < 0.72) {
        const t = (cyclePos - 0.52) / 0.18
        bearOp = Math.exp(-t * t * 1.6) * 0.55
      }
      const bs = 1 + Math.sin(cyclePos * Math.PI * 6) * 0.003
      bearImg.style.opacity = String(bearOp)
      bearImg.style.transform = `scale(${bs})`

      // ambient puffs + embers
      const cx = W / 2, cy = H / 2
      const discR = Math.min(W, H) * 0.3

      let puffIntensity = 0
      if (cyclePos < 0.1) puffIntensity = (cyclePos / 0.1) * 0.8
      else if (cyclePos < 0.35) puffIntensity = 1.0
      else if (cyclePos < 0.70) puffIntensity = 0.55 + 0.4 * Math.sin(((cyclePos - 0.35) / 0.35) * Math.PI)
      else if (cyclePos < 0.90) puffIntensity = 1.1 - ((cyclePos - 0.70) / 0.2) * 1.1
      else puffIntensity = 0

      const nPuffs = Math.floor(32 * puffIntensity)
      const nEmbers = Math.floor(18 * puffIntensity)

      for (let i = 0; i < nPuffs; i++) {
        const angle = Math.random() * Math.PI * 2
        const rad = discR * (0.2 + Math.random() * 0.95)
        puffs.push(new Puff(
          cx + Math.cos(angle) * rad,
          cy + Math.sin(angle) * rad,
          now,
          { vx: Math.cos(angle) * 0.18, vy: -0.25 + Math.sin(angle) * 0.15 },
        ))
      }
      for (let i = 0; i < nEmbers; i++) {
        const angle = Math.random() * Math.PI * 2
        const rad = discR * (0.5 + Math.random() * 0.8)
        embers.push(new Ember(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad, now))
      }

      if (puffs.length > 4500) puffs = puffs.slice(-4500)
      if (embers.length > 3000) embers = embers.slice(-3000)

      puffs = puffs.filter(p => p.draw(now))
      embers = embers.filter(p => p.draw(now))

      // form particles
      let phase: Phase
      let targetAlpha: number
      if (cyclePos < 0.25) { phase = 'idle'; targetAlpha = 0 }
      else if (cyclePos < 0.45) { phase = 'gather'; targetAlpha = ease((cyclePos - 0.25) / 0.20) * 0.9 }
      else if (cyclePos < 0.62) { phase = 'hold'; targetAlpha = 0.95 }
      else if (cyclePos < 0.78) { phase = 'release'; targetAlpha = (1 - ease((cyclePos - 0.62) / 0.16)) * 0.9 }
      else { phase = 'idle'; targetAlpha = 0 }

      if (phase === 'release' && !releasedKick) {
        for (const p of formParticles) {
          if (p.target) {
            const tx = p.target.nx * W, ty = p.target.ny * H
            const dx = tx - cx, dy = ty - cy
            const mag = Math.sqrt(dx * dx + dy * dy) || 1
            p.vx = (dx / mag) * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2
            p.vy = (dy / mag) * (2 + Math.random() * 3) - 2 - Math.random() * 2
          }
        }
        releasedKick = true
      }

      for (const p of formParticles) {
        p.update(dt, phase)
        p.draw(targetAlpha)
      }

      if (rawPos < 1) {
        rafId = requestAnimationFrame(frame)
      }
    }
    rafId = requestAnimationFrame(frame)

    // Termina depois de DURATION + fade out
    const endTimer = window.setTimeout(() => {
      if (stageRef.current) stageRef.current.style.opacity = '0'
    }, DURATION_MS)
    const doneTimer = window.setTimeout(onDone, DURATION_MS + FADE_OUT_MS)

    // Permite pular — click ou Esc
    const skip = () => onDone()
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' || ev.key === 'Enter') skip() }
    window.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(endTimer)
      clearTimeout(doneTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [onDone])

  return (
    <div
      ref={stageRef}
      onClick={onDone}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        opacity: 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'relative',
        width: '100vmin', height: '100vmin',
        maxWidth: '100vw', maxHeight: '100vh',
      }}>
        {/* Moon ember disc */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1, pointerEvents: 'none',
        }}>
          <div
            ref={moonDiscRef}
            style={{
              width: '60%', aspectRatio: '1',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ff6a1f 0%, #c02f08 38%, rgba(60,10,3,0) 70%)',
              filter: 'blur(14px)',
              transform: 'scale(0.6)',
              opacity: 0,
              willChange: 'transform, opacity, filter',
              mixBlendMode: 'screen',
            }}
          />
        </div>

        {/* Bear image — reveal durante pico */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2, pointerEvents: 'none',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={bearImgRef}
            src={BEAR_IMAGE_SRC}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: '78%', height: '78%', objectFit: 'contain',
              opacity: 0,
              mixBlendMode: 'screen',
              filter: 'contrast(1.12) brightness(1.08) saturate(1.15)',
              willChange: 'opacity, filter, transform',
            }}
          />
        </div>

        {/* Canvas de partículas */}
        <canvas
          ref={fxCanvasRef}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            zIndex: 3,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />

        {/* Grain overlay */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            zIndex: 4,
            pointerEvents: 'none',
            opacity: 0.035,
            mixBlendMode: 'overlay',
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>\")",
          }}
        />

        {/* Sampler offscreen (non-visible) */}
        <canvas
          ref={samplerRef}
          width={180}
          height={180}
          style={{ display: 'none' }}
        />
      </div>

      {/* Hint de skip (só aparece depois de 1s pra não distrair) */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.2,
        textTransform: 'uppercase', fontFamily: 'inherit',
        animation: 'bear-intro-hint-fade 1.6s ease-in forwards',
        animationDelay: '1.6s', opacity: 0,
        pointerEvents: 'none',
      }}>
        click ou esc pra pular
      </div>

      <style>{`
        @keyframes bear-intro-hint-fade {
          to { opacity: 1 }
        }
      `}</style>
    </div>
  )
}
