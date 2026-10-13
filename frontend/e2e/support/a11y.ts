import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'

/**
 * Acessibilidade da tela atual (RNF-UX-02): WCAG 2.2 AA pelo axe, sem violações sérias ou críticas. O resultado
 * completo vai anexado ao relatório.
 */
export async function expectAccessible(page: Page, testInfo: TestInfo, screen: string): Promise<void> {
  // Com uma transição em curso (ex.: o toast entrando com opacidade), o axe mediria cores intermediárias.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'))
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  await testInfo.attach(`axe: ${screen}`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  })
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => `${node.target.join(' ')} — ${node.any[0]?.message ?? node.failureSummary ?? ''}`)
          .join(' | ')}`,
    )
  expect(serious, `violações de acessibilidade em ${screen}`).toEqual([])
}
