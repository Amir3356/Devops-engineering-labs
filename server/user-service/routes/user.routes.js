import express from 'express';
import userController from '../controllers/user.controller.js';
import { requireAuth, requireAdminRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public Authentication
router.post('/register', (req, res) => userController.register(req, res));
router.post('/login', (req, res) => userController.login(req, res));
router.post('/logout', (req, res) => userController.logout(req, res));

// Protected Customer/Admin Profile
router.get('/profile', requireAuth, (req, res) => userController.getProfile(req, res));
router.put('/profile', requireAuth, (req, res) => userController.updateProfile(req, res));

// Protected Admin Management
router.get('/customers', requireAuth, requireAdminRole, (req, res) => userController.getAllCustomers(req, res));
router.get('/:id', requireAuth, (req, res) => userController.getUserById(req, res));

export default router;
