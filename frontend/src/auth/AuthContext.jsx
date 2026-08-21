import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";


// ============================================================
// AUTH CONTEXT
// ============================================================

const AuthContext =
  createContext(null);


// ============================================================
// API BASE URL
// ============================================================

const API_BASE_URL =
  "http://127.0.0.1:8000/api";


// ============================================================
// AUTH PROVIDER
// ============================================================

export function AuthProvider({
  children,
}) {

  const [
    accessToken,
    setAccessToken,
  ] = useState(
    () =>
      localStorage.getItem(
        "access_token"
      )
  );


  const [
    refreshToken,
    setRefreshToken,
  ] = useState(
    () =>
      localStorage.getItem(
        "refresh_token"
      )
  );


  const [
    user,
    setUser,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


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

      setAccessToken(
        access
      );

    }


    if (refresh) {

      localStorage.setItem(
        "refresh_token",
        refresh
      );

      setRefreshToken(
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

    setAccessToken(null);

    setRefreshToken(null);

    setUser(null);

  };


  // ==========================================================
  // LOGIN
  // ==========================================================

  const login = async (
    identifier,
    password
  ) => {

    const response =
      await fetch(
        `${API_BASE_URL}/auth/login/`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              username:
                identifier,

              password:
                password,
            }),
        }
      );


    const data =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (
      !response.ok
    ) {

      let message =
        "Unable to login.";


      if (
        data?.detail
      ) {

        message =
          data.detail;

      } else if (
        data?.non_field_errors?.[0]
      ) {

        message =
          data.non_field_errors[0];

      } else if (
        data?.username?.[0]
      ) {

        message =
          data.username[0];

      } else if (
        data?.password?.[0]
      ) {

        message =
          data.password[0];

      }


      throw new Error(
        message
      );

    }


    saveTokens(
      data.access,
      data.refresh
    );


    if (
      data.user
    ) {

      setUser(
        data.user
      );

    } else {

      // Some login APIs return
      // tokens without user data.
      // Fetch /me/ in that case.

      if (
        data.access
      ) {

        await fetchCurrentUser(
          data.access
        );

      }

    }


    return data;

  };


  // ==========================================================
  // FETCH CURRENT USER
  // ==========================================================

  const fetchCurrentUser =
    async (
      token = accessToken
    ) => {

      if (!token) {

        setUser(null);

        return null;

      }


      const response =
        await fetch(
          `${API_BASE_URL}/auth/me/`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        !response.ok
      ) {

        throw new Error(
          data?.detail ||
          "Unable to fetch current user."
        );

      }


      const currentUser =
        data?.user ||
        data;


      setUser(
        currentUser
      );


      return currentUser;

    };


  // ==========================================================
  // REFRESH ACCESS TOKEN
  // ==========================================================

  const refreshAccessToken =
    async () => {

      const storedRefresh =
        refreshToken ||
        localStorage.getItem(
          "refresh_token"
        );


      if (!storedRefresh) {

        return null;

      }


      const response =
        await fetch(
          `${API_BASE_URL}/auth/refresh/`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                refresh:
                  storedRefresh,
              }),
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        !response.ok
      ) {

        console.warn(
          "Refresh token failed:",
          data
        );

        clearAuth();

        return null;

      }


      saveTokens(
        data.access,
        data.refresh ||
          storedRefresh
      );


      return data.access;

    };


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const logout = async () => {

    const storedRefresh =
      refreshToken ||
      localStorage.getItem(
        "refresh_token"
      );


    try {

      if (
        accessToken &&
        storedRefresh
      ) {

        await fetch(
          `${API_BASE_URL}/auth/logout/`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,
            },

            body:
              JSON.stringify({
                refresh:
                  storedRefresh,
              }),
          }
        );

      }

    } catch (error) {

      console.error(
        "Logout request failed:",
        error
      );

    } finally {

      clearAuth();

    }

  };


  // ==========================================================
  // INITIAL AUTH CHECK
  // ==========================================================

  useEffect(() => {

    let mounted = true;


    const initializeAuth =
      async () => {

        const storedAccess =
          localStorage.getItem(
            "access_token"
          );

        const storedRefresh =
          localStorage.getItem(
            "refresh_token"
          );


        // No stored session

        if (
          !storedAccess
        ) {

          if (mounted) {

            setLoading(false);

          }

          return;

        }


        // ------------------------------------------------------
        // Try existing access token
        // ------------------------------------------------------

        try {

          await fetchCurrentUser(
            storedAccess
          );

        } catch (error) {

          console.warn(
            "Access token failed. Trying refresh..."
          );


          // ----------------------------------------------------
          // Try refresh token
          // ----------------------------------------------------

          if (
            storedRefresh
          ) {

            try {

              const newAccess =
                await refreshAccessToken();


              if (
                newAccess
              ) {

                await fetchCurrentUser(
                  newAccess
                );

              } else {

                clearAuth();

              }

            } catch (
              refreshError
            ) {

              console.error(
                "Unable to restore user after refresh:",
                refreshError
              );

              clearAuth();

            }

          } else {

            clearAuth();

          }

        } finally {

          if (mounted) {

            setLoading(false);

          }

        }

      };


    initializeAuth();


    return () => {

      mounted = false;

    };

    // We intentionally initialize once.
    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);


  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value = {

    user,

    accessToken,

    refreshToken,

    loading,

    isAuthenticated:
      Boolean(
        accessToken &&
        user
      ),

    login,

    logout,

    fetchCurrentUser,

    refreshAccessToken,

    clearAuth,

  };


  // ==========================================================
  // PROVIDER
  // ==========================================================

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
    useContext(
      AuthContext
    );


  if (!context) {

    throw new Error(
      "useAuth must be used inside AuthProvider."
    );

  }


  return context;

}