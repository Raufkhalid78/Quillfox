import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

function checkRateLimit(req: NextRequest): boolean {
  const ip = getClientIp(req)
  return rateLimit(`notes:id:${ip}`, 60).success
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!checkRateLimit(req)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    const note = await db.note.findUnique({
      where: { id },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

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
    console.error('Get note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!checkRateLimit(req)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    const body = await req.json()

    const note = await db.note.findUnique({ where: { id } })
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const updated = await db.note.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.isPinned !== undefined && { isPinned: body.isPinned }),
        ...(body.isArchived !== undefined && { isArchived: body.isArchived }),
      },
    })

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      content: updated.content,
      workspaceId: updated.workspaceId,
      authorId: updated.authorId,
      isPinned: updated.isPinned,
      isArchived: updated.isArchived,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Update note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!checkRateLimit(req)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    const note = await db.note.findUnique({ where: { id } })
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    await db.note.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
