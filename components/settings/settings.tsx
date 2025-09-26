'use client'

import { useCallback, useMemo, useState } from 'react'
import { AutoFixErrors } from './auto-fix-errors'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ReasoningEffort } from './reasoning-effort'
import { SlidersVerticalIcon, DatabaseIcon } from 'lucide-react'
import { SupabaseBootstrapDialog } from './supabase-bootstrap-dialog'

interface SettingsProps {
  onAppendSystemMessage: (message: string) => void
}

export function Settings({ onAppendSystemMessage }: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [supabaseDialogOpen, setSupabaseDialogOpen] = useState(false)
  const supabaseUrl = useMemo(() => process.env.NEXT_PUBLIC_SUPABASE_URL, [])

  const openSupabaseDialog = useCallback(() => {
    setSupabaseDialogOpen(true)
    setIsOpen(false)
  }, [])

  return (
    <>
      <SupabaseBootstrapDialog
        open={supabaseDialogOpen}
        onOpenChange={setSupabaseDialogOpen}
        onAppendSystemMessage={onAppendSystemMessage}
        supabaseUrl={supabaseUrl}
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button className="cursor-pointer" variant="outline" size="sm">
            <SlidersVerticalIcon className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-96">
          <div className="p-4 space-y-6">
            <AutoFixErrors />
            <ReasoningEffort />
            <div className="border-t border-border/60 pt-4 mt-2">
              <button
                type="button"
                className="w-full rounded-md border border-dashed border-border/60 bg-secondary/30 px-3 py-2 text-left transition hover:bg-secondary/60"
                onClick={openSupabaseDialog}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <DatabaseIcon className="h-4 w-4" /> Add Supabase (DB)
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check your Supabase connection and run the chat history bootstrap.
                </p>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
