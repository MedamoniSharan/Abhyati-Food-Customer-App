type Props = {
  message: string | null
}

export function AppToast({ message }: Props) {
  if (!message) return null

  return (
    <div className="app-toast" role="status" aria-live="polite">
      {message}
    </div>
  )
}
