import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const workspaceId = searchParams.get('workspaceId')

    const where: any = {
      isArchived: false,
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
