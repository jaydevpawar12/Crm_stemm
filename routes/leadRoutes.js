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
router.get('/company/:companyId', controller.getLeadsByCompanyId);
router.get('/status/:companyId', controller.getLeadStatusCountsByCompanyId);


module.exports = router;
