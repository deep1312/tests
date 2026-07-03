import { create } from 'zustand'

export type Timezone = 'IST' | 'EST'

export const TIMEZONE_MAP: Record<Timezone, string> = {
  IST: 'Asia/Kolkata',
  EST: 'America/New_York',
}

export interface TimezoneState {
  timezone: Timezone
  setTimezone: (tz: Timezone) => void
}

export const useTimezoneStore = create<TimezoneState>((set) => ({
  timezone: (localStorage.getItem('app_timezone') as Timezone) || 'IST',
  setTimezone: (tz: Timezone) => {
    localStorage.setItem('app_timezone', tz)
    set({ timezone: tz })
  },
}))
