import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/logs?date=2025-08-01
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  const [entriesRes, metaRes] = await Promise.all([
    supabase.from('log_entries').select('*').eq('date', date).order('logged_at'),
    supabase.from('daily_meta').select('*').eq('date', date).maybeSingle(),
  ])

  if (entriesRes.error) return NextResponse.json({ error: entriesRes.error.message }, { status: 500 })

  return NextResponse.json({
    entries: entriesRes.data ?? [],
    meta: metaRes.data ?? { date, day_type: 'moderate', weight_lbs: null },
  })
}

// POST /api/logs — add a new entry
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, day_type, name, kcal, protein_g, carbs_g, fat_g, source } = body

  const { data, error } = await supabase.from('log_entries').insert({
    date, day_type, name,
    kcal: kcal ?? 0, protein_g: protein_g ?? 0, carbs_g: carbs_g ?? 0, fat_g: fat_g ?? 0,
    source: source ?? 'manual',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

// PATCH /api/logs — update day meta (day_type or weight)
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { date, day_type, weight_lbs } = body
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  const { data, error } = await supabase.from('daily_meta').upsert({
    date, day_type, weight_lbs, updated_at: new Date().toISOString(),
  }, { onConflict: 'date' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meta: data })
}
