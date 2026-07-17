import { Router } from "express";
import {
  handleLogin,
  handleLogout,
  handleRefreshAccessToken,
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

// -- Clear cookies, including refresh token
router.post('/logout', handleLogout);

// -- Request a new access token, given a valid refresh token.
router.post('/refresh', handleRefreshAccessToken);

export default router;
