import express from 'express';
import authController from '../controllers/auth.controller.js';
import { validateBody, authRegisterSchema, authLoginSchema } from '../../utils/validation.js';

const router = express.Router();

router.post('/register', validateBody(authRegisterSchema), (req, res) => authController.register(req, res));
router.post('/login', validateBody(authLoginSchema), (req, res) => authController.login(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/verify', (req, res) => authController.verify(req, res));

export default router;
