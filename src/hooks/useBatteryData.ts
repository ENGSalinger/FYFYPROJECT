import { useState, useEffect, useRef } from 'react'

export interface CellData {
  id: number
  voltage: number
  soc: number
  soh: number
}

export interface HistoryPoint {
  timestamp: Date
  packVoltage: number
  current: number
  packSOC: number
  packSOH: number
  temperature: number
  solarRadiation: number
}

export interface BatteryData {
  cells: CellData[]
  packVoltage: number
  current: number
  temperature: number
  packSOC: number
  packSOH: number
  solarRadiation: number
  location: { lat: number; lng: number; address: string; speed: number }
  timestamp: Date
  history: HistoryPoint[]
  isCharging: boolean
  connectionStatus: 'online' | 'syncing'
}

// SOC → Voltage curve (NMC Li-ion, 3.0-4.2V)
function socToVoltage(soc: number): number {
  const curve = [
    [0, 3.0], [10, 3.4], [20, 3.55], [30, 3.65], [40, 3.70],
    [50, 3.75], [60, 3.80], [70, 3.87], [80, 3.95], [90, 4.05],
    [100, 4.20],
  ]
  for (let i = 0; i < curve.length - 1; i++) {
    const [s0, v0] = curve[i]
    const [s1, v1] = curve[i + 1]
    if (soc >= s0 && soc <= s1) {
      const t = (soc - s0) / (s1 - s0)
      return v0 + t * (v1 - v0)
    }
  }
  return 3.7
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function jitter(base: number, amount: number): number {
  return base + (Math.random() - 0.5) * 2 * amount
}

function generateInitialData(): BatteryData {
  const baseSoC = 73
  const sohValues = [97, 95, 98, 96]
  const cellImbalance = [-0.5, 0.5, -1.0, 1.0] // % SOC imbalance per cell

  const cells: CellData[] = [1, 2, 3, 4].map((id, i) => {
    const cellSoC = clamp(baseSoC + cellImbalance[i], 0, 100)
    return {
      id,
      voltage: jitter(socToVoltage(cellSoC), 0.003),
      soc: cellSoC,
      soh: sohValues[i],
    }
  })

  const packVoltage = cells.reduce((s, c) => s + c.voltage, 0)
  const packSOC = cells.reduce((s, c) => s + c.soc, 0) / cells.length

  const history: HistoryPoint[] = Array.from({ length: 20 }, (_, i) => {
    const t = 20 - i
    const historicSOC = clamp(packSOC + (t - 10) * 0.6, 40, 95)
    const historicV = cells.reduce((s, c) => s + socToVoltage(historicSOC + jitter(0, 0.5)), 0)
    const hrs = new Date()
    hrs.setMinutes(hrs.getMinutes() - t * 2.5)
    const sunAngle = Math.sin(((hrs.getHours() - 6) / 12) * Math.PI)
    return {
      timestamp: hrs,
      packVoltage: historicV,
      current: jitter(14.5, 2),
      packSOC: historicSOC,
      packSOH: 96,
      temperature: jitter(33, 2),
      solarRadiation: Math.max(0, sunAngle * jitter(620, 40)),
    }
  })

  const now = new Date()
  const sunAngle = Math.sin(((now.getHours() - 6) / 12) * Math.PI)

  return {
    cells,
    packVoltage,
    current: 14.8,
    temperature: 33.4,
    packSOC,
    packSOH: Math.min(...sohValues),
    solarRadiation: Math.max(0, sunAngle * 625),
    location: {
      lat: -26.2041,
      lng: 28.0473,
      address: 'Jan Smuts Ave, Johannesburg, South Africa',
      speed: 28.4,
    },
    timestamp: now,
    history,
    isCharging: false,
    connectionStatus: 'online',
  }
}

export function useBatteryData(): BatteryData {
  const [data, setData] = useState<BatteryData>(generateInitialData)
  const tickRef = useRef(0)

  useEffect(() => {
    // Live sensor update every 3 seconds
    const liveInterval = setInterval(() => {
      setData(prev => {
        tickRef.current += 1

        const isCharging = prev.current < 0 || prev.solarRadiation > 700

        // Drift SOC slowly (discharge ~0.05% per 3s ≈ 1%/min driving)
        const socDelta = isCharging ? 0.04 : -0.05
        const newPackSOC = clamp(prev.packSOC + jitter(socDelta, 0.02), 5, 100)

        const newCells: CellData[] = prev.cells.map(cell => {
          const imbalanceDrift = (Math.random() - 0.5) * 0.003
          const newSoC = clamp(cell.soc + socDelta + imbalanceDrift, 5, 100)
          return {
            ...cell,
            soc: newSoC,
            voltage: jitter(socToVoltage(newSoC), 0.004),
          }
        })

        const newPackVoltage = newCells.reduce((s, c) => s + c.voltage, 0)
        const newCurrent = isCharging
          ? jitter(-18.5, 3)
          : jitter(14.8, 2)
        const newTemp = clamp(jitter(prev.temperature, 0.15), 22, 55)

        const now = new Date()
        const sunAngle = Math.sin(((now.getHours() - 6) / 12) * Math.PI)
        const newSolar = Math.max(0, sunAngle * jitter(625, 30))

        // New location (simulate movement)
        const newLat = prev.location.lat + jitter(0, 0.0003)
        const newLng = prev.location.lng + jitter(0, 0.0003)

        return {
          ...prev,
          cells: newCells,
          packVoltage: newPackVoltage,
          current: newCurrent,
          temperature: newTemp,
          packSOC: newPackSOC,
          solarRadiation: newSolar,
          isCharging,
          location: { ...prev.location, lat: newLat, lng: newLng, speed: jitter(28, 5) },
          timestamp: now,
          connectionStatus: tickRef.current % 12 === 0 ? 'syncing' : 'online',
        }
      })
    }, 3000)

    // Time-series record every 150s (2.5 min)
    const historyInterval = setInterval(() => {
      setData(prev => {
        const newPoint: HistoryPoint = {
          timestamp: new Date(),
          packVoltage: prev.packVoltage,
          current: prev.current,
          packSOC: prev.packSOC,
          packSOH: prev.packSOH,
          temperature: prev.temperature,
          solarRadiation: prev.solarRadiation,
        }
        return {
          ...prev,
          history: [...prev.history.slice(-39), newPoint],
        }
      })
    }, 150000)

    return () => {
      clearInterval(liveInterval)
      clearInterval(historyInterval)
    }
  }, [])

  return data
}
