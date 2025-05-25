const express = require('express');
const router = express.Router();
const controller = require('../controller/customerAdditionContacts.controller');

router.post('/', controller.createContact);
router.get('/customer/:customerId', controller.getContactsByCustomer);
router.get('/:id', controller.getContactById);
router.put('/:id', controller.updateContact);
router.delete('/:id', controller.deleteContact);

module.exports = router;
