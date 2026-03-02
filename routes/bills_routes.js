const express = require('express');
const router = express.Router();
const {   getBills,getBillById,updateBillById,deleteBillById,createBill} = require('../controllers/bills_controller');
const {   verifyToken} = require('../controllers/authentification_controller');
const upload = require('../middlewares/upload')

router.get('/', verifyToken,getBills);
router.post('/', verifyToken, upload.single('proof'),createBill);
router.get('/:id', verifyToken,getBillById);
router.put('/:id', verifyToken,updateBillById);
router.delete('/:id', verifyToken, deleteBillById);

module.exports = router;

