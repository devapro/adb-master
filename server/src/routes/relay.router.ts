import { Router, Request, Response } from 'express';
import { getActiveRelayClient } from '../relay/relay-client';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  const client = getActiveRelayClient();
  if (!client) {
    res.json({ data: null });
    return;
  }
  res.json({ data: client.getSessionInfo() });
});

export default router;
