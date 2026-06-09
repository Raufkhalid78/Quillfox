import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

function checkRateLimit(req: any): boolean {
  const ip = getClientIp(req)
  return rateLimit(`notes:versions:${ip}`, 60).success
}

// GET /api/notes/[id]/versions — List all versions of a note
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { id } = await params

    const versions = await db.noteVersion.findMany({
      where: { noteId: id },
      orderBy: { version: 'desc' },
    })

    return NextResponse.json(
      versions.map((v) => ({
        id: v.id,
        title: v.title,
        content: v.content,
        version: v.version,
        createdAt: v.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Get note versions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/notes/[id]/versions — Create a new version snapshot
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { id } = await params
    const { title, content } = await req.json()

    const note = await db.note.findUnique({ where: { id } })
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Get the current max version
    const lastVersion = await db.noteVersion.findFirst({
      where: { noteId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const newVersion = await db.noteVersion.create({
      data: {
        noteId: id,
        title: title || note.title,
        content: content || note.content,
        version: (lastVersion?.version || 0) + 1,
      },
    })

    return NextResponse.json({
      id: newVersion.id,
      title: newVersion.title,
      content: newVersion.content,
      version: newVersion.version,
      createdAt: newVersion.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Create note version error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
