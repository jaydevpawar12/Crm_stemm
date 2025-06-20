const express = require('express');
const router = express.Router();
const {
  createSendEmail,
  getAllSendEmails,
  getSendEmailById,
  updateSendEmail,
  deleteSendEmail,
} = require('../controllers/sendEmailsController');

router.post('/', createSendEmail);
router.get('/', getAllSendEmails);
router.get('/:id', getSendEmailById);
router.put('/:id', updateSendEmail);
router.delete('/:id', deleteSendEmail);

module.exports = router;
