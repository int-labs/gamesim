import express from 'express';
import { createProjections, getLatestProjection, getPrevRoundProjections, getProjectionsByDecisionId, getProjections, getLatestCombinedKPI, getCurrentRoundProjection } from '../controllers/projectionControllers';
import { authenticate } from '../utils/middleware/authentication';
import { authorize } from '../utils/middleware/authorization';

const router = express.Router();

router.post('/', createProjections);
router.get('', authenticate, authorize(['team']), getProjections);
router.get('/latest', authenticate, authorize(['team']), getLatestProjection);
router.get('/latest/combined-kpi', authenticate, authorize(['team']), getLatestCombinedKPI);
router.get('/previous-round', authenticate, authorize(['team']), getPrevRoundProjections);
router.get('/current-round', authenticate, authorize(['team']), getCurrentRoundProjection);
router.get('/:decisionId', getProjectionsByDecisionId);

export default router;
