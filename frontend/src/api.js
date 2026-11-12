import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api', withCredentials: true })

// App registers this so an expired session anywhere sends the user back to login
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || ''
    if (err.response?.status === 401 && !url.startsWith('/auth/')) onUnauthorized()
    return Promise.reject(err)
  }
)

export const errMsg = (err) => err.response?.data?.error || err.message || 'Something went wrong'

export function useFetch(url) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const reload = useCallback(
    () => api.get(url).then((r) => { setData(r.data); setError('') }).catch((e) => setError(errMsg(e))),
    [url]
  )
  useEffect(() => { reload() }, [reload])
  return { data, error, reload }
}

// Wraps an async action with loading + error state
export function useAction(fn) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const run = async (...args) => {
    setLoading(true)
    setError('')
    try {
      await fn(...args)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }
  return { run, loading, error, setError }
}

export default api
