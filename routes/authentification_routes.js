const express = require('express');
const router = express.Router();
const { login, forgotPassword, resetPassword, adminResetPassword, verifyToken } = require('../controllers/authentification_controller');

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/admin-reset-password', verifyToken, adminResetPassword);


module.exports = router;
