import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type DayType = 'rest' | 'light' | 'moderate' | 'hard' | 'race'

export interface LogEntry {
  id: string
  date: string
  day_type: DayType
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  source: 'manual' | 'quick' | 'voice' | 'photo'
  logged_at: string
}

export interface DailyMeta {
  date: string
  day_type: DayType
  weight_lbs: number | null
}
