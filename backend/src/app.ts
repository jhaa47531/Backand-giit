import express, { Express } from 'express';
import cors from 'cors';
import apiRoutes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { Database } from './db/database';

export async function createBackendApp(): Promise<Express> {
  // Ensure relational database is initialized
  await Database.init();

  const app = express();

  // Middleware configuration
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API router
  app.use('/api', apiRoutes);

  // Global error handler
  app.use(errorHandler);

  return app;
}
