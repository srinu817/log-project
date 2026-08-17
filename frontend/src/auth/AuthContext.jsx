import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const API = "http://127.0.0.1:8000/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem("access_token") || ""
  );
  const [loading, setLoading] = useState(true);

  // ==========================================================
  // SAVE TOKENS
  // ==========================================================

  const saveTokens = (access, refresh) => {
    if (access) {
      localStorage.setItem(
        "access_token",
        access
      );

      setAccessToken(access);
    }

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
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail ||
          result.message ||
          result.non_field_errors?.[0] ||
          "Invalid username or password."
      );
    }

    /*
      Your current backend login response
      returns:

      {
        message: "Login successful.",
        access: "...",
        refresh: "..."
      }
    */

    if (!result.access) {
      throw new Error(
        "Login succeeded but access token was not returned."
      );
    }

    saveTokens(
      result.access,
      result.refresh
    );

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

    /*
      Backend response:

      {
        user: {
          id,
          username,
          email,
          role,
          ...
        }
      }

      Some implementations may return
      the user object directly, so both
      formats are supported.
    */

    const currentUser =
      result.user || result;

    setUser(currentUser);

    return currentUser;
  };

  // ==========================================================
  // REFRESH ACCESS TOKEN
  // ==========================================================

  const refreshAccessToken = async () => {
    const refreshToken =
      localStorage.getItem(
        "refresh_token"
      );

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(
        `${API}/auth/refresh/`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            refresh: refreshToken,
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

      localStorage.setItem(
        "access_token",
        result.access
      );

      setAccessToken(
        result.access
      );

      return result.access;
    } catch {
      clearAuth();
      return null;
    }
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const logout = async () => {
    /*
      We clear the frontend tokens immediately.

      If your backend later gets a dedicated
      logout/blacklist endpoint, we can call
      it here as well.
    */

    clearAuth();
  };

  // ==========================================================
  // INITIAL AUTH CHECK
  // ==========================================================

  useEffect(() => {
    const initializeAuth = async () => {
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
        /*
          Access token may have expired.

          Try refresh token.
        */

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

    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }

    let response =
      await fetch(
        url,
        {
          ...options,
          headers,
        }
      );

    /*
      If access token expired,
      refresh it and retry once.
    */

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
      Boolean(user && accessToken),

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