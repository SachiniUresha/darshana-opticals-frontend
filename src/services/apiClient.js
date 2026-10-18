import { env } from '../config/env';
import authStorage from './auth/authStorage';

function buildUrl(path) {
  const baseUrl = env.apiBaseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');

  return `${baseUrl}/${cleanPath}`;
}

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {}, authenticated = true } = options;

  const requestHeaders = {
    ...headers,
  };

  // FormData lets the browser set the correct multipart boundary automatically.
  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (authenticated) {
    const token = authStorage.getToken();

    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  let response;

  try {
    response = await fetch(buildUrl(path), {
      method,
      headers: requestHeaders,
      body: isFormData
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });
  } catch {
    const error = new Error(
      'Unable to reach the server. Please check your connection and try again.',
    );

    error.status = 0;
    error.code = 'NETWORK_ERROR';

    throw error;
  }

  let responseData = null;

  try {
    responseData = await response.json();
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    const message =
      responseData?.error?.message ||
      responseData?.message ||
      'Something went wrong while communicating with the server.';

    const error = new Error(message);
    error.status = response.status;
    error.code = responseData?.error?.code;
    // Chatbot documents Retry-After as integer seconds. Missing, malformed or
    // unrepresentable values must never create an indefinite UI lock.
    const retryAfter = response.headers?.get?.('Retry-After');
    if (typeof retryAfter === 'string' && /^\d+$/.test(retryAfter.trim())) {
      const seconds = Number(retryAfter);
      if (Number.isSafeInteger(seconds) && seconds <= 2147483) {
        error.retryAfterSeconds = seconds;
      }
    }

    throw error;
  }

  return responseData;
}

const apiClient = {
  baseUrl: env.apiBaseUrl,

  get(path, options = {}) {
    return request(path, {
      ...options,
      method: 'GET',
    });
  },

  post(path, body, options = {}) {
    return request(path, {
      ...options,
      method: 'POST',
      body,
    });
  },

  patch(path, body, options = {}) {
    return request(path, {
      ...options,
      method: 'PATCH',
      body,
    });
  },

  put(path, body, options = {}) {
    return request(path, {
      ...options,
      method: 'PUT',
      body,
    });
  },

  delete(path, options = {}) {
    return request(path, {
      ...options,
      method: 'DELETE',
    });
  },
};

export default apiClient;
