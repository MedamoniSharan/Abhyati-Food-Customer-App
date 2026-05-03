type Props = {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

function IconEdit() {
  return (
    <svg className="admin-icon-btn__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg className="admin-icon-btn__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export function IconEditButton({ label, onClick, disabled }: Omit<Props, 'variant'>) {
  return (
    <button type="button" className="admin-icon-btn" onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <IconEdit />
    </button>
  )
}

export function IconDeleteButton({ label, onClick, disabled }: Omit<Props, 'variant'>) {
  return (
    <button
      type="button"
      className="admin-icon-btn admin-icon-btn--danger"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <IconTrash />
    </button>
  )
}
