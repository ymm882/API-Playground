import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config.js";
import {
  createModel,
  createTemplate,
  deleteModel,
  deleteTemplate,
  getAppConfig,
  listAllModels,
  listTemplates,
  saveAppConfig,
  updateModel,
  updateTemplate
} from "../db/database.js";

const modelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(["openai", "gemini", "claude", "other"]),
  category: z.enum(["text", "image", "video"]),
  invoke_mode: z.enum(["openai_chat", "image_generation", "video_async", "gemini_native_example", "claude_native_example"]),
  endpoint_type: z.enum(["chat", "image_generation", "video_generation_async"]),
  supports_stream: z.boolean().optional(),
  supports_native_example: z.boolean().optional(),
  response_mode: z.enum(["text", "image_url_array", "video_task"]).optional(),
  default_params: z.record(z.unknown()).optional(),
  template_id: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sort_order: z.number().optional(),
  default_params_override: z.record(z.unknown()).optional(),
  enabled: z.boolean()
});

const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["text", "image", "video"]),
  protocol: z.string().min(1),
  method: z.enum(["GET", "POST"]),
  path: z.string().min(1),
  is_async: z.boolean(),
  task_query_path: z.string().optional(),
  headers_template: z.record(z.unknown()).optional(),
  body_template: z.record(z.unknown()).optional(),
  params_schema: z.array(z.record(z.unknown())).optional(),
  default_params: z.record(z.unknown()).optional(),
  response_example: z.record(z.unknown()).optional(),
  response_parser: z.record(z.unknown()).optional(),
  code_templates: z.record(z.unknown()).optional(),
  enabled: z.boolean()
});

const appConfigSchema = z.object({
  allowedDomainSuffixes: z.array(z.string()),
  blockedHosts: z.array(z.string()),
  extraAllowedHosts: z.array(z.string()),
  defaultTextParams: z.object({
    temperature: z.number(),
    max_tokens: z.number()
  }),
  defaultImageParams: z.object({
    size: z.string(),
    n: z.number()
  }),
  defaultVideoParams: z.object({
    duration: z.number(),
    aspect_ratio: z.string(),
    hd: z.boolean()
  })
});

export async function registerAdminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/api/admin")) return;
    return requireAdmin(request, reply);
  });

  app.get("/api/admin/config", async () => ({
    data: getAppConfig()
  }));

  app.post("/api/admin/config", async (request, reply) => {
    const parsed = appConfigSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: "配置格式不正确",
        debug: parsed.error.flatten()
      });
    }

    return {
      ok: true,
      data: saveAppConfig(parsed.data)
    };
  });

  app.get("/api/admin/models", async () => ({
    data: listAllModels()
  }));

  app.get("/api/admin/templates", async () => ({
    data: listTemplates(true)
  }));

  app.post("/api/admin/templates", async (request, reply) => {
    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, message: "模板配置格式不正确", debug: parsed.error.flatten() });
    try {
      return { ok: true, data: createTemplate(parsed.data) };
    } catch (error) {
      return reply.code(409).send({ ok: false, message: "模板 id 已存在", debug: error instanceof Error ? error.message : error });
    }
  });

  app.put("/api/admin/templates/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, message: "模板配置格式不正确", debug: parsed.error.flatten() });
    const updated = updateTemplate(params.id, parsed.data);
    if (!updated) return reply.code(404).send({ ok: false, message: "模板不存在" });
    return { ok: true, data: parsed.data };
  });

  app.delete("/api/admin/templates/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const result = deleteTemplate(params.id);
    if (!result.ok) return reply.code(409).send({ ok: false, message: result.reason ?? "模板不存在" });
    return { ok: true };
  });

  app.post("/api/admin/models", async (request, reply) => {
    const parsed = modelSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: "模型配置格式不正确",
        debug: parsed.error.flatten()
      });
    }

    try {
      return {
        ok: true,
        data: createModel(parsed.data)
      };
    } catch (error) {
      return reply.code(409).send({
        ok: false,
        message: "模型 id 已存在",
        debug: error instanceof Error ? error.message : error
      });
    }
  });

  app.put("/api/admin/models/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const parsed = modelSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: "模型配置格式不正确",
        debug: parsed.error.flatten()
      });
    }

    const updated = updateModel(params.id, parsed.data);

    if (!updated) {
      return reply.code(404).send({
        ok: false,
        message: "模型不存在"
      });
    }

    return {
      ok: true,
      data: parsed.data
    };
  });

  app.delete("/api/admin/models/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const removed = deleteModel(params.id);

    if (!removed) {
      return reply.code(404).send({
        ok: false,
        message: "模型不存在"
      });
    }

    return {
      ok: true
    };
  });
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";

  if (!token || token !== env.adminToken) {
    return reply.code(401).send({
      ok: false,
      message: "未授权"
    });
  }
}
