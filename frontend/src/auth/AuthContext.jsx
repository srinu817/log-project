import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const API = "http://127.0.0.1:8000/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [accessToken, setAccessToken] = useState(
    () =>
      localStorage.getItem(
        "access_token"
      ) || ""
  );

  const [loading, setLoading] = useState(
    true
  );

  // ==========================================================
  // REFRESH LOCK
  // ==========================================================
  //
  // Only ONE refresh request may run at a time.
  //
  // This is important because JWT refresh-token rotation is
  // enabled on the backend. Multiple simultaneous refresh
  // requests can otherwise race with one another.
  //

  const refreshPromiseRef = useRef(null);

  // ==========================================================
  // SAVE TOKENS
  // ==========================================================

  const saveTokens = (
    access,
    refresh
  ) => {
    if (access) {
      localStorage.setItem(
        "access_token",
        access
      );

      setAccessToken(access);
    }

    // IMPORTANT:
    // When refresh-token rotation is enabled, the backend may
    // return a NEW refresh token. Always replace the old one.
    if (refresh) {
      localStorage.setItem(
        "refresh_token",
        refresh
      );
    }
  };

  // ==========================================================
  // CLEAR AUTH
  // ==========================================================

  const clearAuth = () => {
    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "refresh_token"
    );

    setAccessToken("");
    setUser(null);
  };

  // ==========================================================
  // LOGIN
  // ==========================================================

  const login = async (
    username,
    password
  ) => {
    const response = await fetch(
      `${API}/auth/login/`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          username,
          password,
        }),
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail ||
          result.message ||
          result.non_field_errors?.[0] ||
          result.username?.[0] ||
          "Invalid username or password."
      );
    }

    if (!result.access) {
      throw new Error(
        "Login succeeded but access token was not returned."
      );
    }

    if (!result.refresh) {
      throw new Error(
        "Login succeeded but refresh token was not returned."
      );
    }

    saveTokens(
      result.access,
      result.refresh
    );

    // Keep the user returned by login when
    // available. This avoids an unnecessary
    // immediate /me request in the UI.
    if (result.user) {
      setUser(result.user);
    }

    return result;
  };

  // ==========================================================
  // GET CURRENT USER
  // ==========================================================

  const fetchCurrentUser = async (
    token = accessToken
  ) => {
    if (!token) {
      return null;
    }

    const response = await fetch(
      `${API}/auth/me/`,
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        "Authentication token is invalid."
      );
    }

    const result =
      await response.json();

    const currentUser =
      result.user || result;

    setUser(currentUser);

    return currentUser;
  };

  // ==========================================================
  // REFRESH ACCESS TOKEN
  // ==========================================================

  const refreshAccessToken = async () => {
    // If another request is already refreshing,
    // wait for that exact refresh operation.
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshToken =
      localStorage.getItem(
        "refresh_token"
      );

    if (!refreshToken) {
      clearAuth();
      return null;
    }

    const refreshPromise =
      (async () => {
        try {
          const response =
            await fetch(
              `${API}/auth/refresh/`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  refresh:
                    refreshToken,
                }),
              }
            );

          if (!response.ok) {
            clearAuth();
            return null;
          }

          const result =
            await response.json();

          if (!result.access) {
            clearAuth();
            return null;
          }

          // Because the backend uses:
          //
          // ROTATE_REFRESH_TOKENS = True
          //
          // and:
          //
          // BLACKLIST_AFTER_ROTATION = True
          //
          // we MUST save the newly returned
          // refresh token whenever one is supplied.
          saveTokens(
            result.access,
            result.refresh
          );

          return result.access;
        } catch {
          clearAuth();
          return null;
        } finally {
          refreshPromiseRef.current = null;
        }
      })();

    refreshPromiseRef.current =
      refreshPromise;

    return refreshPromise;
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const logout = async () => {
    const refreshToken =
      localStorage.getItem(
        "refresh_token"
      );

    const token =
      localStorage.getItem(
        "access_token"
      );

    try {
      if (
        refreshToken &&
        token
      ) {
        await fetch(
          `${API}/auth/logout/`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              refresh:
                refreshToken,
            }),
          }
        );
      }
    } catch {
      // Frontend cleanup must still happen
      // if the backend is unreachable.
    } finally {
      clearAuth();
    }
  };

  // ==========================================================
  // INITIAL AUTH CHECK
  // ==========================================================

  useEffect(() => {
    const initializeAuth =
      async () => {
        const storedToken =
          localStorage.getItem(
            "access_token"
          );

        if (!storedToken) {
          setLoading(false);
          return;
        }

        try {
          await fetchCurrentUser(
            storedToken
          );
        } catch {
          const newToken =
            await refreshAccessToken();

          if (newToken) {
            try {
              await fetchCurrentUser(
                newToken
              );
            } catch {
              clearAuth();
            }
          }
        } finally {
          setLoading(false);
        }
      };

    initializeAuth();
  }, []);

  // ==========================================================
  // AUTHENTICATED FETCH
  // ==========================================================

  const authFetch = async (
    url,
    options = {}
  ) => {
    let token =
      localStorage.getItem(
        "access_token"
      );

    const initialHeaders = {
      ...(options.headers || {}),
    };

    if (token) {
      initialHeaders.Authorization =
        `Bearer ${token}`;
    }

    let response =
      await fetch(
        url,
        {
          ...options,
          headers: initialHeaders,
        }
      );

    // Retry a request only once after a
    // 401 response.
    if (
      response.status === 401
    ) {
      token =
        await refreshAccessToken();

      if (!token) {
        clearAuth();

        throw new Error(
          "Your session has expired. Please login again."
        );
      }

      response =
        await fetch(
          url,
          {
            ...options,

            headers: {
              ...(options.headers || {}),
              Authorization:
                `Bearer ${token}`,
            },
          }
        );
    }

    return response;
  };

  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value = {
    user,

    accessToken,

    loading,

    isAuthenticated:
      Boolean(
        user &&
        accessToken
      ),

    login,

    logout,

    refreshAccessToken,

    fetchCurrentUser,

    authFetch,
  };

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}


// ============================================================
// USE AUTH
// ============================================================

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}