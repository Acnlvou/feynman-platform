import { useId, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function useSessionDraft(dirty, onExpire) {
  const key = useId()
  const location = useLocation()
  const { registerDraft } = useAuth()
  const callback = useRef(onExpire)
  callback.current = onExpire
  useLayoutEffect(
    () => registerDraft(key, {
      dirty,
      location,
      onExpire: () => callback.current?.(),
    }),
    [key, dirty, location, registerDraft],
  )
}
