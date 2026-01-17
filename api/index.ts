import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { serveStatic } from "../server/vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize the app
let initialized = false;

async function initializeApp() {
  if (!initialized) {
    await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Always serve static files in production
    serveStatic(app);
    initialized = true;
  }
}

// Vercel serverless function handler
export default async function handler(req: Request, res: Response) {
  await initializeApp();
  return app(req, res);
}
