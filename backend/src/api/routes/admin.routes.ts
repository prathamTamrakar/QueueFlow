import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Apply administrative authentication middleware to all admin endpoints
router.use(requireAdmin);

router.get('/jobs/failed', AdminController.listFailedJobs);
router.get('/jobs/:id', AdminController.getFailedJobById);
router.post('/jobs/:id/replay', AdminController.replayFailedJob);

export default router;
