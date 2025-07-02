const express = require('express');
const router = express.Router();
const controller = require('../controller/customerCategoryController');

router.post('/', controller.createCustomerCategory);
router.get('/', controller.getAllCustomerCategories);
router.get('/:id', controller.getCustomerCategoryById);
router.put('/:id', controller.updateCustomerCategory);
router.patch('/:id', controller.patchCustomerCategory);
router.delete('/:id', controller.deleteCustomerCategory);

module.exports = router;