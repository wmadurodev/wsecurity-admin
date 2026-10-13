/** Tipos de evento de auditoria da autorização (0002) em pt-BR. */
export const AUDIT_TYPES: Record<string, string> = {
  TENANT_CREATED: 'Tenant criado',
  TENANT_UPDATED: 'Tenant alterado',
  TENANT_SUSPENDED: 'Tenant suspenso',
  TENANT_ACTIVATED: 'Tenant reativado',
  TENANT_DELETED: 'Tenant excluído',
  TENANT_MODULE_ENABLED: 'Módulo contratado',
  TENANT_MODULE_DISABLED: 'Módulo cancelado',
  MODULE_CREATED: 'Módulo criado',
  MODULE_UPDATED: 'Módulo alterado',
  MODULE_DELETED: 'Módulo excluído',
  FEATURE_CREATED: 'Funcionalidade criada',
  FEATURE_UPDATED: 'Funcionalidade alterada',
  FEATURE_DELETED: 'Funcionalidade excluída',
  CATALOG_SYNCHRONIZED: 'Catálogo sincronizado',
  ROLE_CREATED: 'Papel criado',
  ROLE_UPDATED: 'Papel alterado',
  ROLE_DELETED: 'Papel excluído',
  MEMBERSHIP_CREATED: 'Membro adicionado',
  MEMBERSHIP_ROLES_CHANGED: 'Papéis do membro alterados',
  MEMBERSHIP_UPDATED: 'Vínculo alterado',
  MEMBERSHIP_SUSPENDED: 'Membro suspenso',
  MEMBERSHIP_REACTIVATED: 'Membro reativado',
  MEMBERSHIP_REMOVED: 'Membro removido',
  PRIVILEGE_ESCALATION_DENIED: 'Escalonamento de privilégio negado',
  TENANT_TOKEN_ISSUED: 'Token de tenant emitido',
  TENANT_TOKEN_DENIED: 'Token de tenant negado',
  KEY_ROTATED: 'Chaves giradas',
  SUBJECT_ERASED: 'Titular excluído (LGPD)',
  USER_INVITED: 'Usuário convidado',
}

export function auditTypeLabel(type: string | null | undefined): string {
  return (type && AUDIT_TYPES[type]) ?? type ?? '—'
}
