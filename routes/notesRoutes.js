const express = require('express');
const router = express.Router();
const {
  createNote,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
  patchNote,
  getNotesByLeadId
} = require('../controller/notesController');

router.post('/', createNote);
router.get('/', getAllNotes);
router.get('/:id', getNoteById);
router.get('/lead/:leadId',getNotesByLeadId);
router.put('/:id', updateNote);
router.patch('/:id',patchNote);
router.delete('/:id', deleteNote);

module.exports = router;