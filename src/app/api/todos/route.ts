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

    const todoLists = await db.todoList.findMany({
      where,
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(
      todoLists.map((t) => ({
        id: t.id,
        title: t.title,
        content: '',
        workspaceId: t.workspaceId,
        authorId: t.authorId,
        isPinned: t.isPinned,
        isArchived: t.isArchived,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        items: t.items.map((i) => ({
          id: i.id,
          title: i.title,
          completed: i.completed,
          order: i.order,
          todoListId: i.todoListId,
        })),
      }))
    )
  } catch (error) {
    console.error('Get todo lists error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, workspaceId, authorId } = await req.json()

    if (!title || !authorId) {
      return NextResponse.json({ error: 'Title and authorId are required' }, { status: 400 })
    }

    const todoList = await db.todoList.create({
      data: {
        title,
        workspaceId: workspaceId || null,
        authorId,
      },
      include: {
        items: true,
      },
    })

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
      items: [],
    })
  } catch (error) {
    console.error('Create todo list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
