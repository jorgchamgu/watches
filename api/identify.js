import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64 } = req.body

  if (!imageBase64) {
    return res.status(400).json({ error: 'No image provided' })
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are an expert luxury watch identifier with deep knowledge of all major brands, models, references, and variants. 
          
When given a watch photo, identify it with maximum precision. Always respond in valid JSON with this exact structure:
{
  "brand": "exact brand name",
  "model": "exact model name", 
  "reference": "reference number if visible or inferable",
  "year_range": "approximate year range e.g. 2020-2022",
  "dial_color": "dial color",
  "case_material": "steel/gold/titanium/etc",
  "confidence": "high/medium/low",
  "notes": "any relevant details about this specific variant"
}

If you cannot identify the watch, return confidence: "low" and fill what you can.
Never return anything outside of this JSON structure.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high'
              }
            },
            {
              type: 'text',
              text: 'Identify this luxury watch precisely. Return only the JSON.'
            }
          ]
        }
      ]
    })

    const content = response.choices[0].message.content.trim()

    // Strip markdown code blocks if present
    const clean = content.replace(/```json|```/g, '').trim()
    const watch = JSON.parse(clean)

    return res.status(200).json({ success: true, watch })

  } catch (error) {
    console.error('OpenAI error:', error)
    return res.status(500).json({ error: 'Identification failed' })
  }
}
