const express = require('express');
const router = express.Router();
const interactionController = require('../controller/interactionController');

// Create a new interaction
router.post('/interactions', interactionController.createInteraction);

// Get all interactions with optional filters
router.get('/interactions', interactionController.getAllInteractions);

// Get a specific interaction by ID
router.get('/interactions/:id', interactionController.getInteractionById);

// Update an interaction (full update)
router.put('/interactions/:id', interactionController.updateInteraction);

// Update an interaction (partial update)
router.patch('/interactions/:id', interactionController.patchInteraction);

// Delete an interaction
router.delete('/interactions/:id', interactionController.deleteInteraction);

module.exports = router;