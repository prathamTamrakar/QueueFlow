import { Router } from 'express';
import { JobsController } from '../controllers/jobs.controller';

const router = Router();

router.post('/', JobsController.create);
router.get('/', JobsController.list);
router.get('/:id', JobsController.getById);
router.get('/:id/result', JobsController.getResult);
router.post('/:id/cancel', JobsController.cancel);

export default router;
