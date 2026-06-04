import { getAppConfig, getModelById, getTemplateById } from "../db/database.js";
import { translateProxyError, translateUpstreamError } from "../proxy/errorTranslator.js";
import { assertPublicHostname } from "../security/networkGuard.js";
import { HTTPS_URL_INVALID_MESSAGE, validateBaseUrl } from "../security/validateBaseUrl.js";
import { parseResponseByTemplate, renderPath, renderTemplate } from "./templateEngine.js";

type RunTemplateInput = {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  params: Record<string, unknown>;
  taskId?: string;
};

export async function runTemplate(input: RunTemplateInput) {
  try {
    assertOriginOnly(input.baseUrl);
    const origin = validateBaseUrl(input.baseUrl, getAppConfig());
    await assertPublicHostname(new URL(origin).hostname);

    const model = getModelById(input.modelId);
    if (!model?.enabled) throw new Error("模型不存在或已禁用");

    const template = model.template_id ? getTemplateById(model.template_id) : undefined;
    if (!template?.enabled) throw new Error("模板不存在或已禁用");

    const rendered = renderTemplate(template, model, input.params, input.apiKey, { skipRequired: Boolean(input.taskId) });
    const path = input.taskId
      ? renderPath(template.task_query_path ?? "", { ...rendered.params, task_id: input.taskId, model: model.id })
      : renderPath(template.path, { ...rendered.params, model: model.id });
    const url = `${origin}${path}`;
    const response = await fetch(url, {
      method: input.taskId ? "GET" : template.method,
      headers: {
        ...rendered.headers,
        "Content-Type": "application/json"
      },
      body: input.taskId || template.method === "GET" ? undefined : JSON.stringify(rendered.body ?? {})
    });
    const raw = await readResponse(response);

    if (!response.ok) {
      const translated = translateUpstreamError(response.status, raw);
      return { ok: false, statusCode: translated.statusCode, message: translated.message, debug: translated.debug };
    }

    return {
      ok: true,
      statusCode: 200,
      data: parseResponseByTemplate(raw, template.response_parser),
      request: {
        method: input.taskId ? "GET" : template.method,
        path,
        headers: maskHeaders(rendered.headers),
        body: input.taskId ? undefined : rendered.body
      },
      template,
      model
    };
  } catch (error) {
    const translated = translateProxyError(error);
    return { ok: false, statusCode: translated.statusCode, message: translated.message, debug: translated.debug };
  }
}

function assertOriginOnly(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(HTTPS_URL_INVALID_MESSAGE);
  }
  if (url.pathname !== "/" || url.search || url.hash) throw new Error(HTTPS_URL_INVALID_MESSAGE);
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function maskHeaders(headers: Record<string, string>) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, key.toLowerCase() === "authorization" ? "Bearer {{API_KEY}}" : value]));
}
