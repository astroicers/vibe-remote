import { Router } from 'express';
import { MODELS, DEFAULT_MODEL_KEY } from '../ai/models.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ models: MODELS, default: DEFAULT_MODEL_KEY });
});

export default router;
