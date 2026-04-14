const express = require('express');
const router = express.Router();
const { login, adminResetPassword, changePassword, verifyToken } = require('../controllers/authentification_controller');

router.post('/login', login);
router.post('/admin-reset-password', verifyToken, adminResetPassword);
router.post('/change-password', verifyToken, changePassword);


module.exports = router;
