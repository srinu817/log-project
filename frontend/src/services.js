// services.js

import { translateLegacy } from "./i18n";

const t = translateLegacy;

// ============================================================
// API CONFIGURATION
// ============================================================

export const API =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";



// ============================================================
// API ERROR HELPERS
// ============================================================

export function getApiError(data) {
  if (!data) {
    return t("Something went wrong.");
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.detail) {
    return String(data.detail);
  }

  if (data.message) {
    return String(data.message);
  }

  if (data.error) {
    return String(data.error);
  }

  // Django REST Framework validation errors.
  if (typeof data === "object") {
    const messages = [];

    Object.entries(data).forEach(([field, value]) => {
      if (Array.isArray(value)) {
        value.forEach((message) => {
          messages.push(
            field === "non_field_errors"
              ? String(message)
              : `${field}: ${message}`
          );
        });
      } else if (value && typeof value === "object") {
        messages.push(`${field}: ${JSON.stringify(value)}`);
      } else if (value !== undefined && value !== null) {
        messages.push(`${field}: ${value}`);
      }
    });

    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  return t("Something went wrong.");
}



// ============================================================
// GENERIC RESPONSE HELPERS
// ============================================================

export async function parseResponse(response) {
  const contentType =
    response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}



export async function requestJson(
  authFetch,
  url,
  options = {}
) {
  const response = await authFetch(url, options);
  const result = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiError(result));
  }

  return result;
}



// ============================================================
// AUTHENTICATION
// ============================================================
//
// Login/signup/reset-password endpoints are public.
// JWT access/refresh ownership remains inside AuthContext.
//
// These helpers are useful for AuthScreen/ForgotPassword/
// PasswordResetScreen.
// ============================================================

export async function login(credentials) {
  const response = await fetch(
    `${API}/auth/login/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    }
  );

  const result = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiError(result));
  }

  return result;
}



export async function signup(userData) {
  const response = await fetch(
    `${API}/auth/signup/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    }
  );

  const result = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiError(result));
  }

  return result;
}



export async function forgotPassword(email) {
  const response = await fetch(
    `${API}/auth/forgot-password/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    }
  );

  const result = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiError(result));
  }

  return result;
}



export async function resetPassword(payload) {
  const response = await fetch(
    `${API}/auth/reset-password/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiError(result));
  }

  return result;
}



// ============================================================
// DASHBOARD
// ============================================================

export async function getDashboard(authFetch) {
  return requestJson(
    authFetch,
    `${API}/dashboard/`
  );
}



// ============================================================
// REPOSITORIES
// ============================================================

export async function getRepositories(authFetch) {
  return requestJson(
    authFetch,
    `${API}/repositories/`
  );
}



export async function getRepository(
  authFetch,
  repositoryId
) {
  return requestJson(
    authFetch,
    `${API}/repositories/${repositoryId}/`
  );
}



export async function createRepository(
  authFetch,
  payload
) {
  return requestJson(
    authFetch,
    `${API}/repositories/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
}



export async function updateRepository(
  authFetch,
  repositoryId,
  payload
) {
  return requestJson(
    authFetch,
    `${API}/repositories/${repositoryId}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
}



export async function deleteRepository(
  authFetch,
  repositoryId
) {
  return requestJson(
    authFetch,
    `${API}/repositories/${repositoryId}/`,
    {
      method: "DELETE",
    }
  );
}



// ============================================================
// REPOSITORY CONNECTION
// ============================================================

export async function testRepositoryConnection(
  authFetch,
  repositoryId
) {
  return requestJson(
    authFetch,
    `${API}/repositories/${repositoryId}/test/`,
    {
      method: "POST",
    }
  );
}



export async function testRepositoryFormConnection(
  authFetch,
  payload
) {
  return requestJson(
    authFetch,
    `${API}/repositories/branches/preview/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
}



// ============================================================
// REPOSITORY BRANCHES
// ============================================================

export async function getRepositoryBranches(
  authFetch,
  repositoryId
) {
  return requestJson(
    authFetch,
    `${API}/repositories/${repositoryId}/branches/`
  );
}



// ============================================================
// DELIVERY JOBS
// ============================================================

export async function getJobs(authFetch) {
  return requestJson(
    authFetch,
    `${API}/jobs/`
  );
}



export async function getJob(
  authFetch,
  jobId
) {
  return requestJson(
    authFetch,
    `${API}/jobs/${jobId}/`
  );
}



// ============================================================
// RUN DELIVERY
// ============================================================

export async function runDelivery(
  authFetch,
  repositoryId,
  options = {}
) {
  const {
    dryRun = false,
  } = options;

  return requestJson(
    authFetch,
    `${API}/jobs/run/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repository_id: repositoryId,
        dry_run: dryRun,
      }),
    }
  );
}



