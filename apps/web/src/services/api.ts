import type { ApiTemplate, AppConfig, ModelConfig, ProxyResponse, TemplateRunData, ValidateBaseUrlResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  const data = (await response.json()) as T;

  if (!response.ok) {
    throw data;
  }

  return data;
}

export async function fetchModels() {
  const response = await requestJson<{ data: ModelConfig[] }>("/api/models");
  return response.data;
}

export async function fetchTemplates() {
  const response = await requestJson<{ data: ApiTemplate[] }>("/api/templates");
  return response.data;
}

export async function validateBaseUrl(baseUrl: string) {
  return requestJson<ValidateBaseUrlResponse>("/api/validate-base-url", {
    method: "POST",
    body: JSON.stringify({
      base_url: baseUrl
    })
  });
}

export type ProxyRequest = {
  baseUrl: string;
  apiKey: string;
  model: string;
  payload: Record<string, unknown>;
};

export async function proxyChat(input: ProxyRequest) {
  return requestJson<ProxyResponse>("/api/proxy/chat", {
    method: "POST",
    body: JSON.stringify({
      base_url: input.baseUrl,
      api_key: input.apiKey,
      model: input.model,
      payload: input.payload
    })
  });
}

export async function proxyImage(input: ProxyRequest) {
  return requestJson<ProxyResponse>("/api/proxy/image", {
    method: "POST",
    body: JSON.stringify({
      base_url: input.baseUrl,
      api_key: input.apiKey,
      model: input.model,
      payload: input.payload
    })
  });
}

export async function proxyVideo(input: ProxyRequest) {
  return requestJson<ProxyResponse>("/api/proxy/video", {
    method: "POST",
    body: JSON.stringify({
      base_url: input.baseUrl,
      api_key: input.apiKey,
      model: input.model,
      payload: input.payload
    })
  });
}

export async function proxyVideoTask(input: { baseUrl: string; apiKey: string; taskId: string }) {
  return requestJson<ProxyResponse>("/api/proxy/video-task", {
    method: "POST",
    body: JSON.stringify({
      base_url: input.baseUrl,
      api_key: input.apiKey,
      task_id: input.taskId
    })
  });
}

export async function runTemplate(input: { baseUrl: string; apiKey: string; modelId: string; params: Record<string, unknown> }) {
  return requestJson<ProxyResponse<TemplateRunData> & { request?: unknown; template?: ApiTemplate; model?: ModelConfig }>("/api/run-template", {
    method: "POST",
    body: JSON.stringify({
      base_url: input.baseUrl,
      api_key: input.apiKey,
      model_id: input.modelId,
      params: input.params
    })
  });
}

export async function queryTaskTemplate(input: { baseUrl: string; apiKey: string; modelId: string; taskId: string }) {
  return requestJson<ProxyResponse<TemplateRunData> & { request?: unknown; template?: ApiTemplate; model?: ModelConfig }>("/api/query-task-template", {
    method: "POST",
    body: JSON.stringify({
      base_url: input.baseUrl,
      api_key: input.apiKey,
      model_id: input.modelId,
      task_id: input.taskId
    })
  });
}

function adminHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function fetchAdminConfig(token: string) {
  const response = await requestJson<{ data: AppConfig }>("/api/admin/config", {
    headers: adminHeaders(token)
  });
  return response.data;
}

export async function saveAdminConfig(token: string, config: AppConfig) {
  const response = await requestJson<{ data: AppConfig }>("/api/admin/config", {
    method: "POST",
    headers: adminHeaders(token),
    body: JSON.stringify(config)
  });
  return response.data;
}

export async function fetchAdminModels(token: string) {
  const response = await requestJson<{ data: ModelConfig[] }>("/api/admin/models", {
    headers: adminHeaders(token)
  });
  return response.data;
}

export async function fetchAdminTemplates(token: string) {
  const response = await requestJson<{ data: ApiTemplate[] }>("/api/admin/templates", {
    headers: adminHeaders(token)
  });
  return response.data;
}

export async function createAdminTemplate(token: string, template: ApiTemplate) {
  return requestJson<{ data: ApiTemplate }>("/api/admin/templates", {
    method: "POST",
    headers: adminHeaders(token),
    body: JSON.stringify(template)
  });
}

export async function updateAdminTemplate(token: string, id: string, template: ApiTemplate) {
  return requestJson<{ data: ApiTemplate }>(`/api/admin/templates/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: adminHeaders(token),
    body: JSON.stringify(template)
  });
}

export async function deleteAdminTemplate(token: string, id: string) {
  return requestJson<{ ok: boolean }>(`/api/admin/templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: adminHeaders(token)
  });
}

export async function createAdminModel(token: string, model: ModelConfig) {
  return requestJson<{ data: ModelConfig }>("/api/admin/models", {
    method: "POST",
    headers: adminHeaders(token),
    body: JSON.stringify(model)
  });
}

export async function updateAdminModel(token: string, id: string, model: ModelConfig) {
  return requestJson<{ data: ModelConfig }>(`/api/admin/models/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: adminHeaders(token),
    body: JSON.stringify(model)
  });
}

export async function deleteAdminModel(token: string, id: string) {
  return requestJson<{ ok: boolean }>(`/api/admin/models/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: adminHeaders(token)
  });
}
