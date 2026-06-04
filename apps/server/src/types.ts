export type Provider = "openai" | "gemini" | "claude" | "other";
export type ModelCategory = "text" | "image" | "video";
export type InvokeMode =
  | "openai_chat"
  | "image_generation"
  | "video_async"
  | "gemini_native_example"
  | "claude_native_example";
export type EndpointType = "chat" | "image_generation" | "video_generation_async" | "video_task_query";
export type ResponseMode = "text" | "image_url_array" | "video_task";

export type ModelConfig = {
  id: string;
  name: string;
  provider: Provider;
  category: ModelCategory;
  invoke_mode: InvokeMode;
  endpoint_type: Exclude<EndpointType, "video_task_query">;
  supports_stream?: boolean;
  supports_native_example?: boolean;
  response_mode?: ResponseMode;
  default_params?: Record<string, unknown>;
  template_id?: string;
  description?: string;
  tags?: string[];
  sort_order?: number;
  default_params_override?: Record<string, unknown>;
  enabled: boolean;
};

export type ApiTemplate = {
  id: string;
  name: string;
  category: ModelCategory;
  protocol:
    | "openai_chat"
    | "gemini_native"
    | "claude_native"
    | "image_generation"
    | "video_async"
    | "other"
    | (string & {});
  method: "GET" | "POST";
  path: string;
  is_async: boolean;
  task_query_path?: string;
  headers_template?: Record<string, unknown>;
  body_template?: Record<string, unknown>;
  params_schema?: Array<Record<string, unknown>>;
  default_params?: Record<string, unknown>;
  response_example?: Record<string, unknown>;
  response_parser?: Record<string, unknown>;
  code_templates?: Record<string, unknown>;
  enabled: boolean;
};

export type ParsedTemplateResponse = {
  content: string;
  image_urls: string[];
  video_urls: string[];
  task_id: string;
  status: string;
  progress: number;
  usage: unknown;
  raw: unknown;
};

export type AppConfig = {
  allowedDomainSuffixes: string[];
  blockedHosts: string[];
  extraAllowedHosts: string[];
  defaultTextParams: {
    temperature: number;
    max_tokens: number;
  };
  defaultImageParams: {
    size: string;
    n: number;
  };
  defaultVideoParams: {
    duration: number;
    aspect_ratio: string;
    hd: boolean;
  };
};