// ============================================================
// FUTURE FEATURE: DELIVERY DETAILS
// ============================================================
//
// Keep this code here for later.
// DO NOT enable until the backend endpoint and UI
// are implemented.
//
// ============================================================

// export async function getDeliveryDetails(
//   authFetch,
//   jobId
// ) {
//   return requestJson(
//     authFetch,
//     `${API}/jobs/${jobId}/`
//   );
// }



// ============================================================
// FUTURE FEATURE: RETRY DELIVERY
// ============================================================
//
// Keep this code here for later.
// DO NOT enable until the backend retry endpoint exists.
//
// ============================================================

// export async function retryDelivery(
//   authFetch,
//   jobId
// ) {
//   return requestJson(
//     authFetch,
//     `${API}/jobs/${jobId}/retry/`,
//     {
//       method: "POST",
//     }
//   );
// }



// ============================================================
// AUDIT LOGS
// ============================================================

export async function getAuditLogs(
  authFetch,
  filters = {}
) {
  const params = new URLSearchParams();

  if (filters.action) {
    params.set(
      "action",
      filters.action
    );
  }

  if (filters.resource) {
    params.set(
      "resource",
      filters.resource
    );
  }

  if (filters.user) {
    params.set(
      "user",
      filters.user
    );
  }

  if (filters.dateFrom) {
    params.set(
      "date_from",
      filters.dateFrom
    );
  }

  if (filters.dateTo) {
    params.set(
      "date_to",
      filters.dateTo
    );
  }

  if (filters.limit) {
    params.set(
      "limit",
      String(filters.limit)
    );
  } else {
    params.set(
      "limit",
      "100"
    );
  }

  const queryString = params.toString();

  const url =
    `${API}/auth/audit-logs/` +
    (queryString
      ? `?${queryString}`
      : "");

  const result = await requestJson(
    authFetch,
    url
  );

  // Support all currently handled backend
  // response formats.
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.logs)) {
    return result.logs;
  }

  if (Array.isArray(result?.results)) {
    return result.results;
  }

  return [];
}



export async function deleteAuditLog(
  authFetch,
  logId
) {
  return requestJson(
    authFetch,
    `${API}/auth/audit-logs/?id=${encodeURIComponent(
      logId
    )}`,
    {
      method: "DELETE",
    }
  );
}



// ============================================================
// USER MANAGEMENT
// ============================================================

export async function getUsers(authFetch) {
  return requestJson(
    authFetch,
    `${API}/auth/users/`
  );
}



export async function getUser(
  authFetch,
  userId
) {
  return requestJson(
    authFetch,
    `${API}/auth/users/${userId}/`
  );
}



