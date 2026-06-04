import { BASE_URL_NOT_ALLOWED_MESSAGE, HTTPS_URL_INVALID_MESSAGE } from "../security/validateBaseUrl.js";

export type TranslatedError = {
  statusCode: number;
  message: string;
  debug?: unknown;
};

export function translateUpstreamError(statusCode: number, debug?: unknown): TranslatedError {
  const messageByStatus: Record<number, string> = {
    401: "API Key 错误、无权限或余额不足",
    403: "当前站点、模型或接口不可用",
    404: "接口路径或模型名称错误",
    429: "请求过快或额度限制",
    500: "上游服务异常，请稍后重试"
  };

  return {
    statusCode,
    message: messageByStatus[statusCode] ?? (statusCode >= 500 ? messageByStatus[500] : "请求失败，请检查参数后重试"),
    debug
  };
}

export function translateProxyError(error: unknown): TranslatedError {
  if (error instanceof Error) {
    if (error.message === BASE_URL_NOT_ALLOWED_MESSAGE || error.message === HTTPS_URL_INVALID_MESSAGE) {
      return {
        statusCode: 400,
        message: error.message,
        debug: error.message
      };
    }

    if (error.name === "AbortError" || error.message.includes("timeout")) {
      return {
        statusCode: 504,
        message: "请求超时，请稍后重试",
        debug: error.message
      };
    }

    if (error.message === "缺少 task_id") {
      return {
        statusCode: 400,
        message: "请求参数不完整",
        debug: error.message
      };
    }

    if (error.message === "当前站点不可用") {
      return {
        statusCode: 403,
        message: "当前站点、模型或接口不可用",
        debug: error.message
      };
    }

    if (error.message.includes("模型不存在") || error.message.includes("模板不存在")) {
      return {
        statusCode: 404,
        message: error.message,
        debug: error.message
      };
    }

    if (error.message.includes("缺少必填参数")) {
      return {
        statusCode: 400,
        message: error.message,
        debug: error.message
      };
    }

    return {
      statusCode: 500,
      message: "上游服务异常，请稍后重试",
      debug: error.message
    };
  }

  return {
    statusCode: 500,
    message: "上游服务异常，请稍后重试",
    debug: error
  };
}
