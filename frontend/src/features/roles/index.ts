// API pública da área de papéis para as outras áreas (RNF-ARQ-03): a matriz e o editor são reaproveitados pelos papéis
// do tenant.
export { grantsOf, type Role } from './api'
export { type Access, type Grant, type MatrixFeature, PermissionMatrix } from './components/PermissionMatrix'
export { toMatrix } from './matrix-features'
export { RoleEditor, type RoleMatrixSource } from './RoleEditor'