export async function createUser(
  authFetch,
  payload
) {
  return requestJson(
    authFetch,
    `${API}/auth/users/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
}



export async function updateUser(
  authFetch,
  userId,
  payload
) {
  return requestJson(
    authFetch,
    `${API}/auth/users/${userId}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
}



export async function toggleUserStatus(
  authFetch,
  userId,
  isActive
) {
  return updateUser(
    authFetch,
    userId,
    {
      is_active: isActive,
    }
  );
}



// ============================================================
// PROFILE
// ============================================================

export async function getProfile(authFetch) {
  return requestJson(
    authFetch,
    `${API}/auth/me/`
  );
}



export async function updateProfile(
  authFetch,
  payload
) {
  return requestJson(
    authFetch,
    `${API}/auth/me/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
}



// ============================================================
// USER SETTINGS
// ============================================================
//
// Settings are stored per-user in the backend database.
// AuthContext remains responsible for JWT authentication.
// ============================================================

export async function getSettings(authFetch) {
  return requestJson(
    authFetch,
    `${API}/auth/settings/`
  );
}



export async function updateSettings(
  authFetch,
  payload
) {
  return requestJson(
    authFetch,
    `${API}/auth/settings/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
}



// ============================================================
// UTILITY HELPERS
// ============================================================

export function formatBytes(bytes) {
  if (
    bytes === null ||
    bytes === undefined ||
    Number.isNaN(Number(bytes))
  ) {
    return "0 B";
  }

  const value = Number(bytes);

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(
      value /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    value /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}



export function normalizeArrayResponse(
  result
) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.results)) {
    return result.results;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  return [];
}



// ============================================================
// REPOSITORY PAYLOAD BUILDER
// ============================================================
//
// Keeps the existing multi-target + legacy compatibility
// behavior in one place.
//
// Existing backend expects `targets`, while older backend
// logic may still use `target_path`, `extensions`, etc.
// ============================================================

export function buildRepositoryPayload(
  repositoryForm,
  editingRepository = null
) {
  const targets = (
    Array.isArray(repositoryForm.targets)
      ? repositoryForm.targets
      : []
  )
    .map((target) => ({
      path: String(
        target?.path || ""
      ).trim(),

      extensions: Array.isArray(
        target?.extensions
      )
        ? target.extensions
        : [],
    }))
    .filter(
      (target) => target.path
    );

  const recipients = (
    Array.isArray(
      repositoryForm.recipients
    )
      ? repositoryForm.recipients
      : []
  )
    .map((email) =>
      String(email).trim()
    )
    .filter(Boolean);

  if (targets.length === 0) {
    throw new Error(
      t("Add at least one target file or folder.")
    );
  }

  if (recipients.length === 0) {
    throw new Error(
      t("Add at least one recipient email address.")
    );
  }

  const payload = {
    ...repositoryForm,

    targets,

    // Legacy backend compatibility.
    target_path:
      targets[0]?.path || "",

    extensions:
      targets[0]?.extensions?.length
        ? targets[0].extensions
        : repositoryForm.extensions || [
            ".log",
            ".txt",
          ],

    recipients,
  };

  // ==========================================================
  // LOCAL REPOSITORY
  // ==========================================================

  if (
    repositoryForm.repository_type ===
    "LOCAL"
  ) {
    payload.auth_type = "NONE";
    payload.username = "";

    delete payload.token;
    delete payload.access_token;

    return payload;
  }

  // ==========================================================
  // PAT AUTHENTICATION
  // ==========================================================

  if (
    repositoryForm.auth_type ===
    "PAT"
  ) {
    const username = String(
      repositoryForm.username || ""
    ).trim();

    const token = String(
      repositoryForm.token || ""
    ).trim();

    if (!username) {
      throw new Error(
        t(
          "Git username is required for private repository authentication."
        )
      );
    }

    // On create, PAT is mandatory.
    if (
      !editingRepository &&
      !token
    ) {
      throw new Error(
        t(
          "Personal Access Token is required for a private repository."
        )
      );
    }

    payload.auth_type = "PAT";
    payload.username = username;

    // Django expects `access_token`,
    // not `token`.
    delete payload.token;

    // When editing:
    // blank token means "keep existing credential".
    if (token) {
      payload.access_token = token;
    } else {
      delete payload.access_token;
    }

    return payload;
  }

  // ==========================================================
  // NO AUTHENTICATION
  // ==========================================================

  payload.auth_type = "NONE";
  payload.username = "";

  delete payload.token;
  delete payload.access_token;

  return payload;
}



// ============================================================
// REPOSITORY FORM NORMALIZER
// ============================================================
//
// Converts backend repository data into the structure used by
// the frontend form.
// ============================================================

export function normalizeRepositoryForm(
  repository
) {
  if (!repository) {
    return {
      name: "",
      description: "",
      repository_type: "GITHUB",
      repository_url: "",
      local_path: "",
      branch: "main",

      targets: [
        {
          path: "",
          extensions: [],
        },
      ],

      target_path: "",
      log_directory: "logs",

      extensions: [
        ".log",
        ".txt",
      ],

      recipients: [""],

      email_mode: "SMTP",
      auth_type: "NONE",

      username: "",
      token: "",

      authentication_configured:
        false,

      active: true,
    };
  }

  return {
    name:
      repository.name || "",

    description:
      repository.description || "",

    repository_type:
      repository.repository_type ||
      "GITHUB",

    repository_url:
      repository.repository_url ||
      "",

    local_path:
      repository.local_path || "",

    branch:
      repository.branch || "main",

    targets:
      Array.isArray(repository.targets) &&
      repository.targets.length > 0
        ? repository.targets.map(
            (target) => ({
              path:
                target?.path || "",

              extensions:
                Array.isArray(
                  target?.extensions
                )
                  ? target.extensions
                  : [],
            })
          )
        : [
            {
              path:
                repository.target_path ||
                repository.log_directory ||
                "",

              extensions:
                Array.isArray(
                  repository.extensions
                )
                  ? repository.extensions
                  : [],
            },
          ],

    // Legacy compatibility fields.
    target_path:
      repository.target_path ||
      repository.log_directory ||
      "",

    log_directory:
      repository.log_directory ||
      "logs",

    extensions:
      repository.extensions?.length
        ? repository.extensions
        : [
            ".log",
            ".txt",
          ],

    recipients:
      Array.isArray(
        repository.recipients
      )
        ? repository.recipients
        : [],

    email_mode:
      repository.email_mode ||
      "SMTP",

    auth_type:
      repository.auth_type ||
      "NONE",

    username:
      repository.username ||
      "",

    // Never populate an existing PAT
    // into the browser.
    token: "",

    authentication_configured:
      repository.authentication_configured ??
      false,

    active:
      repository.active ??
      true,
  };
}



// ============================================================
// DELIVERY RESULT NORMALIZER
// ============================================================

export function normalizeDeliveryResult(
  result
) {
  if (!result) {
    return null;
  }

  return {
    ...result,

    success:
      result.success ??
      result.status === "SUCCESS",

    status:
      result.status ||
      (result.success
        ? "SUCCESS"
        : "FAILED"),

    job_id:
      result.job_id ??
      result.id ??
      null,

    files:
      result.files ??
      result.file_count ??
      0,

    archive:
      result.archive ??
      result.archive_name ??
      null,
  };
}



// ============================================================
// AUTHENTICATED FETCH
// ============================================================
//
// AuthContext remains the owner of JWT refresh state.
// This helper attaches the current access token to protected
// requests and asks AuthContext to refresh it after a 401.
//
// ============================================================

export function createAuthFetch({
  getToken,
  refreshAccessToken,
  clearAuth,
}) {
  return async function authFetch(
    url,
    options = {}
  ) {
    let token = getToken();

    const makeOptions = (authToken) => ({
      ...options,

      headers: {
        ...(options.headers || {}),

        ...(authToken
          ? {
              Authorization:
                `Bearer ${authToken}`,
            }
          : {}),
      },
    });

    let response = await fetch(
      url,
      makeOptions(token)
    );

    // Request succeeded or failed for a reason
    // other than authentication.
    if (response.status !== 401) {
      return response;
    }

    // Ask AuthContext to refresh the access token.
    // AuthContext owns the refresh-token logic.
    const newToken =
      await refreshAccessToken();

    if (!newToken) {
      clearAuth();

      throw new Error(
        t(
          "Your session has expired. Please sign in again."
        )
      );
    }

    // Retry the original request once with
    // the newly refreshed access token.
    response = await fetch(
      url,
      makeOptions(newToken)
    );

    return response;
  };
}