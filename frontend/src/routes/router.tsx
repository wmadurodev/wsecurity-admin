import { createBrowserRouter } from 'react-router'

import { HomePage } from './HomePage'

export const routes = [{ path: '*', element: <HomePage /> }]

export function createRouter() {
  return createBrowserRouter(routes)
}
