const express = require('express');
const router = express.Router();
const controller = require('../controller/enquiryCategoryController');

router.post('/', controller.createEnquiryCategory);
router.get('/', controller.getAllEnquiryCategories);
router.get('/:id', controller.getEnquiryCategoryById);
router.put('/:id', controller.updateEnquiryCategory);
router.delete('/:id', controller.deleteEnquiryCategory);

module.exports = router;
