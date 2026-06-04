import type { EndpointType } from "../types.js";

export const endpointMap: Record<EndpointType, string> = {
  chat: "/v1/chat/completions",
  image_generation: "/v1/images/generations",
  video_generation_async: "/v1/images/generations?async=true",
  video_task_query: "/v1/images/tasks/{task_id}"
};
