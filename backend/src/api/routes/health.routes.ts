import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();

router.get('/health', HealthController.liveness);
router.get('/ready', HealthController.readiness);
router.get('/metrics', HealthController.metrics);

export default router;
