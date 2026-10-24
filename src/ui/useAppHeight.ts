import { useEffect } from 'react'

/** Garde la hauteur de l'app alignée sur la zone réellement visible (clavier mobile ouvert). */
export function useAppHeight() {
  useEffect(() => {
    const vv = window.visualViewport
    const apply = () => {
      const h = vv?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-h', `${h}px`)
      if (vv && vv.offsetTop > 0) window.scrollTo(0, 0)
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
    }
  }, [])
}
