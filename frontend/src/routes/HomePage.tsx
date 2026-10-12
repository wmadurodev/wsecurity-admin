import { ShieldCheck } from 'lucide-react'

/** Página inicial provisória (prompt 01). Layout, sessão e navegação entram nos prompts 03 e 05. */
export function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <ShieldCheck aria-hidden="true" className="size-12" />
      <h1 className="text-3xl font-semibold tracking-tight">wsecurity · Administração</h1>
      <p className="text-muted-foreground">Console de administração do wsecurity.</p>
    </main>
  )
}
