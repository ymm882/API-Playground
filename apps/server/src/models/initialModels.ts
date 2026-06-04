import type { AppConfig, ModelConfig } from "../types.js";

export const initialModels: ModelConfig[] = [
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    category: "text",
    invoke_mode: "openai_chat",
    endpoint_type: "chat",
    supports_stream: true,
    supports_native_example: false,
    response_mode: "text",
    enabled: true
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    provider: "openai",
    category: "text",
    invoke_mode: "openai_chat",
    endpoint_type: "chat",
    supports_stream: true,
    supports_native_example: false,
    response_mode: "text",
    enabled: true
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    provider: "openai",
    category: "text",
    invoke_mode: "openai_chat",
    endpoint_type: "chat",
    supports_stream: true,
    supports_native_example: false,
    response_mode: "text",
    enabled: true
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    provider: "openai",
    category: "text",
    invoke_mode: "openai_chat",
    endpoint_type: "chat",
    supports_stream: true,
    supports_native_example: false,
    response_mode: "text",
    enabled: true
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "gemini",
    category: "text",
    invoke_mode: "openai_chat",
    endpoint_type: "chat",
    supports_stream: true,
    supports_native_example: true,
    response_mode: "text",
    enabled: true
  },
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "gemini",
    category: "text",
    invoke_mode: "openai_chat",
    endpoint_type: "chat",
    supports_stream: true,
    supports_native_example: true,
    response_mode: "text",
    enabled: true
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    provider: "gemini",
    category: "text",
    invoke_mode: "openai_chat",
    endpoint_type: "chat",
    supports_stream: true,
    supports_native_example: true,
    response_mode: "text",
    enabled: true
  },
  {
    id: "gemini-3-pro-image-preview",
    name: "Gemini 3 Pro Image Preview",
    provider: "gemini",
    category: "image",
    invoke_mode: "image_generation",
    endpoint_type: "image_generation",
    supports_stream: false,
    supports_native_example: true,
    response_mode: "image_url_array",
    default_params: {
      size: "1024x1024",
      n: 1
    },
    enabled: true
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "claude",
    category: "text",
    invoke_mode: "openai_chat",
    endpoint_type: "chat",
    supports_stream: true,
    supports_native_example: true,
    response_mode: "text",
    enabled: true
  },
  {
    id: "claude-opus-4-5-20251101-thinking",
    name: "Claude Opus 4.5 Thinking",
    provider: "claude",
    category: "text",
    invoke_mode: "openai_chat",
    endpoint_type: "chat",
    supports_stream: true,
    supports_native_example: true,
    response_mode: "text",
    enabled: true
  },
  {
    id: "video-model-demo",
    name: "Video Model Demo",
    provider: "other",
    category: "video",
    invoke_mode: "video_async",
    endpoint_type: "video_generation_async",
    supports_stream: false,
    response_mode: "video_task",
    default_params: {
      duration: 5,
      aspect_ratio: "16:9",
      hd: true
    },
    enabled: false
  }
];

export const initialAppConfig: AppConfig = {
  allowedDomainSuffixes: [".ai-wx.cn"],
  blockedHosts: [],
  extraAllowedHosts: [],
  defaultTextParams: {
    temperature: 0.7,
    max_tokens: 1024
  },
  defaultImageParams: {
    size: "1024x1024",
    n: 1
  },
  defaultVideoParams: {
    duration: 5,
    aspect_ratio: "16:9",
    hd: true
  }
};
