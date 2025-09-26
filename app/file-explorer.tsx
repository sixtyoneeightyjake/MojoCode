'use client'

import { FileExplorer as FileExplorerComponent } from '@/components/file-explorer/file-explorer'
import { useSandboxStore } from './state'

interface Props {
  className: string
}

export function FileExplorer({ className }: Props) {
  const sandboxId = useSandboxStore((state) => state.sandboxId)
  const status = useSandboxStore((state) => state.status)
  const paths = useSandboxStore((state) => state.paths)
  return (
    <FileExplorerComponent
      className={className}
      disabled={status === 'stopped'}
      sandboxId={sandboxId}
      paths={paths}
    />
  )
}
