import { Router } from 'express';
import { QueuesController } from '../controllers/queues.controller';

const router = Router();

router.get('/stats', QueuesController.getStats);

export default router;
