const express = require('express');
const router = express.Router();
const { getUsers,  getUsersByEmail,  createUser,  updateUserByEmail,  deleteUserByEmail } = require('../controllers/users_controller');
const { verifyToken } = require('../controllers/authentification_controller');

router.get('/', verifyToken, getUsers);
router.post('/', createUser);
router.get('/:email', getUsersByEmail);
router.put('/:email', verifyToken, updateUserByEmail);
router.delete('/:email', verifyToken, deleteUserByEmail);

module.exports = router;
