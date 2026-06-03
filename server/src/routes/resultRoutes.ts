import { Router } from 'express';
import { getResults } from '../controllers/resultControllers';

const router = Router();

// Route for getting combined results
router.get('/', getResults);

export default router;