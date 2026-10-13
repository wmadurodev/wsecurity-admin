import { expect, test } from '@playwright/test'

import { expectAccessible } from './support/a11y'
import { createUser } from './support/data'
import { signIn } from './support/login'

/** Jornada 4 (04 §6.1): usuário sem administração da plataforma nem tenants vê a página "sem acesso administrativo". */
test('usuário sem acesso administrativo', async ({ page }, testInfo) => {
  const user = await createUser('sem-acesso')

  await signIn(page, user)
  await expect(page).toHaveURL(/\/no-access$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Você não tem acesso administrativo' })).toBeVisible()
  await expectAccessible(page, testInfo, 'sem acesso')
})
