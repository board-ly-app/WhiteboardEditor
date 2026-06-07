import cors from 'cors';
import express from 'express';

// === Routers =================================================================
//
// =============================================================================
import healthRouter from './routes/health';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import whiteboardsRouter from './routes/whiteboards';
import notificationsRouter from './routes/notifications';

const API_VERSION = 'v1';

const app = express();

app.use(cors());
app.use(express.json());

// Mount routers
app.use(`/api/${API_VERSION}/health`, healthRouter);
app.use(`/api/${API_VERSION}/users`, usersRouter);
app.use(`/api/${API_VERSION}/auth`, authRouter);
app.use(`/api/${API_VERSION}/whiteboards`, whiteboardsRouter);
app.use(`/api/${API_VERSION}/notifications`, notificationsRouter);

export default app;
