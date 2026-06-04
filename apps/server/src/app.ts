import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { initDatabase } from "./db/database.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";
import { registerPublicRoutes } from "./routes/publicRoutes.js";

export async function buildApp() {
  initDatabase();

  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  await app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute"
  });

  await registerPublicRoutes(app);
  await registerAdminRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 500;
    const message = error instanceof Error ? error.message : "Unknown error";

    reply.code(Number.isFinite(statusCode) ? statusCode : 500).send({
      ok: false,
      message: "服务暂时不可用，请稍后重试",
      debug: message
    });
  });

  return app;
}
