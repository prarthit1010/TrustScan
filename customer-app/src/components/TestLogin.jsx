import { useState } from 'react'
import api, { useAction } from '../api'
import { TextField } from './form'
import Icon from './Icon'
import { Alert, Button } from './ui'

// TEMPORARY: see backend/src/testLogin.js for how to remove it
export default function TestLogin({ onLoggedIn }) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const submit = useAction(async () => {
    const res = await api.post('/app/auth/test-login', { id, password })
    onLoggedIn(res.data)
  })

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit.run() }}>
      <Alert>{submit.error}</Alert>
      <TextField label="Test ID" required autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} />
      <TextField label="Password" required type={showPassword ? 'text' : 'password'} autoComplete="current-password"
        value={password} onChange={(e) => setPassword(e.target.value)}
        suffix={
          <button type="button" className="btn-icon" onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}>
            <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
          </button>
        } />
      <Button type="submit" size="lg" className="btn-block" loading={submit.loading}>Log in</Button>
    </form>
  )
}
