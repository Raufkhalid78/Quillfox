/**
 * Internationalization foundation.
 *
 * A typed message catalog, locale detection, RTL awareness and a `t()` helper.
 * As UI strings are extracted, add them to the `en` catalog; the other catalogs
 * are typed against it so missing translations fail the type-check.
 */

const en = {
  'common.search': 'Search',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.restore': 'Restore',
  'common.loading': 'Loading…',
  'common.empty': 'Nothing here yet',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.manage': 'Manage',
  'common.upgrade': 'Upgrade',
  'search.placeholder': 'Search notes, todos, workspaces…',
  'search.noResults': 'No matches found.',
  'search.title': 'Search',
  'trash.title': 'Trash',
  'trash.empty': 'Trash is empty.',
  'trash.emptyTrash': 'Empty trash',
  'trash.deletedForever': 'Deleted forever',
  'trash.movedHere': 'Deleted notes and lists stay here until you remove them permanently.',
  'offline.title': 'You are offline. Changes are saved locally and will sync when you reconnect.',
  'offline.pending': '{count} change(s) pending — syncing…',
  'notifications.title': 'Notification Center',
  'notifications.empty': 'No reminders yet. Add a due date to a note or todo list to create one.',
  'analytics.title': 'Insights',
  'nav.dashboard': 'Dashboard',
  'nav.notes': 'Notes',
  'nav.todos': 'Todos',
  'nav.workspaces': 'Workspaces',
  'nav.search': 'Search',
  'nav.notifications': 'Notifications',
  'nav.archive': 'Archive',
  'nav.trash': 'Trash',
  'nav.settings': 'Settings',
} as const

export type MessageKey = keyof typeof en
type Catalog = Record<MessageKey, string>

const es: Catalog = {
  'common.search': 'Buscar',
  'common.cancel': 'Cancelar',
  'common.delete': 'Eliminar',
  'common.restore': 'Restaurar',
  'common.loading': 'Cargando…',
  'common.empty': 'Aún no hay nada',
  'common.save': 'Guardar',
  'common.close': 'Cerrar',
  'common.manage': 'Gestionar',
  'common.upgrade': 'Mejorar',
  'search.placeholder': 'Buscar notas, tareas, espacios…',
  'search.noResults': 'No se encontraron coincidencias.',
  'search.title': 'Buscar',
  'trash.title': 'Papelera',
  'trash.empty': 'La papelera está vacía.',
  'trash.emptyTrash': 'Vaciar papelera',
  'trash.deletedForever': 'Eliminado para siempre',
  'trash.movedHere': 'Las notas y listas eliminadas permanecen aquí hasta que las borres definitivamente.',
  'offline.title': 'Estás sin conexión. Los cambios se guardan localmente y se sincronizarán al reconectar.',
  'offline.pending': '{count} cambio(s) pendiente(s) — sincronizando…',
  'notifications.title': 'Centro de notificaciones',
  'notifications.empty': 'Aún no hay recordatorios. Añade una fecha a una nota o lista para crear uno.',
  'analytics.title': 'Estadísticas',
  'nav.dashboard': 'Panel',
  'nav.notes': 'Notas',
  'nav.todos': 'Tareas',
  'nav.workspaces': 'Espacios',
  'nav.search': 'Buscar',
  'nav.notifications': 'Notificaciones',
  'nav.archive': 'Archivo',
  'nav.trash': 'Papelera',
  'nav.settings': 'Ajustes',
}

const ar: Catalog = {
  'common.search': 'بحث',
  'common.cancel': 'إلغاء',
  'common.delete': 'حذف',
  'common.restore': 'استعادة',
  'common.loading': 'جارٍ التحميل…',
  'common.empty': 'لا يوجد شيء بعد',
  'common.save': 'حفظ',
  'common.close': 'إغلاق',
  'common.manage': 'إدارة',
  'common.upgrade': 'ترقية',
  'search.placeholder': 'ابحث في الملاحظات والمهام والمساحات…',
  'search.noResults': 'لا توجد نتائج مطابقة.',
  'search.title': 'بحث',
  'trash.title': 'المهملات',
  'trash.empty': 'المهملات فارغة.',
  'trash.emptyTrash': 'إفراغ المهملات',
  'trash.deletedForever': 'حُذف نهائيًا',
  'trash.movedHere': 'تبقى الملاحظات والقوائم المحذوفة هنا حتى تحذفها نهائيًا.',
  'offline.title': 'أنت غير متصل. تُحفظ التغييرات محليًا وستتم المزامنة عند إعادة الاتصال.',
  'offline.pending': '{count} تغيير قيد الانتظار — جارٍ المزامنة…',
  'notifications.title': 'مركز الإشعارات',
  'notifications.empty': 'لا توجد تذكيرات بعد. أضف تاريخ استحقاق لملاحظة أو قائمة لإنشاء واحد.',
  'analytics.title': 'إحصاءات',
  'nav.dashboard': 'لوحة التحكم',
  'nav.notes': 'الملاحظات',
  'nav.todos': 'المهام',
  'nav.workspaces': 'المساحات',
  'nav.search': 'بحث',
  'nav.notifications': 'الإشعارات',
  'nav.archive': 'الأرشيف',
  'nav.trash': 'المهملات',
  'nav.settings': 'الإعدادات',
}

export const SUPPORTED_LOCALES = ['en', 'es', 'ar'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const messages: Record<Locale, Catalog> = { en, es, ar }

const RTL_LOCALES: Locale[] = ['ar']

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale)
}

export function direction(locale: Locale): 'rtl' | 'ltr' {
  return isRtl(locale) ? 'rtl' : 'ltr'
}

function detectLocale(): Locale {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language?.split('-')[0]
    if (lang && (SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
      return lang as Locale
    }
  }
  return 'en'
}

let currentLocale: Locale = detectLocale()

export function setLocale(locale: Locale) {
  currentLocale = locale
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
    document.documentElement.dir = direction(locale)
  }
}

export function getLocale(): Locale {
  return currentLocale
}

/** Applies the current locale to the document (call once on mount). */
export function applyLocaleToDocument(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLocale
    document.documentElement.dir = direction(currentLocale)
  }
}

/** Translates a key, with optional `{name}` interpolation. Falls back to the key. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const catalog = messages[currentLocale] ?? messages.en
  let value: string = catalog[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return value
}

/** Locale-aware date formatting. */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat(currentLocale, options ?? { dateStyle: 'medium' }).format(d)
  } catch {
    return d.toDateString()
  }
}
