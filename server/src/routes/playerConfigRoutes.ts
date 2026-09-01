import { Router } from "express";
import {
  getPlayerConfig,
  createPlayerConfig,
  updatePlayerConfig,
  deletePlayerConfig,
} from "../controllers/playerConfigControllers";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES }        from "../constants/roles";

const router = Router();

router.use(authenticate);

// GET is deliberately NOT admin-gated: the player client fetches this at every
// bootstrap with its own team token.
router.get("/:simulationTypeId", getPlayerConfig);

router.post("/",      authorize([ROLES.ADMIN]), createPlayerConfig);
router.patch("/:id",  authorize([ROLES.ADMIN]), updatePlayerConfig);
router.delete("/:id", authorize([ROLES.ADMIN]), deletePlayerConfig);

export default router;
