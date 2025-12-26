import compression from "compression";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { chatRouter } from "./routes/chat.route";
import { assignmentRouter } from "./routes/assignment.route";
import { dashboardRouter } from "./routes/dashboard.route";
import { systemMonitor } from "./dashboard/systemMonitor";
import { telemetryStore } from "./dashboard/telemetryStore";
import { logger } from "./utils/logger";

export class HttpError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/health"
      }
    })
  );

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, cb) => {
        const allowed = process.env.CORS_ORIGIN;
        if (!allowed) return cb(null, true);
        if (!origin) return cb(null, true);
        const allowedList = allowed.split(",").map((s) => s.trim());
        return cb(null, allowedList.includes(origin));
      },
      credentials: true
    })
  );

  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 60,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const url = req.originalUrl;

      const module = url.startsWith("/api/chat")
        ? "chat"
        : url.startsWith("/api/assignment")
          ? "assignment"
          : url.startsWith("/api/dashboard")
            ? "dashboard"
            : url.startsWith("/health")
              ? "health"
              : "other";

      systemMonitor.recordRequest({
        timestamp: Date.now(),
        durationMs,
        status: res.statusCode,
        module
      });
    });

    next();
  });

  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

  app.use("/api/chat", chatRouter);
  app.use("/api/assignment", assignmentRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use((_req, _res, next) => {
    next(new HttpError(404, "Not found"));
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = req.id ?? req.header("x-request-id") ?? undefined;

    if (err instanceof HttpError) {
      req.log.warn({ err, requestId }, "request_error");

      if (err.status >= 500) {
        void telemetryStore
          .record({
            kind: "system_error",
            timestamp: new Date().toISOString(),
            endpoint: req.originalUrl,
            status: err.status,
            message: err.message
          })
          .catch(() => undefined);
      }

      return res.status(err.status).json({
        ok: false,
        error: {
          message: err.message,
          status: err.status,
          request_id: requestId
        }
      });
    }

    req.log.error({ err, requestId }, "unhandled_error");

    void telemetryStore
      .record({
        kind: "system_error",
        timestamp: new Date().toISOString(),
        endpoint: req.originalUrl,
        status: 500,
        message: "Internal server error"
      })
      .catch(() => undefined);

    return res.status(500).json({
      ok: false,
      error: {
        message: "Internal server error",
        status: 500,
        request_id: requestId
      }
    });
  });

  return app;
};
