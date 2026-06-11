import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string | Date | null, fmt = 'dd/MM/yyyy'): string {
  if (!date) return '—'
  // Date-only strings (YYYY-MM-DD) parsed as UTC midnight shift by -3h in Brazil → wrong day.
  // Force noon UTC so the date is the same in any timezone from UTC-11 to UTC+11.
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + 'T12:00:00Z')
    : new Date(date)
  return format(d, fmt, { locale: ptBR })
}

export function formatRelative(date: string | Date | null): string {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
