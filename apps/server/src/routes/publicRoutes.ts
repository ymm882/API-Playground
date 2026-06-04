import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAppConfig, getTemplateById, listEnabledModels, listTemplates } from "../db/database.js";
import { callUpstream } from "../proxy/proxyAdapter.js";
import { validateBaseUrl } from "../security/validateBaseUrl.js";
import { runTemplate } from "../templates/templateRunner.js";

const validateBaseUrlBodySchema = z.object({
  base_url: z.string().min(1)
});

const proxyBodySchema = z
  .object({
    base_url: z.string().min(1),
    api_key: z.string().min(1),
    model: z.string().min(1),
    payload: z.record(z.unknown()).default({})
  })
  .strict();

const videoTaskBodySchema = z
  .object({
    base_url: z.string().min(1),
    api_key: z.string().min(1),
    task_id: z.string().min(1)
  })
  .strict();

const runTemplateBodySchema = z
  .object({
    base_url: z.string().min(1),
    api_key: z.string().min(1),
    model_id: z.string().min(1),
    params: z.record(z.unknown()).default({})
  })
  .strict();

const queryTaskTemplateBodySchema = z
  .object({
    base_url: z.string().min(1),
    api_key: z.string().min(1),
    model_id: z.string().min(1),
    task_id: z.string().min(1)
  })
  .strict();

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => {
    return {
      ok: true,
      name: "多元探索 API Playground",
      time: new Date().toISOString()
    };
  });

  app.get("/api/models", async () => {
    return {
      data: listEnabledModels()
    };
  });

  app.get("/api/templates", async () => {
    return {
      data: listTemplates(false)
    };
  });

  app.get("/api/templates/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const template = getTemplateById(params.id);
    if (!template?.enabled) return reply.code(404).send({ ok: false, message: "模板不存在或已禁用" });
    return { data: template };
  });

  app.post("/api/validate-base-url", async (request, reply) => {
    const parsed = validateBaseUrlBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: "请输入正确的 HTTPS API 地址",
        debug: parsed.error.flatten()
      });
    }

    try {
      const origin = validateBaseUrl(parsed.data.base_url, getAppConfig());
      return {
        ok: true,
        origin,
        message: "站点校验通过，可以开始测试"
      };
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "请输入正确的 HTTPS API 地址",
        debug: error instanceof Error ? error.message : error
      });
    }
  });

  app.post("/api/run-template", async (request, reply) => {
    const parsed = runTemplateBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, message: "请求参数不完整", debug: parsed.error.flatten() });

    const result = await runTemplate({
      baseUrl: parsed.data.base_url,
      apiKey: parsed.data.api_key,
      modelId: parsed.data.model_id,
      params: parsed.data.params
    });

    return reply.code(result.statusCode).send(result);
  });

  app.post("/api/query-task-template", async (request, reply) => {
    const parsed = queryTaskTemplateBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, message: "请求参数不完整", debug: parsed.error.flatten() });

    const result = await runTemplate({
      baseUrl: parsed.data.base_url,
      apiKey: parsed.data.api_key,
      modelId: parsed.data.model_id,
      taskId: parsed.data.task_id,
      params: {}
    });

    return reply.code(result.statusCode).send(result);
  });

  app.post("/api/proxy/chat", async (request, reply) => {
    const parsed = proxyBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: "请求参数不完整",
        debug: parsed.error.flatten()
      });
    }

    const payload = {
      ...parsed.data.payload,
      model: parsed.data.model
    };
    const result = await callUpstream({
      baseUrl: parsed.data.base_url,
      apiKey: parsed.data.api_key,
      endpointType: "chat",
      payload,
      timeoutMs: 120_000
    });

    return reply.code(result.statusCode).send(result);
  });

  app.post("/api/proxy/image", async (request, reply) => {
    const parsed = proxyBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: "请求参数不完整",
        debug: parsed.error.flatten()
      });
    }

    const payload = {
      ...parsed.data.payload,
      model: parsed.data.model
    };
    const result = await callUpstream({
      baseUrl: parsed.data.base_url,
      apiKey: parsed.data.api_key,
      endpointType: "image_generation",
      payload,
      timeoutMs: 180_000
    });

    return reply.code(result.statusCode).send(result);
  });

  app.post(
    "/api/proxy/video",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const parsed = proxyBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          message: "请求参数不完整",
          debug: parsed.error.flatten()
        });
      }

      const payload = {
        ...parsed.data.payload,
        model: parsed.data.model
      };
      const result = await callUpstream({
        baseUrl: parsed.data.base_url,
        apiKey: parsed.data.api_key,
        endpointType: "video_generation_async",
        payload,
        timeoutMs: 120_000
      });

      return reply.code(result.statusCode).send(result);
    }
  );

  app.post("/api/proxy/video-task", async (request, reply) => {
    const parsed = videoTaskBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: "请求参数不完整",
        debug: parsed.error.flatten()
      });
    }

    const result = await callUpstream({
      baseUrl: parsed.data.base_url,
      apiKey: parsed.data.api_key,
      endpointType: "video_task_query",
      taskId: parsed.data.task_id,
      timeoutMs: 30_000
    });

    return reply.code(result.statusCode).send(result);
  });
}
