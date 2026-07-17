import express from 'express';
import cookieParser from 'cookie-parser';

// === Routers =================================================================
//
// =============================================================================
import healthRouter from './routes/health';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import whiteboardsRouter from './routes/whiteboards';
import notificationsRouter from './routes/notifications';

import {
  HEALTH_ROUTE,
  AUTH_ROUTE,
  USERS_ROUTE,
  WHITEBOARDS_ROUTE,
  NOTIFICATIONS_ROUTE,
} from './app.config';

const app = express();

app.use(express.json());
app.use(cookieParser());

// Mount routers
app.use(HEALTH_ROUTE, healthRouter);
app.use(AUTH_ROUTE, authRouter);
app.use(USERS_ROUTE, usersRouter);
app.use(WHITEBOARDS_ROUTE, whiteboardsRouter);
app.use(NOTIFICATIONS_ROUTE, notificationsRouter);

export default app;
