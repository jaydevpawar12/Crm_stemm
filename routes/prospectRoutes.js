const express = require('express');
const router = express.Router();
const prospectController = require('../controller/prospectController');

router.post('/', prospectController.createProspect);
router.get('/', prospectController.getAllProspects);
router.get('/:id', prospectController.getProspectById);
router.put('/:id', prospectController.updateProspect);
router.delete('/:id', prospectController.deleteProspect);
router.patch('/customer/:id', prospectController.updateCustomerIdForProspect);

module.exports = router;
