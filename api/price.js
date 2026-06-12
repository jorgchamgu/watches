import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { brand, model, reference, condition } = req.body

  // condition: { box: true/false, papers: true/false, year: 2020, grade: 'mint'/'good'/'fair' }
  if (!brand || !model) {
    return res.status(400).json({ error: 'Brand and model required' })
  }

  try {
    // Use GPT-4o as a market analyst since it has training data on watch prices
    // This will be replaced with real Telegram data later
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: `You are a luxury watch market analyst with deep knowledge of grey market and pre-owned watch prices as of early 2025. 

You know the actual prices that independent dealers trade at, not Chrono24 listing prices which are typically 10-20% higher than real transaction prices.

Always respond with valid JSON only:
{
  "dealer_buy_price": number (euros, what a dealer should pay maximum),
  "dealer_sell_price": number (euros, realistic retail price to end customer),
  "margin": number (euros),
  "margin_pct": number (percentage),
  "trend": "up" | "down" | "stable",
  "trend_pct": number (weekly change percentage, can be negative),
  "verdict": "good_buy" | "fair" | "overpriced",
  "verdict_reason": "one short sentence explaining why",
  "data_points": number (estimated recent transactions this is based on),
  "confidence": "high" | "medium" | "low"
}`
        },
        {
          role: 'user',
          content: `Give me the current dealer street prices for:
Brand: ${brand}
Model: ${model}
Reference: ${reference || 'not specified'}
Condition: Box=${condition?.box ? 'yes' : 'no'}, Papers=${condition?.papers ? 'yes' : 'no'}, Year=${condition?.year || 'unknown'}, Grade=${condition?.grade || 'good'}

Return dealer buy price (what to pay max), sell price, margin, trend, and verdict. JSON only.`
        }
      ]
    })

    const content = response.choices[0].message.content.trim()
    const clean = content.replace(/```json|```/g, '').trim()
    const pricing = JSON.parse(clean)

    return res.status(200).json({ success: true, pricing })

  } catch (error) {
    console.error('Pricing error:', error)
    return res.status(500).json({ error: 'Pricing failed' })
  }
}
