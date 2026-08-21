// ============================================================
// API CONFIGURATION
// ============================================================

export const API_BASE_URL =
  "http://127.0.0.1:8000/api";


// ============================================================
// AUTH TOKEN
// ============================================================

export const getAccessToken = () => {

  return localStorage.getItem(
    "access_token"
  );

};


// ============================================================
// BUILD API URL
// ============================================================

const buildApiUrl = (
  endpoint
) => {

  // If an absolute URL is accidentally passed,
  // use it as-is.
  if (
    endpoint.startsWith(
      "http://"
    ) ||
    endpoint.startsWith(
      "https://"
    )
  ) {

    return endpoint;

  }


  // Normal API endpoint

  if (
    endpoint.startsWith("/")
  ) {

    return (
      `${API_BASE_URL}${endpoint}`
    );

  }


  return (
    `${API_BASE_URL}/${endpoint}`
  );

};


// ============================================================
// AUTHENTICATED REQUEST
// ============================================================

export const apiRequest = async (
  endpoint,
  options = {}
) => {

  const token =
    getAccessToken();


  const headers = {
    "Content-Type":
      "application/json",

    ...(options.headers || {}),
  };


  if (token) {

    headers.Authorization =
      `Bearer ${token}`;

  }


  const url =
    buildApiUrl(
      endpoint
    );


  console.log(
    "[API REQUEST]",
    options.method || "GET",
    url
  );


  let response;

  try {

    response =
      await fetch(
        url,
        {
          ...options,
          headers,
        }
      );

  } catch (error) {

    console.error(
      "[API NETWORK ERROR]",
      error
    );

    throw new Error(
      "Unable to connect to the backend server."
    );

  }


  const data =
    await response
      .json()
      .catch(
        () => ({})
      );


  // ==========================================================
  // SUCCESS
  // ==========================================================

  if (
    response.ok
  ) {

    return data;

  }


  // ==========================================================
  // FORBIDDEN
  // ==========================================================

  if (
    response.status === 403
  ) {

    const error =
      new Error(
        data?.detail ||
        data?.error ||
        data?.message ||
        "You do not have permission to perform this action."
      );

    error.status =
      response.status;

    error.code =
      "FORBIDDEN";

    throw error;

  }


  // ==========================================================
  // UNAUTHORIZED
  // ==========================================================

  if (
    response.status === 401
  ) {

    const error =
      new Error(
        data?.detail ||
        data?.error ||
        data?.message ||
        "Your session has expired. Please login again."
      );

    error.status =
      response.status;

    error.code =
      "UNAUTHORIZED";

    throw error;

  }


  // ==========================================================
  // VALIDATION ERROR
  // ==========================================================

  if (
    response.status === 400
  ) {

    let message =
      data?.detail ||
      data?.error ||
      data?.message;

    // Handle DRF validation objects such as:
    //
    // {
    //     "name": ["This field is required."]
    // }

    if (
      !message &&
      typeof data === "object"
    ) {

      const messages = [];

      Object.entries(
        data
      ).forEach(
        ([field, errors]) => {

          if (
            Array.isArray(
              errors
            )
          ) {

            errors.forEach(
              (error) => {

                messages.push(
                  `${field}: ${error}`
                );

              }
            );

          } else if (
            typeof errors === "string"
          ) {

            messages.push(
              `${field}: ${errors}`
            );

          }

        }
      );

      if (
        messages.length
      ) {

        message =
          messages.join(
            " "
          );

      }

    }


    const error =
      new Error(
        message ||
        "Invalid request."
      );

    error.status =
      response.status;

    error.code =
      "VALIDATION_ERROR";

    throw error;

  }


  // ==========================================================
  // OTHER API ERROR
  // ==========================================================

  const error =
    new Error(
      data?.detail ||
      data?.error ||
      data?.message ||
      "API request failed."
    );

  error.status =
    response.status;

  error.code =
    "API_ERROR";

  throw error;

};


// ============================================================
// AUTHENTICATED GET
// ============================================================

export const apiGet = async (
  endpoint
) => {

  return apiRequest(
    endpoint,
    {
      method: "GET",
    }
  );

};


// ============================================================
// AUTHENTICATED POST
// ============================================================

export const apiPost = async (
  endpoint,
  body = {}
) => {

  return apiRequest(
    endpoint,
    {
      method: "POST",

      body:
        JSON.stringify(
          body
        ),
    }
  );

};


// ============================================================
// AUTHENTICATED PUT
// ============================================================

export const apiPut = async (
  endpoint,
  body = {}
) => {

  return apiRequest(
    endpoint,
    {
      method: "PUT",

      body:
        JSON.stringify(
          body
        ),
    }
  );

};


// ============================================================
// AUTHENTICATED PATCH
// ============================================================

export const apiPatch = async (
  endpoint,
  body = {}
) => {

  return apiRequest(
    endpoint,
    {
      method: "PATCH",

      body:
        JSON.stringify(
          body
        ),
    }
  );

};


// ============================================================
// AUTHENTICATED DELETE
// ============================================================

export const apiDelete = async (
  endpoint
) => {

  return apiRequest(
    endpoint,
    {
      method: "DELETE",
    }
  );

};