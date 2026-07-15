import { Router } from "express";
import {
  handleLogin,
} from "../controllers/auth";

import {
  globalRateLimiter,
} from '../middleware/rateLimit';

const router = Router();

// -- apply rate limiting
router.use(globalRateLimiter);

router.post("/login", handleLogin);

export default router;
