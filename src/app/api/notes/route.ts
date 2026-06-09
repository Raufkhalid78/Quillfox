import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Rate limit: 60 requests per minute per IP
function checkRateLimit(req: NextRequest): boolean {
  const ip = getClientIp(req)
  return rateLimit(`notes:${ip}`, 60).success
}

export async function GET(req: NextRequest) {
  try {
    if (!checkRateLimit(req)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const workspaceId = searchParams.get('workspaceId')
    const archived = searchParams.get('archived')

    const where: any = {}

    if (archived === 'true') {
      where.isArchived = true
    } else {
      where.isArchived = false
    }

    if (userId) {
      where.authorId = userId
    }

    if (workspaceId) {
      where.workspaceId = workspaceId
    }

    const notes = await db.note.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(
      notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        workspaceId: n.workspaceId,
        authorId: n.authorId,
        isPinned: n.isPinned,
        isArchived: n.isArchived,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Get notes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkRateLimit(req)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    const { title, content, workspaceId, authorId } = await req.json()

    if (!title || !authorId) {
      return NextResponse.json({ error: 'Title and authorId are required' }, { status: 400 })
    }

    const note = await db.note.create({
      data: {
        title,
        content: content || '',
        workspaceId: workspaceId || null,
        authorId,
      },
    })

    return NextResponse.json({
      id: note.id,
      title: note.title,
      content: note.content,
      workspaceId: note.workspaceId,
      authorId: note.authorId,
      isPinned: note.isPinned,
      isArchived: note.isArchived,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Create note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
