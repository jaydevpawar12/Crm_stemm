const express = require('express');
const router = express.Router();
const {
  createFormField,
  getAllFormFields,
  getFormFieldById,
  updateFormField,
  deleteFormField,
} = require('../controllers/formFieldsController');

router.post('/', createFormField);
router.get('/', getAllFormFields);
router.get('/:id', getFormFieldById);
router.put('/:id', updateFormField);
router.delete('/:id', deleteFormField);

module.exports = router;