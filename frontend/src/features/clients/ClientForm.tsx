import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { FormField } from '@/components/form-field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { isApiError } from '@/lib/api/errors'

import { clientKeys, listScopes } from './api'
import {
  ADMIN_SCOPE,
  AUTH_METHODS,
  clientSchema,
  type ClientValues,
  GRANTS,
  violationMessage,
} from './client-form-model'

const GRANT_FIELDS = {
  authorization_code: 'authorizationCode',
  refresh_token: 'refreshToken',
  client_credentials: 'clientCredentials',
} as const

/**
 * Formulário de cliente OAuth (RF-CLI-02, RF-CLI-03), compartilhado entre criação e edição. O tipo é fixo na edição.
 * As regras de coerência espelham as do IdP; as violações que só a API detecta chegam por `violations`.
 */
export function ClientForm({
  initial,
  editing,
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  initial: ClientValues
  editing: boolean
  submitLabel: string
  pending: boolean
  /** Erro da última tentativa: campos recebem os erros de validação; as regras recusadas viram uma lista. */
  error: unknown
  onSubmit: (values: ClientValues) => void
}) {
  const form = useForm<ClientValues>({ resolver: zodResolver(clientSchema), values: initial })
  const violations = isApiError(error) ? error.violations.map(violationMessage) : []
  useEffect(() => {
    if (!isApiError(error)) {
      return
    }
    const known = Object.keys(form.getValues())
    Object.entries(error.fieldErrors).forEach(([field, message]) => {
      if (known.includes(field)) {
        form.setError(field as keyof ClientValues, { type: 'server', message })
      }
    })
  }, [error, form])
  const scopes = useQuery({ queryKey: clientKeys.scopes, queryFn: listScopes })
  const [type, method, authorizationCode, allowedAdminScope, chosenScopes] = useWatch({
    control: form.control,
    name: ['type', 'authenticationMethod', 'authorizationCode', 'allowedAdminScope', 'scopes'],
  })
  const isPublic = type === 'PUBLIC'

  // Cliente público: só authorization code, sem refresh token (0001/DEC-11).
  useEffect(() => {
    if (isPublic) {
      form.setValue('refreshToken', false)
      form.setValue('clientCredentials', false)
    }
  }, [isPublic, form])

  const available = (scopes.data ?? []).filter(
    (scope) => scope.enabled !== false || chosenScopes.includes(scope.name ?? ''),
  )
  const errors = form.formState.errors

  return (
    <form className="flex max-w-3xl flex-col gap-6" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      {violations.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>O IdP recusou a configuração</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {violations.map((violation) => (
                <li key={violation}>{violation}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          label="Nome"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <fieldset className="flex flex-col gap-2" disabled={editing}>
          <legend className="mb-1 text-sm font-medium">
            Tipo {editing && <span className="text-muted-foreground">(não pode mudar)</span>}
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="CONFIDENTIAL" {...form.register('type')} />
            Confidencial: aplicação com servidor, que guarda um segredo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="PUBLIC" {...form.register('type')} />
            Público: SPA ou app nativo, sem segredo (sempre com PKCE)
          </label>
        </fieldset>
        {!isPublic && (
          <FormField
            control={form.control}
            name="authenticationMethod"
            label="Autenticação do cliente"
            render={(field, props) => (
              <Select {...field} {...props}>
                {AUTH_METHODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            )}
          />
        )}
        {!isPublic && method === 'private_key_jwt' && (
          <FormField
            control={form.control}
            name="jwkSetUrl"
            label="URL do JWKS do cliente"
            render={(field, props) => <Input type="url" placeholder="https://…" {...field} {...props} />}
          />
        )}
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Grants</legend>
        {GRANTS.map((grant) => {
          const name = GRANT_FIELDS[grant.value]
          const blocked = isPublic && grant.value !== 'authorization_code'
          return (
            <label key={grant.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={blocked} {...form.register(name)} />
              <span className={blocked ? 'text-muted-foreground' : undefined}>{grant.label}</span>
            </label>
          )
        })}
        {(['authorizationCode', 'refreshToken', 'clientCredentials'] as const).map(
          (name) =>
            errors[name]?.message && (
              <p key={name} role="alert" className="text-xs text-destructive">
                {errors[name]?.message}
              </p>
            ),
        )}
      </fieldset>

      {authorizationCode && (
        <FormField
          control={form.control}
          name="redirectUris"
          label="URIs de retorno"
          description="Uma por linha. https; http só em localhost."
          render={(field, props) => <Textarea rows={3} {...field} {...props} />}
        />
      )}
      <FormField
        control={form.control}
        name="postLogoutRedirectUris"
        label="URIs de retorno após logout"
        description="Uma por linha (opcional)."
        render={(field, props) => <Textarea rows={2} {...field} {...props} />}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Escopos</legend>
        {scopes.isPending && <p className="text-sm text-muted-foreground">Carregando os escopos…</p>}
        <div className="grid gap-1 sm:grid-cols-2">
          {available.map((scope) => {
            const admin = scope.name === ADMIN_SCOPE
            return (
              <label key={scope.name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={scope.name}
                  disabled={admin && !allowedAdminScope}
                  {...form.register('scopes')}
                />
                <span className="font-mono">{scope.name}</span>
              </label>
            )
          })}
        </div>
        {errors.scopes?.message && (
          <p role="alert" className="text-xs text-destructive">
            {errors.scopes.message}
          </p>
        )}
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('allowedAdminScope')} />
          Autorizar o escopo administrativo <code>wsecurity.admin</code>
        </label>
        {allowedAdminScope && (
          <Alert variant="warning">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Escopo com poder total</AlertTitle>
            <AlertDescription>
              <p>
                Com <code>wsecurity.admin</code>, o cliente administra todo o IdP e a autorização. O IdP só o concede a
                administradores da plataforma. Com client credentials, o segredo sozinho já dá esse poder.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Comportamento</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('firstParty')} />
          Aplicação própria (first-party): não pede consentimento
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('revokeOnLogout')} />
          Revogar os refresh tokens da sessão no logout
        </label>
      </fieldset>

      <section className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="accessTokenMinutes"
          label="Validade do access token (min)"
          description="De 1 a 60."
          render={(field, props) => (
            <Input
              type="number"
              {...field}
              {...props}
              onChange={(event) => field.onChange(event.target.valueAsNumber)}
            />
          )}
        />
        <FormField
          control={form.control}
          name="authorizationCodeMinutes"
          label="Validade do código (min)"
          description="De 1 a 10."
          render={(field, props) => (
            <Input
              type="number"
              {...field}
              {...props}
              onChange={(event) => field.onChange(event.target.valueAsNumber)}
            />
          )}
        />
        <FormField
          control={form.control}
          name="refreshTokenDays"
          label="Validade total do refresh token (dias)"
          render={(field, props) => (
            <Input
              type="number"
              step="any"
              {...field}
              {...props}
              onChange={(event) => field.onChange(event.target.valueAsNumber)}
            />
          )}
        />
        <FormField
          control={form.control}
          name="refreshTokenIdleDays"
          label="Validade do refresh token sem uso (dias)"
          render={(field, props) => (
            <Input
              type="number"
              step="any"
              {...field}
              {...props}
              onChange={(event) => field.onChange(event.target.valueAsNumber)}
            />
          )}
        />
      </section>

      <FormField
        control={form.control}
        name="audiences"
        label="Audiências extras"
        description="Uma por linha, em settings.audiences (ex.: wsecurity-authorization, para os tokens serem aceitos pela autorização)."
        render={(field, props) => <Textarea rows={2} {...field} {...props} />}
      />

      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
