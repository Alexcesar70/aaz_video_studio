'use client'

import { useEffect, useState } from 'react'

/**
 * Decide se o intro do workspace deve ser exibido nesta sessão.
 *
 * Contrato:
 * - Uma vez por sessão (per-tab) — usa `sessionStorage`
 * - `sessionStorage` expira quando a aba fecha ou o user desloga
 * - Cada login novo vê o intro uma vez
 *
 * Uso:
 *   const { show, markShown } = useSessionIntro()
 *   return show ? <BearIntro onDone={markShown} /> : null
 */

const SESSION_KEY = 'bear-intro-shown'

export function useSessionIntro(): {
  show: boolean
  markShown: () => void
} {
  // Default false no SSR — hydration assumira hidden até useEffect checar
  const [show, setShow] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const shown = sessionStorage.getItem(SESSION_KEY) === '1'
      setShow(!shown)
    } catch {
      // sessionStorage indisponível (ex: SSR, storage bloqueado) — não mostra
      setShow(false)
    }
    setHydrated(true)
  }, [])

  const markShown = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // silent — mesmo se falhar, escondemos o overlay
    }
    setShow(false)
  }

  return { show: hydrated && show, markShown }
}
