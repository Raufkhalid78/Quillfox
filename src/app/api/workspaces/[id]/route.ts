import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/workspaces/[id] — Get a single workspace with member count
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const workspace = await db.workspace.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            notes: true,
            todoLists: true,
          },
        },
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: workspace.id,
      title: workspace.title,
      description: workspace.description,
      color: workspace.color,
      icon: workspace.icon,
      ownerId: workspace.ownerId,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
      _count: workspace._count,
    })
  } catch (error) {
    console.error('Get workspace error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/workspaces/[id] — Update workspace title, description, color
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const workspace = await db.workspace.findUnique({ where: { id } })
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const updated = await db.workspace.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.color !== undefined && { color: body.color }),
      },
      include: {
        _count: {
          select: {
            members: true,
            notes: true,
            todoLists: true,
          },
        },
      },
    })

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      color: updated.color,
      icon: updated.icon,
      ownerId: updated.ownerId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      _count: updated._count,
    })
  } catch (error) {
    console.error('Update workspace error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/workspaces/[id] — Delete workspace (cascade deletes members)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const workspace = await db.workspace.findUnique({ where: { id } })
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Deleting the workspace cascades to members via onDelete: Cascade in schema
    await db.workspace.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete workspace error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
