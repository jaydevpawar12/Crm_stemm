const express = require('express');
const router = express.Router();
const {
  createEmailTemplate,
  getAllEmailTemplates,
  getEmailTemplateById,
  updateEmailTemplate,
  deleteEmailTemplate,
} = require('../controllers/emailTemplatesController');

router.post('/', createEmailTemplate);
router.get('/', getAllEmailTemplates);
router.get('/:id', getEmailTemplateById);
router.put('/:id', updateEmailTemplate);
router.delete('/:id', deleteEmailTemplate);

module.exports = router;