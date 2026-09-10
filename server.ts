import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createBackendApp } from './backend/src/app';
import { config } from './backend/src/config/env';

async function startServer() {
  const app = await createBackendApp();
  const PORT = config.PORT;

  // Mount Vite middleware or static frontend handler AFTER API routes
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GIIT Fee Management Backend is active on http://0.0.0.0:${PORT}`);
    console.log(`API endpoints accessible at http://0.0.0.0:${PORT}/api`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
