import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../api'

// Logged-in customer for the mobile app and public scan page. consumer: undefined = loading, null = logged out
const ConsumerContext = createContext(null)

export function ConsumerProvider({ children }) {
  const [consumer, setConsumer] = useState(undefined)

  useEffect(() => {
    api.get('/app/auth/me').then((r) => setConsumer(r.data)).catch(() => setConsumer(null))
  }, [])

  const logout = useCallback(async () => {
    await api.post('/app/auth/logout').catch(() => {})
    setConsumer(null)
  }, [])

  return <ConsumerContext.Provider value={{ consumer, setConsumer, logout }}>{children}</ConsumerContext.Provider>
}

export const useConsumer = () => useContext(ConsumerContext)
