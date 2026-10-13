import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { Button } from '@/components/ui/button'

import { type ActionSpec, availableActions } from './actions'
import { runUserAction, type User, userKeys } from './api'

export function UserActions({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [pending, setPending] = useState<ActionSpec | null>(null)
  const id = user.id ?? ''

  const run = useMutation({
    mutationFn: (spec: ActionSpec) => runUserAction(id, spec.action),
    onSuccess: async (_, spec) => {
      setPending(null)
      showSuccess(spec.done)
      await queryClient.invalidateQueries({ queryKey: userKeys.all })
      if (spec.action === 'delete') {
        void navigate('/platform/users')
      }
    },
    onError: (error) => {
      setPending(null)
      showProblem(error)
    },
  })

  return (
    <div className="flex flex-wrap gap-2">
      {availableActions(user).map((spec) => (
        <Button
          key={spec.action}
          variant={spec.action === 'delete' ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => setPending(spec)}
        >
          {spec.label}
        </Button>
      ))}
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={pending.title}
          description={pending.description}
          confirmLabel={pending.label}
          destructive={pending.destructive}
          requireText={pending.strong ? (user.email ?? undefined) : undefined}
          pending={run.isPending}
          onConfirm={() => run.mutate(pending)}
        />
      )}
    </div>
  )
}
