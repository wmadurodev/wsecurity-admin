import type { User, UserAction } from './api'

export interface ActionSpec {
  action: UserAction
  label: string
  title: string
  description: string
  done: string
  destructive: boolean
  strong?: boolean
}

/** Por que um usuário excluído não pode ser restaurado (fase 0010, RF-STA-11); vazio quando pode. */
export function restoreBlockedReason(user: User): string | undefined {
  if (user.status !== 'DELETED' || user.restorable) {
    return undefined
  }
  if (user.anonymized) {
    return 'Os dados pessoais já foram removidos: não é possível restaurar.'
  }
  if (user.deletedBy === 'USER') {
    return 'Exclusão pedida pelo próprio usuário: não pode ser desfeita.'
  }
  return 'Exclusão anterior ao registro da origem: não pode ser desfeita.'
}

/** Ações disponíveis conforme o status do usuário (RF-USR-02). */
export function availableActions(user: User): ActionSpec[] {
  if (user.status === 'DELETED') {
    // Fase 0010 (RF-STA-11): só a exclusão feita pela plataforma, antes da anonimização, pode ser desfeita.
    return user.restorable
      ? [
          {
            action: 'restore',
            label: 'Restaurar',
            title: 'Restaurar usuário',
            description:
              'A conta volta ao status que tinha antes da exclusão, e os vínculos com tenants voltam a valer. A pessoa entra com a senha que já tinha.',
            done: 'Usuário restaurado.',
            destructive: false,
          },
        ]
      : []
  }
  const actions: ActionSpec[] = []
  // Transições do IdP (0001/RN-03): desativar só uma conta ativa; ativar uma pendente ou desativada.
  if (user.status === 'DISABLED') {
    actions.push({
      action: 'enable',
      label: 'Reativar',
      title: 'Reativar usuário',
      description: 'A pessoa volta a poder entrar com a senha atual.',
      done: 'Usuário reativado.',
      destructive: false,
    })
  } else if (user.status === 'PENDING_VERIFICATION') {
    actions.push({
      action: 'enable',
      label: 'Ativar sem verificação',
      title: 'Ativar sem verificar o e-mail',
      description: 'A conta passa a ativa sem a pessoa confirmar o e-mail ou aceitar o convite.',
      done: 'Usuário ativado.',
      destructive: false,
    })
  } else {
    actions.push({
      action: 'disable',
      label: 'Desativar',
      title: 'Desativar usuário',
      description: 'A pessoa não consegue mais entrar, e as sessões e os tokens dela são revogados.',
      done: 'Usuário desativado.',
      destructive: true,
    })
  }
  if (user.locked) {
    actions.push({
      action: 'unlock',
      label: 'Desbloquear',
      title: 'Desbloquear usuário',
      description: 'Remove o bloqueio por tentativas de login inválidas.',
      done: 'Usuário desbloqueado.',
      destructive: false,
    })
  }
  actions.push(
    {
      action: 'password-reset',
      label: 'Forçar redefinição de senha',
      title: 'Forçar redefinição de senha',
      description: 'A senha atual deixa de valer: a pessoa precisa definir outra no próximo acesso.',
      done: 'Redefinição de senha exigida.',
      destructive: true,
    },
    {
      action: 'mfa-reset',
      label: 'Remover MFA',
      title: 'Remover o segundo fator',
      description: 'O segundo fator e os códigos de recuperação são apagados. A pessoa pode configurar de novo.',
      done: 'Segundo fator removido.',
      destructive: true,
    },
    {
      action: 'delete',
      label: 'Excluir',
      title: 'Excluir usuário',
      description:
        'A pessoa não consegue mais entrar, e as sessões e os tokens dela são revogados. Os vínculos com tenants continuam, mas sem acesso, e os administradores dos tenants veem que a conta foi excluída. A exclusão pode ser desfeita aqui até os dados pessoais serem removidos (30 dias).',
      done: 'Usuário excluído.',
      destructive: true,
      strong: true,
    },
  )
  return actions
}
