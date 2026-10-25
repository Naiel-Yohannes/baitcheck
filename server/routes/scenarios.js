import { Router } from 'express'

export function createScenariosRouter({ requireAuth, store }) {
  const router = Router()
  router.get('/', requireAuth, (_req, res) => {
    return res.status(200).json({ scenarios: store.listPublic() })
  })
  return router
}
