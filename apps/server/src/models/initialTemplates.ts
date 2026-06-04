import type { ApiTemplate } from "../types.js";

export const initialTemplates: ApiTemplate[] = [
  {
    id: "tpl_openai_chat",
    name: "OpenAI Chat 兼容格式",
    category: "text",
    protocol: "openai_chat",
    method: "POST",
    path: "/v1/chat/completions",
    is_async: false,
    headers_template: {
      Authorization: "Bearer {{api_key}}",
      "Content-Type": "application/json"
    },
    body_template: {
      model: "{{model}}",
      stream: "{{stream}}",
      messages: [
        {
          role: "system",
          content: "{{system_prompt}}"
        },
        {
          role: "user",
          content: "{{prompt}}"
        }
      ],
      temperature: "{{temperature}}",
      max_tokens: "{{max_tokens}}"
    },
    params_schema: [
      { key: "system_prompt", label: "系统提示词", type: "textarea", required: false, default: "" },
      { key: "prompt", label: "用户输入", type: "textarea", required: true, default: "" },
      { key: "temperature", label: "Temperature", type: "number", min: 0, max: 2, step: 0.1, default: 0.7 },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 1024 },
      { key: "stream", label: "流式输出", type: "boolean", default: false }
    ],
    response_parser: {
      content_path: "choices[0].message.content",
      usage_path: "usage"
    },
    enabled: true
  },
  {
    id: "tpl_image_generation",
    name: "图片生成格式",
    category: "image",
    protocol: "image_generation",
    method: "POST",
    path: "/v1/images/generations",
    is_async: false,
    headers_template: {
      Authorization: "Bearer {{api_key}}",
      "Content-Type": "application/json"
    },
    body_template: {
      model: "{{model}}",
      prompt: "{{prompt}}",
      size: "{{size}}",
      n: "{{n}}"
    },
    params_schema: [
      { key: "prompt", label: "图片描述", type: "textarea", required: true, default: "" },
      {
        key: "size",
        label: "图片尺寸",
        type: "select",
        options: ["1024x1024", "720x1024", "1024x720", "768x1024", "1024x768"],
        default: "1024x1024"
      },
      { key: "n", label: "生成数量", type: "number", min: 1, max: 4, default: 1 }
    ],
    response_parser: {
      image_urls_path: "data[].url",
      usage_path: "usage"
    },
    enabled: true
  },
  {
    id: "tpl_video_async",
    name: "视频异步生成格式",
    category: "video",
    protocol: "video_async",
    method: "POST",
    path: "/v1/images/generations?async=true",
    is_async: true,
    task_query_path: "/v1/images/tasks/{{task_id}}",
    headers_template: {
      Authorization: "Bearer {{api_key}}",
      "Content-Type": "application/json"
    },
    body_template: {
      model: "{{model}}",
      prompt: "{{prompt}}",
      duration: "{{duration}}",
      aspect_ratio: "{{aspect_ratio}}",
      hd: "{{hd}}"
    },
    params_schema: [
      { key: "prompt", label: "视频描述", type: "textarea", required: true, default: "" },
      { key: "duration", label: "视频时长", type: "select", options: [5, 10, 15], default: 5 },
      { key: "aspect_ratio", label: "画面比例", type: "select", options: ["16:9", "9:16", "1:1"], default: "16:9" },
      { key: "hd", label: "高清模式", type: "boolean", default: true }
    ],
    response_parser: {
      task_id_paths: ["task_id", "id", "data.task_id"],
      status_path: "status",
      progress_path: "progress_pct",
      video_urls_path: "data[].url",
      usage_path: "usage"
    },
    enabled: true
  }
];
