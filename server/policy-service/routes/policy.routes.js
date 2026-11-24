import express from 'express';
import policyController from '../controllers/policy.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', (req, res) => policyController.getPolicies(req, res));
router.get('/:key', (req, res) => policyController.getPolicy(req, res));
router.put('/:key', requireAuth, requireAdmin, (req, res) => policyController.updatePolicy(req, res));
router.delete('/:key', requireAuth, requireAdmin, (req, res) => policyController.resetPolicy(req, res));

export default router;
