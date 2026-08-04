import {
  Request,
  Response,
} from 'express';

// === Health Check ============================================================
//
// Basic check to ensure service is running.
//
// =============================================================================
export const getHealthCheck = (
  _req: Request,
  res: Response
) => {
  res.status(200).json({
    message: "service healthy"
  });
};// -- end getHealthCheck
