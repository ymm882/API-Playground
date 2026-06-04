import { endpointMap } from "./endpointMap.js";
import { translateProxyError, translateUpstreamError } from "./errorTranslator.js";
import { getAppConfig } from "../db/database.js";
import { assertPublicHostname } from "../security/networkGuard.js";
import { HTTPS_URL_INVALID_MESSAGE, validateBaseUrl } from "../security/validateBaseUrl.js";
import type { EndpointType } from "../types.js";

type ProxyInput = {
  baseUrl: string;
  apiKey: string;
  endpointType: EndpointType;
  payload?: Record<string, unknown>;
  taskId?: string;
  timeoutMs: number;
};

export type ProxyResult = {
  ok: boolean;
  statusCode: number;
  data?: unknown;
  message?: string;
  debug?: unknown;
};

export async function callUpstream(input: ProxyInput): Promise<ProxyResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    assertOriginOnly(input.baseUrl);
    const origin = validateBaseUrl(input.baseUrl, getAppConfig());
    await assertPublicHostname(new URL(origin).hostname);
    const endpoint = buildEndpoint(input.endpointType, input.taskId);
    const targetUrl = `${origin}${endpoint}`;
    const response = await fetch(targetUrl, {
      method: input.endpointType === "video_task_query" ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json"
      },
      body: input.endpointType === "video_task_query" ? undefined : JSON.stringify(input.payload ?? {}),
      signal: controller.signal
    });

    const data = await readResponse(response);

    if (!response.ok) {
      const translated = translateUpstreamError(response.status, data);
      return {
        ok: false,
        statusCode: translated.statusCode,
        message: translated.message,
        debug: translated.debug
      };
    }

    return {
      ok: true,
      statusCode: 200,
      data
    };
  } catch (error) {
    const translated = translateProxyError(error);
    return {
      ok: false,
      statusCode: translated.statusCode,
      message: translated.message,
      debug: translated.debug
    };
  } finally {
    clearTimeout(timeout);
  }
}

function assertOriginOnly(input: string) {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(HTTPS_URL_INVALID_MESSAGE);
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(HTTPS_URL_INVALID_MESSAGE);
  }
}

function buildEndpoint(endpointType: EndpointType, taskId?: string) {
  const template = endpointMap[endpointType];

  if (endpointType === "video_task_query") {
    if (!taskId) {
      throw new Error("缺少 task_id");
    }

    return template.replace("{task_id}", encodeURIComponent(taskId));
  }

  return template;
}

async function readResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
