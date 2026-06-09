import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

function checkRateLimit(req: any): boolean {
  const ip = getClientIp(req)
  return rateLimit(`workspaces:members:${ip}`, 20).success
}

// GET /api/workspaces/[id]/members — List all members of a workspace
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { id } = await params

    const workspace = await db.workspace.findUnique({ where: { id } })
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const members = await db.workspaceMember.findMany({
      where: { workspaceId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })

    return NextResponse.json(
      members.map((m) => ({
        id: m.id,
        userId: m.userId,
        workspaceId: m.workspaceId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        user: m.user,
      }))
    )
  } catch (error) {
    console.error('Get workspace members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/workspaces/[id]/members — Invite a member by email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { id } = await params
    const { email, role } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const workspace = await db.workspace.findUnique({ where: { id } })
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Look up user by email
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already a member
    const existing = await db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: id,
        },
      },
    })
    if (existing) {
      return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 409 })
    }

    // Create member entry
    const member = await db.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: id,
        role: role || 'member',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({
      id: member.id,
      userId: member.userId,
      workspaceId: member.workspaceId,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user,
    })
  } catch (error) {
    console.error('Invite workspace member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/workspaces/[id]/members — Remove a member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  try {
    const { id } = await params
    const { memberId } = await req.json()

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }

    await db.workspaceMember.delete({ where: { id: memberId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove workspace member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
