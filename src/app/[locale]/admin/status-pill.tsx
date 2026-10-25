type Status = 'draft' | 'published' | 'archived'

// Published: copper on copper-tint (>= 4.5:1 in both themes). Others: ink-2 on a hairline pill.
const styles: Record<Status, string> = {
  published: 'bg-copper-tint text-copper',
  draft: 'border border-line text-ink-2',
  archived: 'border border-line text-ink-2',
}

export function StatusPill({ status, label }: { status: Status; label: string }) {
  return (
    <span className={`inline-block rounded-[4px] px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{label}</span>
  )
}
