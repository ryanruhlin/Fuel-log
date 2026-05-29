import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CHAT_SYSTEM_PROMPT, PHOTO_PROMPT } from '@/lib/constants'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, text, image_base64, image_mime } = body

    if (type === 'chat') {
      if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 })

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: CHAT_SYSTEM_PROMPT + '\n\nMeal log: ' + text }],
      })

      const raw = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('')
      return NextResponse.json({ raw })
    }

    if (type === 'photo') {
      if (!image_base64 || !image_mime) return NextResponse.json({ error: 'Missing image' }, { status: 400 })

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image_mime, data: image_base64 } },
            { type: 'text', text: PHOTO_PROMPT },
          ],
        }],
      })

      const raw = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('')
      return NextResponse.json({ raw })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err: any) {
    console.error('analyze error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
