import express from 'express';
import cookieParser from 'cookie-parser';

import {
  HEALTH_ROUTE,
  AUTH_ROUTE,
  USERS_ROUTE,
  WHITEBOARDS_ROUTE,
  NOTIFICATIONS_ROUTE,
} from './app.config';

import {
  doubleCsrfProtection,
} from './services/antiCsrfService';

// === Routers =================================================================
//
// =============================================================================
import healthRouter from './routes/health';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import whiteboardsRouter from './routes/whiteboards';
import notificationsRouter from './routes/notifications';

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(doubleCsrfProtection);

// Mount routers
app.use(HEALTH_ROUTE, healthRouter);
app.use(AUTH_ROUTE, authRouter);
app.use(USERS_ROUTE, usersRouter);
app.use(WHITEBOARDS_ROUTE, whiteboardsRouter);
app.use(NOTIFICATIONS_ROUTE, notificationsRouter);

export default app;
