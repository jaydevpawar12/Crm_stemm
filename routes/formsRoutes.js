const express = require('express');
const router = express.Router();
const {
  createForm,
  getAllForms,
  getFormById,
  updateForm,
  deleteForm,
  searchForms,
} = require('../controller/formsController');

router.post('/', createForm);
router.get('/', getAllForms);
router.get('/search', searchForms);
router.get('/:id', getFormById);
router.put('/:id', updateForm);
router.delete('/:id', deleteForm);

module.exports = router;