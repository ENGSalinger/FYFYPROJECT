import { useState, useEffect, useRef } from 'react'
import type { CellData, HistoryPoint } from '../hooks/useBatteryData'

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function useAnimatedValue(target: number, duration = 700): number {
  const [displayed, setDisplayed] = useState(target)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const from = displayed
    const start = performance.now()
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplayed(from + (target - from) * ease)
      if (t < 1) raf.current = requestAnimationFrame(animate)
    }
    raf.current = requestAnimationFrame(animate)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  return displayed
}

// ─── Circular SOC Gauge ───────────────────────────────────────────────────────

export function SOCGauge({ soc, size = 160 }: { soc: number; size?: number }) {
  const animated = useAnimatedValue(soc)
  const radius = 58
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - animated / 100)
  const color = soc < 20 ? '#FF3D00' : soc < 40 ? '#FFB300' : '#00E676'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg width={size} height={size} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#1A2E42" strokeWidth="9" />
        {Array.from({ length: 40 }, (_, i) => {
          const angle = (i / 40) * 360 - 90
          const rad = (angle * Math.PI) / 180
          return (
            <line key={i}
              x1={70 + Math.cos(rad) * 46} y1={70 + Math.sin(rad) * 46}
              x2={70 + Math.cos(rad) * 51} y2={70 + Math.sin(rad) * 51}
              stroke={i % 5 === 0 ? '#243A52' : '#162233'}
              strokeWidth={i % 5 === 0 ? '1.5' : '0.8'}
            />
          )
        })}
        <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s', filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="1"
          strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 70 70)"
          opacity="0.2" style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x="70" y="60" textAnchor="middle" fill={color} fontSize="28" fontFamily="JetBrains Mono" fontWeight="700">{Math.round(animated)}</text>
        <text x="70" y="76" textAnchor="middle" fill={color} fontSize="11" fontFamily="JetBrains Mono" opacity="0.7">%</text>
        <text x="70" y="92" textAnchor="middle" fill="#5A7A94" fontSize="9" fontFamily="Exo 2" letterSpacing="1">STATE OF CHARGE</text>
      </svg>
      <div style={{ width: '100%', height: '3px', background: '#0B1117', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${animated}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: '2px', transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

// ─── Cell SOC bar ─────────────────────────────────────────────────────────────

export function CellSOCBar({ cell }: { cell: CellData }) {
  const animated = useAnimatedValue(cell.soc)
  const color = cell.soc < 20 ? '#FF3D00' : cell.soc < 40 ? '#FFB300' : '#00E676'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: '600', color }}>{Math.round(animated)}%</span>
      <div style={{ width: '28px', height: '80px', background: '#0B1117', border: '1px solid #1A2E42', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${animated}%`, background: `linear-gradient(to top, ${color}, ${color}55)`, borderRadius: '3px', transition: 'height 0.8s ease' }} />
        {[25, 50, 75].map(p => (
          <div key={p} style={{ position: 'absolute', left: 0, right: 0, bottom: `${p}%`, height: '1px', background: '#05080D', opacity: 0.8 }} />
        ))}
      </div>
      <span style={{ color: '#5A7A94', fontSize: '10px', fontFamily: 'Exo 2' }}>C{cell.id}</span>
    </div>
  )
}

// ─── Cell Voltage bar ─────────────────────────────────────────────────────────

export function CellVoltageBar({ cell }: { cell: CellData }) {
  const animated = useAnimatedValue(cell.voltage, 800)
  const pct = ((animated - 3.0) / (4.2 - 3.0)) * 100
  const color = animated > 4.0 ? '#00E676' : animated > 3.6 ? '#00B8D9' : animated > 3.3 ? '#FFB300' : '#FF3D00'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', fontWeight: '700', color, letterSpacing: '0.02em' }}>{animated.toFixed(3)}V</span>
      <div style={{ width: '36px', height: '110px', background: '#0B1117', border: '1px solid #1A2E42', borderRadius: '5px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, background: `linear-gradient(to top, ${color}, ${color}44)`, borderRadius: '4px', transition: 'height 0.8s cubic-bezier(0.4,0,0.2,1)', boxShadow: `0 -4px 12px ${color}40` }} />
      </div>
      <div>
        <div style={{ color: '#5A7A94', fontSize: '9px', fontFamily: 'Exo 2', textAlign: 'center', letterSpacing: '0.05em' }}>CELL {cell.id}</div>
        <div style={{ color: cell.soh < 85 ? '#FFB300' : '#3A5A74', fontSize: '9px', fontFamily: 'JetBrains Mono', textAlign: 'center' }}>SOH {cell.soh}%</div>
      </div>
    </div>
  )
}

// ─── Current widget ───────────────────────────────────────────────────────────

export function CurrentWidget({ current, isCharging }: { current: number; isCharging: boolean }) {
  const animated = useAnimatedValue(Math.abs(current))
  const color = isCharging ? '#00B8D9' : '#00E676'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="none" stroke="#1A2E42" strokeWidth="1.5" />
        <circle cx="28" cy="28" r="24" fill={`${color}08`} />
        {isCharging
          ? <path d="M32 16L22 28h8l-6 12 14-16h-8l4-8z" fill={color} />
          : <>
              <path d="M20 28h16M30 22l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M20 22v12" stroke={color} strokeWidth="2" strokeLinecap="round" />
            </>
        }
      </svg>
      <div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '26px', fontWeight: '700', color, textAlign: 'center', letterSpacing: '-0.02em' }}>
          {animated.toFixed(1)}<span style={{ fontSize: '14px', opacity: 0.7 }}>A</span>
        </div>
        <div style={{ color, fontSize: '10px', fontFamily: 'Exo 2', fontWeight: '600', letterSpacing: '0.15em', textAlign: 'center', marginTop: '2px' }}>
          {isCharging ? 'CHARGING' : 'DISCHARGING'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '3px' }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ width: '8px', height: '8px', borderRight: `2px solid ${color}`, borderTop: `2px solid ${color}`, transform: isCharging ? 'rotate(-135deg)' : 'rotate(45deg)', opacity: 0.25 + i * 0.2, transition: 'opacity 0.5s' }} />
        ))}
      </div>
    </div>
  )
}

// ─── Temperature widget ───────────────────────────────────────────────────────

export function TemperatureWidget({ temp }: { temp: number }) {
  const animated = useAnimatedValue(temp)
  const pct = Math.min(100, ((animated - 20) / (60 - 20)) * 100)
  const color = animated > 45 ? '#FF3D00' : animated > 38 ? '#FFB300' : '#00B8D9'
  const status = animated > 45 ? 'CRITICAL' : animated > 38 ? 'WARM' : 'NORMAL'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <svg width="32" height="80" viewBox="0 0 32 80">
        <rect x="12" y="6" width="8" height="54" rx="4" fill="#0B1117" stroke="#1A2E42" strokeWidth="1" />
        <rect x="13.5" y="7.5" width="5" height="51" rx="3" fill="#0B1117" />
        <rect x="13.5" y={7.5 + 51 * (1 - pct / 100)} width="5" height={51 * (pct / 100)} rx="3" fill={color}
          style={{ transition: 'all 0.8s ease', filter: `drop-shadow(0 0 3px ${color})` }} />
        <circle cx="16" cy="66" r="9" fill="#0B1117" stroke="#1A2E42" strokeWidth="1" />
        <circle cx="16" cy="66" r="7" fill={color} style={{ transition: 'fill 0.5s', filter: `drop-shadow(0 0 4px ${color})` }} />
        {[0, 25, 50, 75, 100].map(p => (
          <line key={p} x1="21" y1={7.5 + 51 * (1 - p / 100)} x2="24" y2={7.5 + 51 * (1 - p / 100)} stroke="#243A52" strokeWidth="1" />
        ))}
      </svg>
      <div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '28px', fontWeight: '700', color, letterSpacing: '-0.02em' }}>
          {animated.toFixed(1)}<span style={{ fontSize: '14px', opacity: 0.7 }}>°C</span>
        </div>
        <div style={{ color, fontSize: '10px', fontFamily: 'Exo 2', fontWeight: '600', letterSpacing: '0.15em', marginTop: '2px' }}>{status}</div>
        <div style={{ color: '#5A7A94', fontSize: '10px', marginTop: '4px', fontFamily: 'Inter' }}>Pack Temperature</div>
      </div>
    </div>
  )
}

// ─── Solar radiation widget ───────────────────────────────────────────────────

export function SolarWidget({ radiation }: { radiation: number }) {
  const animated = useAnimatedValue(radiation)
  const pct = (animated / 1000) * 100
  const color = radiation > 600 ? '#FFB300' : radiation > 300 ? '#FF8C00' : '#5A7A94'
  const status = radiation > 700 ? 'EXCELLENT' : radiation > 400 ? 'GOOD' : radiation > 100 ? 'PARTIAL' : 'LOW'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <div style={{ position: 'relative', width: '60px', height: '60px' }}>
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * 360
          return (
            <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: `${4 + (pct / 100) * 4}px`, height: '2px', background: color, opacity: 0.3 + (pct / 100) * 0.7, borderRadius: '1px', transform: `translate(-50%,-50%) rotate(${angle}deg) translateX(28px)`, transition: 'all 0.8s ease' }} />
          )
        })}
        <svg width="60" height="60" viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="30" cy="30" r="14" fill={`${color}15`} stroke={color} strokeWidth="1.5" style={{ transition: 'stroke 0.5s' }} />
          <circle cx="30" cy="30" r="9" fill={color} opacity="0.9" style={{ transition: 'fill 0.5s', filter: `drop-shadow(0 0 6px ${color})` }} />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '22px', fontWeight: '700', color }}>
          {Math.round(animated)}<span style={{ fontSize: '11px', opacity: 0.7 }}>W/m²</span>
        </div>
        <div style={{ color, fontSize: '10px', fontFamily: 'Exo 2', fontWeight: '600', letterSpacing: '0.15em', marginTop: '2px' }}>{status}</div>
      </div>
      <div style={{ width: '100%', height: '4px', background: '#0B1117', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, #FF8C00, ${color})`, borderRadius: '2px', transition: 'width 0.8s ease', boxShadow: `0 0 8px ${color}60` }} />
      </div>
    </div>
  )
}

