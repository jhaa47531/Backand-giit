import serverless from 'serverless-http';
import { createBackendApp } from '../../backend/src/app';

let serverlessHandler: any = null;

export const handler = async (event: any, context: any) => {
  if (!serverlessHandler) {
    const app = await createBackendApp();
    serverlessHandler = serverless(app);
  }
  return serverlessHandler(event, context);
};
