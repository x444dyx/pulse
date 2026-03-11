import { supabase } from './supabase'

export type LeaderboardEntry = {
  id: string
  name: string
  score: number
  created_at: string
}

const functionsBase = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export async function fetchTopScores(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('id, name, score, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .range(0, 99)

  if (error) throw error
  return data ?? []
}

export async function submitScore(name: string, score: number) {
  const res = await fetch(`${functionsBase}/submit-score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    body: JSON.stringify({ name, score }),
  })

  const json = await res.json()

  if (!res.ok) {
    throw new Error(json.error || 'Failed to submit score')
  }

  return json
}