// ─── Pack voltage ─────────────────────────────────────────────────────────────

export function PackVoltageWidget({ voltage }: { voltage: number }) {
  const animated = useAnimatedValue(voltage)
  const pct = ((animated - 12.0) / (16.8 - 12.0)) * 100
  const color = voltage < 12.8 ? '#FF3D00' : voltage < 13.6 ? '#FFB300' : '#00E676'
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: '32px', fontWeight: '700', color, letterSpacing: '-0.02em' }}>
        {animated.toFixed(2)}<span style={{ fontSize: '14px', opacity: 0.7 }}>V</span>
      </div>
      <div style={{ color: '#5A7A94', fontSize: '10px', fontFamily: 'Exo 2', letterSpacing: '0.1em', marginTop: '4px', marginBottom: '10px' }}>PACK VOLTAGE</div>
      <div style={{ width: '100%', height: '5px', background: '#0B1117', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: '3px', transition: 'width 0.8s ease', boxShadow: `0 0 8px ${color}50` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ color: '#2A4464', fontSize: '9px', fontFamily: 'JetBrains Mono' }}>12.0V</span>
        <span style={{ color: '#2A4464', fontSize: '9px', fontFamily: 'JetBrains Mono' }}>16.8V</span>
      </div>
    </div>
  )
}

