import express from 'express';
import { getAllEvents, createEvent, getEventBySimulationIdOrName, updateEvent, deleteEvent, getEventById } from '../controllers/eventControllers';
import { authenticate } from '../utils/middleware/authentication';
import { authorize } from '../utils/middleware/authorization';

const router = express.Router();

// Routes for managing events
router.get('/', getAllEvents); // Get all events with pagination and filtering
router.post('/', authenticate, authorize(['admin']), createEvent); // Create a new event
router.get('/:eventId', getEventById);
router.put('/:eventId', authenticate, authorize(['admin']), updateEvent); // Update an event by eventId
// router.get('/:simulationIdOrName', getEventBySimulationIdOrName); // Get events by simulationId or simulationName
// router.put('/:eventName', updateEvent); // Update an event by eventName
router.delete('/:eventName', deleteEvent); // Delete an event by eventName

export default router;
