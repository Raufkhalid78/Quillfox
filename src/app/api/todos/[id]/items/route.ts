import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { title, order } = await req.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const todoList = await db.todoList.findUnique({ where: { id } })
    if (!todoList) {
      return NextResponse.json({ error: 'Todo list not found' }, { status: 404 })
    }

    // Get max order if not provided
    let itemOrder = order ?? 0
    if (order === undefined || order === null) {
      const maxItem = await db.todoItem.findFirst({
        where: { todoListId: id },
        orderBy: { order: 'desc' },
      })
      itemOrder = (maxItem?.order ?? -1) + 1
    }

    const item = await db.todoItem.create({
      data: {
        title,
        order: itemOrder,
        todoListId: id,
      },
    })

    return NextResponse.json({
      id: item.id,
      title: item.title,
      completed: item.completed,
      order: item.order,
      todoListId: item.todoListId,
    })
  } catch (error) {
    console.error('Create todo item error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { items } = await req.json()

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
    }

    const todoList = await db.todoList.findUnique({ where: { id } })
    if (!todoList) {
      return NextResponse.json({ error: 'Todo list not found' }, { status: 404 })
    }

    // Batch update items using allSettled to avoid partial failures breaking everything
    const updatePromises = items.map((item: any) => {
      return db.todoItem.update({
        where: { id: item.id },
        data: {
          title: item.title,
          completed: item.completed,
          order: item.order,
        },
      })
    })

    const results = await Promise.allSettled(updatePromises)
    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      console.error(`Failed to update ${failures.length} todo items`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update todo items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
