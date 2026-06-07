import { Router } from "express";
import { login } from "../controllers/auth";

import {
  globalRateLimiter,
} from '../middleware/rateLimit';

const router = Router();

// -- apply rate limiting
router.use(globalRateLimiter);

router.post("/login", login);

export default router;
