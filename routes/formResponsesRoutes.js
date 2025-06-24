const express = require('express');
const router = express.Router();
const {
  createFormResponse,
  getAllFormResponses,
  getFormResponseById,
  updateFormResponse,
  deleteFormResponse,
} = require('../controller/formResponsesController');

router.post('/', createFormResponse);
router.get('/', getAllFormResponses);
router.get('/:id', getFormResponseById);
router.put('/:id', updateFormResponse);
router.delete('/:id', deleteFormResponse);

module.exports = router;