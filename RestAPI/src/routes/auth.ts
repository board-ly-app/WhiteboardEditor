import { Router } from "express";
import {
  handleLogin,
  handleLogout,
  handleRefreshAccessToken,
} from "../controllers/auth";

import {
  authRateLimiter,
} from '../middleware/rateLimit';

const router = Router();

// -- Exempt the following routes from auth-specific rate limiting ---

// -- Clear cookies, including refresh token
router.post('/logout', handleLogout);

// -- Apply auth-specific rate limiting for the routes below
router.use(authRateLimiter);

// -- Authenticate with username/email and password, receiving both refresh
// token and access token
router.post("/login", handleLogin);

// -- Request a new access token, given a valid refresh token.
router.post('/refresh', handleRefreshAccessToken);

export default router;
