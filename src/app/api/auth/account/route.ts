import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function PUT(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = rateLimit(`auth:account:${ip}`, 20)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await req.json()
    const { userId, name, currentPassword, newPassword } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update name
    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : ''
      if (!trimmedName) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      await db.user.update({
        where: { id: userId },
        data: { name: trimmedName },
      })
      return NextResponse.json({ success: true, message: 'Name updated' })
    }

    // Change password
    if (currentPassword && newPassword) {
      if (!user.password) {
        return NextResponse.json({ error: 'No password set for this account' }, { status: 400 })
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password)
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12)
      await db.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      })

      return NextResponse.json({ success: true, message: 'Password updated' })
    }

    return NextResponse.json({ error: 'No valid update data provided' }, { status: 400 })
  } catch (error) {
    console.error('Account update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = rateLimit(`auth:account:delete:${ip}`, 5)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await req.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete all associated data in a transaction
    await db.$transaction(async (tx) => {
      // Delete document locks
      await tx.documentLock.deleteMany({
        where: { userId },
      })

      // Delete workspace memberships
      await tx.workspaceMember.deleteMany({
        where: { userId },
      })

      // Delete note versions (via notes)
      const userNotes = await tx.note.findMany({
        where: { authorId: userId },
        select: { id: true },
      })
      if (userNotes.length > 0) {
        const noteIds = userNotes.map((n) => n.id)
        await tx.noteVersion.deleteMany({
          where: { noteId: { in: noteIds } },
        })
        await tx.documentLock.deleteMany({
          where: { documentType: 'note', documentId: { in: noteIds } },
        })
      }

      // Delete notes
      await tx.note.deleteMany({
        where: { authorId: userId },
      })

      // Delete todo items (via todo lists)
      const userTodos = await tx.todoList.findMany({
        where: { authorId: userId },
        select: { id: true },
      })
      if (userTodos.length > 0) {
        const todoIds = userTodos.map((t) => t.id)
        await tx.todoItem.deleteMany({
          where: { todoListId: { in: todoIds } },
        })
        await tx.documentLock.deleteMany({
          where: { documentType: 'todolist', documentId: { in: todoIds } },
        })
      }

      // Delete todo lists
      await tx.todoList.deleteMany({
        where: { authorId: userId },
      })

      // Delete owned workspaces (cascade will handle members, notes, todos)
      await tx.workspace.deleteMany({
        where: { ownerId: userId },
      })

      // Finally delete the user
      await tx.user.delete({
        where: { id: userId },
      })
    })

    return NextResponse.json({ success: true, message: 'Account deleted' })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
