const express = require('express');
const router = express.Router();
const controller = require('../controller/customerTagsController');

router.post('/', controller.createCustomerTag);
router.get('/', controller.getAllCustomerTags);
router.get('/:id', controller.getCustomerTagById);
router.put('/:id', controller.updateCustomerTag);
router.patch('/:id', controller.patchCustomerTag);
router.delete('/:id', controller.deleteCustomerTag);

module.exports = router;