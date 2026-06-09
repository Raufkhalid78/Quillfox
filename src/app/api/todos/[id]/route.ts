import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

function checkRateLimit(req: any): boolean {
  const ip = getClientIp(req)
  return rateLimit(`todos:id:${ip}`, 60).success
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { id } = await params
    const todoList = await db.todoList.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!todoList) {
      return NextResponse.json({ error: 'Todo list not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: todoList.id,
      title: todoList.title,
      content: '',
      workspaceId: todoList.workspaceId,
      authorId: todoList.authorId,
      isPinned: todoList.isPinned,
      isArchived: todoList.isArchived,
      createdAt: todoList.createdAt.toISOString(),
      updatedAt: todoList.updatedAt.toISOString(),
      items: todoList.items.map((i) => ({
        id: i.id,
        title: i.title,
        completed: i.completed,
        order: i.order,
        todoListId: i.todoListId,
      })),
    })
  } catch (error) {
    console.error('Get todo list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { id } = await params
    const body = await req.json()

    const todoList = await db.todoList.findUnique({ where: { id } })
    if (!todoList) {
      return NextResponse.json({ error: 'Todo list not found' }, { status: 404 })
    }

    const updated = await db.todoList.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.isPinned !== undefined && { isPinned: body.isPinned }),
        ...(body.isArchived !== undefined && { isArchived: body.isArchived }),
      },
    })

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      workspaceId: updated.workspaceId,
      authorId: updated.authorId,
      isPinned: updated.isPinned,
      isArchived: updated.isArchived,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Update todo list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { id } = await params
    const todoList = await db.todoList.findUnique({ where: { id } })
    if (!todoList) {
      return NextResponse.json({ error: 'Todo list not found' }, { status: 404 })
    }

    // Delete all items first (cascade should handle this)
    await db.todoItem.deleteMany({ where: { todoListId: id } })
    await db.todoList.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete todo list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
