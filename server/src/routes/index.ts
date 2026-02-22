import { Router } from 'express';
import authRoutes from './auth.js';
import workspaceRoutes from './workspaces.js';
import chatRoutes from './chat.js';
import diffRoutes from './diff.js';
import notificationRoutes from './notifications.js';
import templateRoutes from './templates.js';
import taskRoutes from './tasks.js';
import modelRoutes from './models.js';
import settingsRoutes from './settings.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/chat', chatRoutes);
router.use('/diff', diffRoutes);
router.use('/notifications', notificationRoutes);
router.use('/templates', templateRoutes);
router.use('/tasks', taskRoutes);
router.use('/models', modelRoutes);
router.use('/settings', settingsRoutes);

export default router;