// ─── Pack SOH ─────────────────────────────────────────────────────────────────

export function PackSOHWidget({ soh, cells }: { soh: number; cells: CellData[] }) {
  const animated = useAnimatedValue(soh)
  const radius = 40
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - animated / 100)
  const color = soh < 70 ? '#FF3D00' : soh < 85 ? '#FFB300' : '#00B8D9'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1A2E42" strokeWidth="7" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s', filter: `drop-shadow(0 0 4px ${color})` }}
        />
        <text x="50" y="46" textAnchor="middle" fill={color} fontSize="20" fontFamily="JetBrains Mono" fontWeight="700">{Math.round(animated)}</text>
        <text x="50" y="59" textAnchor="middle" fill={color} fontSize="9" fontFamily="JetBrains Mono" opacity="0.7">%</text>
        <text x="50" y="70" textAnchor="middle" fill="#5A7A94" fontSize="7" fontFamily="Exo 2" letterSpacing="0.5">SOH</text>
      </svg>
      <div style={{ display: 'flex', gap: '6px' }}>
        {cells.map(cell => {
          const c = cell.soh < 85 ? '#FFB300' : '#00B8D9'
          return (
            <div key={cell.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div style={{ width: '16px', height: '40px', background: '#0B1117', border: '1px solid #1A2E42', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${cell.soh}%`, background: c, transition: 'height 0.8s ease', opacity: 0.8 }} />
              </div>
              <span style={{ color: '#3A5A74', fontSize: '8px', fontFamily: 'Exo 2' }}>C{cell.id}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Location widget (Google Maps click-through) ──────────────────────────────

interface LocationProps {
  location: { lat: number; lng: number; address: string; speed: number }
}

export function LocationWidget({ location }: LocationProps) {
  const [ping, setPing] = useState(0)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setPing(p => p + 1), 2200)
    return () => clearInterval(t)
  }, [])

  const openGoogleMaps = () => {
    // Opens Google Maps at the vehicle location and searches for nearby EV charging stations
    const { lat, lng } = location
    const mapsUrl = `https://www.google.com/maps/search/EV+charging+station+OR+battery+swap+station/@${lat},${lng},15z`
    window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }

  const openDirectLocation = () => {
    const { lat, lng } = location
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Clickable map area */}
      <div
        onClick={openGoogleMaps}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Click to open Google Maps — shows vehicle location + nearby EV charging stations"
        style={{
          position: 'relative', height: '138px',
          background: '#080F18',
          borderRadius: '8px', overflow: 'hidden',
          border: `1px solid ${hovered ? '#00E676' : '#1A2E42'}`,
          cursor: 'pointer',
          transition: 'border-color 0.25s, box-shadow 0.25s',
          boxShadow: hovered ? '0 0 16px rgba(0,230,118,0.15)' : 'none',
        }}
      >
        {/* Grid lines */}
        {Array.from({ length: 7 }, (_, i) => (
          <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${(i / 6) * 100}%`, height: '1px', background: 'rgba(0,184,217,0.07)' }} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / 8) * 100}%`, width: '1px', background: 'rgba(0,184,217,0.07)' }} />
        ))}
        {/* Road lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 200 138" preserveAspectRatio="none">
          <path d="M0 69 Q50 58 100 69 Q150 80 200 69" stroke="rgba(0,184,217,0.13)" strokeWidth="3" fill="none" />
          <path d="M80 0 Q90 35 100 69 Q110 103 120 138" stroke="rgba(0,184,217,0.13)" strokeWidth="3" fill="none" />
          <path d="M0 95 Q60 90 100 84 Q160 75 200 80" stroke="rgba(0,184,217,0.08)" strokeWidth="2" fill="none" />
          <path d="M0 35 Q70 38 130 30 Q170 24 200 28" stroke="rgba(0,184,217,0.06)" strokeWidth="1.5" fill="none" />
        </svg>

        {/* Radar rings */}
        <div key={ping} style={{ position: 'absolute', top: '50%', left: '50%', width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #00E676', marginLeft: '-10px', marginTop: '-10px', animation: 'radar-ring 1.8s ease-out forwards' }} />
        <div key={`${ping}-b`} style={{ position: 'absolute', top: '50%', left: '50%', width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(0,230,118,0.4)', marginLeft: '-10px', marginTop: '-10px', animation: 'radar-ring 1.8s 0.5s ease-out forwards' }} />

        {/* Vehicle dot */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 2 }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00E676', boxShadow: '0 0 8px #00E676, 0 0 18px rgba(0,230,118,0.5)' }} />
        </div>

        {/* Speed badge */}
        <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(5,8,13,0.85)', border: '1px solid #1A2E42', borderRadius: '6px', padding: '3px 8px', backdropFilter: 'blur(4px)' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: '#00E676', fontWeight: '600' }}>{location.speed.toFixed(1)}</span>
          <span style={{ fontFamily: 'Exo 2', fontSize: '9px', color: '#5A7A94', marginLeft: '2px' }}>km/h</span>
        </div>

        {/* Live badge */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(5,8,13,0.7)', borderRadius: '5px', padding: '2px 6px' }}>
          <div className="animate-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00E676' }} />
          <span style={{ fontFamily: 'Exo 2', fontSize: '9px', color: '#00E676', letterSpacing: '0.1em' }}>LIVE</span>
        </div>

        {/* Hover overlay */}
        {hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,230,118,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="1.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ color: '#00E676', fontSize: '10px', fontFamily: 'Exo 2', fontWeight: '600', letterSpacing: '0.1em' }}>OPEN IN GOOGLE MAPS</span>
            <span style={{ color: 'rgba(0,230,118,0.6)', fontSize: '9px', fontFamily: 'Exo 2' }}>EV Charging &amp; Swap Stations</span>
          </div>
        )}
      </div>

      {/* Coordinates row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <button onClick={openDirectLocation} title="Open exact location in Google Maps"
          style={{ background: '#080F18', border: '1px solid #1A2E42', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s' }}>
          <div style={{ color: '#3A5A74', fontSize: '9px', fontFamily: 'Exo 2', letterSpacing: '0.1em' }}>LATITUDE</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: '#00B8D9', fontWeight: '500' }}>{location.lat.toFixed(5)}</div>
        </button>
        <button onClick={openDirectLocation} title="Open exact location in Google Maps"
          style={{ background: '#080F18', border: '1px solid #1A2E42', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s' }}>
          <div style={{ color: '#3A5A74', fontSize: '9px', fontFamily: 'Exo 2', letterSpacing: '0.1em' }}>LONGITUDE</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: '#00B8D9', fontWeight: '500' }}>{location.lng.toFixed(5)}</div>
        </button>
      </div>

      {/* Address */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5A7A94" strokeWidth="2" style={{ marginTop: '1px', flexShrink: 0 }}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <span style={{ color: '#5A7A94', fontSize: '11px', fontFamily: 'Inter', lineHeight: 1.5 }}>{location.address}</span>
      </div>
    </div>
  )
}

// ─── Time series chart ────────────────────────────────────────────────────────

type Metric = 'soc' | 'voltage' | 'current' | 'temperature'

export function TimeSeriesChart({ history }: { history: HistoryPoint[] }) {
  const [active, setActive] = useState<Metric>('soc')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const metrics: Record<Metric, { label: string; unit: string; color: string; getValue: (h: HistoryPoint) => number }> = {
    soc: { label: 'State of Charge', unit: '%', color: '#00E676', getValue: h => h.packSOC },
    voltage: { label: 'Pack Voltage', unit: 'V', color: '#00B8D9', getValue: h => h.packVoltage },
    current: { label: 'Current', unit: 'A', color: '#FFB300', getValue: h => Math.abs(h.current) },
    temperature: { label: 'Temperature', unit: '°C', color: '#FF6B6B', getValue: h => h.temperature },
  }

  const m = metrics[active]
  const values = history.map(m.getValue)
  if (values.length < 2) return <div style={{ color: '#5A7A94', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Awaiting data from ESP32...</div>

  const W = 500, H = 100
  const padL = 36, padR = 12, padT = 12, padB = 20
  const cW = W - padL - padR
  const cH = H - padT - padB
  const minV = Math.min(...values) * 0.98
  const maxV = Math.max(...values) * 1.02
  const range = maxV - minV || 1

  const toX = (i: number) => padL + (i / (values.length - 1)) * cW
  const toY = (v: number) => padT + cH - ((v - minV) / range) * cH
  const pts = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')
  const area = `${padL},${padT + cH} ${pts} ${toX(values.length - 1)},${padT + cH}`

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: padT + cH * (1 - t),
    label: (minV + range * t).toFixed(active === 'voltage' ? 2 : 1),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {(Object.entries(metrics) as [Metric, typeof metrics[Metric]][]).map(([key, meta]) => (
          <button key={key} onClick={() => setActive(key)}
            style={{ padding: '4px 12px', borderRadius: '6px', border: `1px solid ${active === key ? meta.color : '#1A2E42'}`, background: active === key ? `${meta.color}12` : 'transparent', color: active === key ? meta.color : '#5A7A94', fontFamily: 'Exo 2', fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.25s' }}>
            {meta.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '130px' }}
          onMouseLeave={() => setHoverIdx(null)}
          onMouseMove={e => {
            const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
            const x = ((e.clientX - rect.left) / rect.width) * W
            const i = Math.round(((x - padL) / cW) * (values.length - 1))
            setHoverIdx(Math.max(0, Math.min(values.length - 1, i)))
          }}
        >
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line x1={padL} y1={tick.y} x2={W - padR} y2={tick.y} stroke="#1A2E42" strokeWidth="0.5" strokeDasharray="2 3" />
              <text x={padL - 3} y={tick.y + 4} textAnchor="end" fill="#3A5A74" fontSize="7" fontFamily="JetBrains Mono">{tick.label}</text>
            </g>
          ))}
          <defs>
            <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={m.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={m.color} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#area-fill)" />
          <polyline points={pts} fill="none" stroke={m.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 3px ${m.color}60)` }} />
          {hoverIdx !== null && (
            <>
              <line x1={toX(hoverIdx)} y1={padT} x2={toX(hoverIdx)} y2={padT + cH} stroke={m.color} strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
              <circle cx={toX(hoverIdx)} cy={toY(values[hoverIdx])} r="4" fill={m.color} />
              <rect x={toX(hoverIdx) - 22} y={toY(values[hoverIdx]) - 20} width="44" height="16" rx="3" fill="#0F1923" stroke={m.color} strokeWidth="0.5" opacity="0.95" />
              <text x={toX(hoverIdx)} y={toY(values[hoverIdx]) - 9} textAnchor="middle" fill={m.color} fontSize="8" fontFamily="JetBrains Mono">
                {values[hoverIdx].toFixed(1)}{m.unit}
              </text>
            </>
          )}
          <text x={padL} y={H - 5} fill="#3A5A74" fontSize="7" fontFamily="Inter">{`${(history.length - 1) * 2.5} min ago`}</text>
          <text x={W - padR} y={H - 5} textAnchor="end" fill="#3A5A74" fontSize="7" fontFamily="Inter">Now</text>
        </svg>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {[
          { label: 'CURRENT', v: values[values.length - 1] },
          { label: 'AVG', v: values.reduce((a, b) => a + b, 0) / values.length },
          { label: 'MIN', v: Math.min(...values) },
          { label: 'MAX', v: Math.max(...values) },
        ].map(({ label, v }) => (
          <div key={label} style={{ background: '#080F18', border: '1px solid #1A2E42', borderRadius: '6px', padding: '6px 10px', flex: 1, textAlign: 'center' }}>
            <div style={{ color: '#3A5A74', fontSize: '9px', fontFamily: 'Exo 2', letterSpacing: '0.1em' }}>{label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: m.color, fontWeight: '600', marginTop: '2px' }}>
              {v.toFixed(1)}<span style={{ fontSize: '9px', opacity: 0.7 }}>{m.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
