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

// -- Authenticate with username/email and password, receiving both refresh
// token and access token
router.post("/login", handleLogin);

export default router;
