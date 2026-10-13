import { z } from 'zod'

// Sem o JIT do zod (`new Function`): a CSP sem unsafe-eval o bloqueia e registraria uma violação (RNF-SEG-04).
// Importado primeiro em main.tsx, antes de qualquer esquema.
z.config({ jitless: true })
