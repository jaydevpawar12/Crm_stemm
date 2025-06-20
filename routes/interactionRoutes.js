const express = require('express');
const router = express.Router();
const interactionController = require('../controller/interactionController');

router.post('/', interactionController.createInteraction);
router.get('/', interactionController.getAllInteractions);
router.get('/:id', interactionController.getInteractionById);
router.put('/:id', interactionController.updateInteraction);
router.delete('/:id', interactionController.deleteInteraction);

module.exports = router;
