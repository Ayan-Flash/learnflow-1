import "dotenv/config";

import { createApp } from "./app";
import { logger } from "./utils/logger";

const port = Number(process.env.PORT ?? 8080);

const app = createApp();

const server = app.listen(port, () => {
  logger.info({ port, env: process.env.NODE_ENV ?? "development" }, "server_listening");
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "server_shutdown_start");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "server_shutdown_error");
      process.exitCode = 1;
      return process.exit();
    }
    logger.info("server_shutdown_complete");
    process.exit();
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
