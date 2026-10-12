import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'

import { createQueryClient } from '@/lib/query-client'
import { createRouter } from '@/routes/router'

export function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(createRouter)
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors closeButton />
    </QueryClientProvider>
  )
}
