import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { useAction } from '../api'
import { TextField } from '../components/form'
import Icon from '../components/Icon'
import { Brand } from '../components/Layout'
import { Alert, Button } from '../components/ui'

const POINTS = [
  { icon: 'shieldCheck', title: 'Product verification', text: 'Customers confirm authenticity with a single scan.' },
  { icon: 'gift', title: 'Tiered cashback', text: 'Reward amounts are shuffled across codes at random.' },
  { icon: 'qr', title: 'Unguessable codes', text: 'Each QR has its own activation and expiry window.' },
]

export default function Login({ mode, onAuthed }) {
  const isLogin = mode === 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const submit = useAction(async () => {
    const res = await api.post(`/auth/${mode}`, { email, password })
    onAuthed(res.data)
    navigate('/', { replace: true })
  })

  return (
    <div className="auth">
      <aside className="auth-hero">
        <Brand />
        <div className="auth-hero-body">
          <h1>Every product verified.<br /><span>Every scan rewarded.</span></h1>
          <p>Run anti-counterfeit and cashback campaigns with secure QR codes, from product setup to the final scan.</p>
          <ul className="auth-points">
            {POINTS.map((p) => (
              <li key={p.title}>
                <Icon name={p.icon} size={20} />
                <div><b>{p.title}</b><span>{p.text}</span></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-hero-foot">© {new Date().getFullYear()} TrustScan</div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand /></div>
          <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted">{isLogin ? 'Sign in to manage your campaigns.' : 'Start running verified QR campaigns in minutes.'}</p>

          <div className="segmented">
            <Link to="/login" className={isLogin ? 'active' : ''} onClick={() => submit.setError('')}>Sign in</Link>
            <Link to="/register" className={!isLogin ? 'active' : ''} onClick={() => submit.setError('')}>Create account</Link>
          </div>

          <form className="stack" onSubmit={(e) => { e.preventDefault(); submit.run() }}>
            <Alert>{submit.error}</Alert>
            <TextField type="email" label="Email address" required autoFocus autoComplete="email" placeholder="you@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField type={showPassword ? 'text' : 'password'} label="Password" required minLength={6} placeholder="••••••••"
              autoComplete={isLogin ? 'current-password' : 'new-password'} hint={!isLogin && 'At least 6 characters'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              suffix={
                <button type="button" className="btn-icon" onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              } />
            <Button type="submit" size="lg" className="btn-block" loading={submit.loading}>
              {isLogin ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="auth-note"><Icon name="clock" size={14} /> You'll stay signed in on this device for 7 days.</p>
        </div>
      </main>
    </div>
  )
}
