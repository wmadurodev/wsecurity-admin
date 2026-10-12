import { Check, Copy, KeyRound } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * Exibe um segredo gerado pela API uma única vez (RN-05). O valor fica só nas props deste componente: não vai para o
 * cache do TanStack Query, estado global ou armazenamento do navegador. Ao concluir, quem usa descarta o valor.
 */
export function CopyOnceSecret({ label, secret, onDone }: { label: string; secret: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Alert variant="warning">
      <KeyRound aria-hidden="true" />
      <AlertTitle>{label}</AlertTitle>
      <AlertDescription>
        <p>Copie e guarde este valor agora. Ele não será exibido de novo.</p>
        <code className="block w-full rounded border bg-background px-2 py-1 font-mono text-sm break-all text-foreground">
          {secret}
        </code>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button size="sm" onClick={onDone}>
            Já guardei
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
