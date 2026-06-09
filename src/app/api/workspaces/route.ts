import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

function checkRateLimit(req: any): boolean {
  const ip = getClientIp(req)
  return rateLimit(`workspaces:${ip}`, 60).success
}

export async function GET(req: NextRequest) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get owned workspaces and member workspaces
    const ownedWorkspaces = await db.workspace.findMany({
      where: { ownerId: userId },
      include: {
        _count: {
          select: { notes: true, todoLists: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const memberWorkspaces = await db.workspaceMember.findMany({
      where: { userId, NOT: { workspace: { ownerId: userId } } },
      include: {
        workspace: {
          include: {
            _count: {
              select: { notes: true, todoLists: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })

    const allWorkspaces = [
      ...ownedWorkspaces.map((ws) => ({
        id: ws.id,
        title: ws.title,
        description: ws.description,
        color: ws.color,
        icon: ws.icon,
        ownerId: ws.ownerId,
        createdAt: ws.createdAt.toISOString(),
        updatedAt: ws.updatedAt.toISOString(),
        _count: ws._count,
      })),
      ...memberWorkspaces.map((m) => ({
        id: m.workspace.id,
        title: m.workspace.title,
        description: m.workspace.description,
        color: m.workspace.color,
        icon: m.workspace.icon,
        ownerId: m.workspace.ownerId,
        createdAt: m.workspace.createdAt.toISOString(),
        updatedAt: m.workspace.updatedAt.toISOString(),
        _count: m.workspace._count,
      })),
    ]

    return NextResponse.json(allWorkspaces)
  } catch (error) {
    console.error('Get workspaces error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { title, description, color, ownerId } = await req.json()

    if (!title || !ownerId) {
      return NextResponse.json({ error: 'Title and ownerId are required' }, { status: 400 })
    }

    const workspace = await db.workspace.create({
      data: {
        title,
        description: description || null,
        color: color || '#059669',
        ownerId,
      },
      include: {
        _count: {
          select: { notes: true, todoLists: true },
        },
      },
    })

    // Add owner as member
    await db.workspaceMember.create({
      data: {
        userId: ownerId,
        workspaceId: workspace.id,
        role: 'owner',
      },
    })

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
    console.error('Create workspace error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
