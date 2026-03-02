const express = require('express');
const router = express.Router();
const { getUsers,  getUsersByEmail,  createUser,  updateUserByEmail,  deleteUserByEmail } = require('../controllers/users_controller');

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:email', getUsersByEmail);
router.put('/:email', updateUserByEmail);
router.delete('/:email', deleteUserByEmail);

module.exports = router;
