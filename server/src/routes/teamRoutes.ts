import express from 'express';
import { 
  getAllTeams, 
  createTeam, 
  getTeamsBySimulationIdAndName, 
  updateTeam, 
  deleteTeam, 
  updateOwnTeam,
  getTeamProjections,
} from '../controllers/teamControllers';
import { authenticate } from '../utils/middleware/authentication';
import { authorize } from '../utils/middleware/authorization';

const router = express.Router();

// Routes for managing teams
router.get('/', getAllTeams); // Get all teams with pagination and filtering
router.post('/', createTeam); // Create a new team
router.put('/me', authenticate, authorize(['team']), updateOwnTeam);
router.get('/:simulationIdOrName', getTeamsBySimulationIdAndName); // Get teams by simulationId or simulationName
router.put('/:simulationId/:teamName', updateTeam); // Update a team by simulationId and teamName
router.delete('/:simulationId/:teamName', deleteTeam); // Delete a team by simulationId and teamName
router.get('/:teamId/projections', authenticate, authorize(['admin']), getTeamProjections);

export default router;
