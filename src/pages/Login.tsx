import { useState, type FormEvent } from 'react'
import { logIn } from '../lib/api'

interface Props {
  onLogin: (driver: { name: string; vehicleId: string; city: string; age: number }) => void
  onSignUp: () => void
}

type ErrorType = 'not_found' | 'wrong_password' | 'network' | null

export default function Login({ onLogin, onSignUp }: Props) {
  const [vehicleId, setVehicleId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorType, setErrorType] = useState<ErrorType>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [attempts, setAttempts] = useState(0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!vehicleId.trim() || !password) {
      setErrorType('network')
      setErrorMsg('Please enter both your Vehicle ID and password.')
      return
    }

    setLoading(true)
    setErrorType(null)
    setErrorMsg('')

    try {
      const driver = await logIn(vehicleId.trim(), password)
      onLogin({ name: driver.name, vehicleId: driver.vehicle_id, city: driver.city, age: driver.age })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setAttempts(a => a + 1)

      if (msg.includes('No account') || msg.includes('not found') || msg.includes('404')) {
        setErrorType('not_found')
        setErrorMsg(msg)
      } else if (msg.includes('Incorrect') || msg.includes('password') || msg.includes('401')) {
        setErrorType('wrong_password')
        setErrorMsg(msg)
      } else {
        setErrorType('network')
        setErrorMsg('Unable to reach the server. Check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const errorColor = errorType === 'not_found' ? '#00B8D9' : '#FF3D00'
  const errorBg = errorType === 'not_found' ? 'rgba(0,184,217,0.07)' : 'rgba(255,61,0,0.07)'
  const errorBorder = errorType === 'not_found' ? 'rgba(0,184,217,0.3)' : 'rgba(255,61,0,0.3)'

  return (
    <div style={{
      minHeight: '100vh', background: '#05080D',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      <div className="circuit-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '20%', left: '15%', width: '320px', height: '320px', background: 'radial-gradient(circle, rgba(0,230,118,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(0,184,217,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="oled-card animate-slide-up" style={{ width: '100%', maxWidth: '420px', padding: '40px 36px', position: 'relative' }}>
        <div className="scan-overlay" />

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '36px' }}>
          <div className="animate-float" style={{ marginBottom: '16px' }}>
            <BatteryLogo />
          </div>
          <div className="font-display shimmer-text" style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '0.1em' }}>TUKBMS</div>
          <div style={{ color: '#5A7A94', fontSize: '11px', letterSpacing: '0.25em', marginTop: '4px', fontFamily: 'Exo 2' }}>BATTERY MANAGEMENT SYSTEM</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>VEHICLE ID</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="oled-input"
                placeholder="e.g. TUK-GP-2847"
                value={vehicleId}
                onChange={e => setVehicleId(e.target.value)}
                style={{ paddingLeft: '42px', textTransform: 'uppercase', fontFamily: 'JetBrains Mono', letterSpacing: '0.05em' }}
                autoComplete="username"
              />
              <VehicleIcon />
            </div>
          </div>

          <div>
            <label style={labelStyle}>PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="oled-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '42px' }}
                autoComplete="current-password"
              />
              <LockIcon />
            </div>
          </div>

          {/* Error message */}
          {errorType && (
            <div style={{ background: errorBg, border: `1px solid ${errorBorder}`, borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>
                  {errorType === 'not_found' ? 'ℹ️' : '⚠️'}
                </span>
                <div>
                  <div style={{ color: errorColor, fontSize: '13px', fontWeight: '600', fontFamily: 'Exo 2', marginBottom: '3px' }}>
                    {errorType === 'not_found' ? 'Account Not Found' : errorType === 'wrong_password' ? 'Wrong Password' : 'Connection Error'}
                  </div>
                  <div style={{ color: errorColor, fontSize: '12px', opacity: 0.85 }}>{errorMsg}</div>
                  {errorType === 'not_found' && (
                    <button type="button" onClick={onSignUp} style={{ marginTop: '8px', background: 'none', border: 'none', color: '#00B8D9', fontSize: '12px', fontFamily: 'Exo 2', fontWeight: '600', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                      Create an account →
                    </button>
                  )}
                  {errorType === 'wrong_password' && attempts >= 3 && (
                    <div style={{ marginTop: '6px', color: '#FF3D00', fontSize: '11px' }}>
                      Multiple failed attempts. Please double-check your Vehicle ID and password.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" style={{ marginTop: '4px' }} disabled={loading}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#05080D', borderRadius: '50%', animation: 'spin-slow 0.7s linear infinite' }} />
                AUTHENTICATING...
              </span>
            ) : 'SIGN IN'}
          </button>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center', borderTop: '1px solid #1A2E42', paddingTop: '24px' }}>
          <span style={{ color: '#5A7A94', fontSize: '13px' }}>New driver? </span>
          <button onClick={onSignUp} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00B8D9', fontSize: '13px', fontWeight: '600', fontFamily: 'Exo 2', letterSpacing: '0.05em' }}>
            Create Account
          </button>
        </div>

        {/* Corner decorations */}
        {['tl','tr','bl','br'].map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            top: pos.startsWith('t') ? '8px' : 'auto',
            bottom: pos.startsWith('b') ? '8px' : 'auto',
            left: pos.endsWith('l') ? '8px' : 'auto',
            right: pos.endsWith('r') ? '8px' : 'auto',
            width: '12px', height: '12px',
            borderTop: pos.startsWith('t') ? '2px solid #00B8D9' : 'none',
            borderBottom: pos.startsWith('b') ? '2px solid #00B8D9' : 'none',
            borderLeft: pos.endsWith('l') ? '2px solid #00B8D9' : 'none',
            borderRight: pos.endsWith('r') ? '2px solid #00B8D9' : 'none',
            borderRadius: '2px',
          }} />
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: '16px', color: '#2A4464', fontSize: '10px', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>
        TUKBMS v2.4.1 · ESP32 · 4S PACK · Supabase
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#5A7A94', fontSize: '11px',
  fontFamily: 'Exo 2', fontWeight: '600', letterSpacing: '0.15em', marginBottom: '8px',
}

function BatteryLogo() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" stroke="#1A2E42" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="30" stroke="#00E676" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.4" />
      <rect x="14" y="22" width="32" height="20" rx="3" stroke="#00E676" strokeWidth="1.8" fill="rgba(0,230,118,0.05)" />
      <rect x="46" y="27" width="5" height="10" rx="1.5" fill="#00E676" opacity="0.7" />
      <rect x="16" y="24" width="22" height="16" rx="2" fill="#00E676" opacity="0.12" />
      <path d="M34 26L28 32h5l-3 6 8-8h-5l3-4z" fill="#00E676" />
    </svg>
  )
}

function VehicleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2A4464" strokeWidth="1.5"
      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
      <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14l4 4v4a2 2 0 01-2 2h-2" />
      <circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2A4464" strokeWidth="1.5"
      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}
