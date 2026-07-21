import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function getDueDateColor(dateStr?: string | null) {
  if (!dateStr) return 'text-muted-foreground/50'
  const diffDays = (new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
  if (diffDays < 0) return 'text-red-500 dark:text-red-400 font-medium'
  if (diffDays <= 2) return 'text-amber-500 dark:text-amber-400 font-medium'
  return 'text-muted-foreground'
}
