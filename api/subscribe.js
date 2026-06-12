import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body

  // Basic validation
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  // Save to Supabase
  const { error } = await supabase
    .from('waitlist')
    .insert([{ email: email.toLowerCase().trim() }])

  if (error) {
    // If email already exists, still return success (no need to tell user)
    if (error.code === '23505') {
      return res.status(200).json({ success: true })
    }
    console.error('Supabase error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }

  return res.status(200).json({ success: true })
}
