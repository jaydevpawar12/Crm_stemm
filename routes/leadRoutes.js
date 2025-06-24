// leads/leadRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controller/leadController');

router.post('/', controller.createLead);
router.get('/', controller.getAllLeads);
router.get('/:id', controller.getLeadById);
router.put('/:id', controller.updateLead);
router.patch('/:id', controller.patchLead);
router.delete('/:id', controller.deleteLead);
router.get('/company/:companyid', controller.getLeadsByCompanyId);


module.exports = router;
