import React, { useState } from "react";
import { useAuth } from "./auth/AuthContext";

export default function Login() {
  const {
    login,
    fetchCurrentUser,
  } = useAuth();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!username.trim()) {
      setError("Username is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    try {
      setLoading(true);

      const result = await login(
        username.trim(),
        password
      );

      /*
       * Login returns the JWT.
       * Now fetch the authenticated user
       * so AuthContext knows the user's
       * role and profile information.
       */

      await fetchCurrentUser(
        result.access
      );

    } catch (err) {
      setError(
        err?.message ||
          "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      <div className="login-card">

        <div className="login-header">

          <div className="login-logo">
            LD
          </div>

          <h1>
            Log Delivery Management
          </h1>

          <p>
            Sign in to continue
          </p>

        </div>

        <form
          onSubmit={handleSubmit}
          className="login-form"
        >

          <div className="form-group">

            <label>
              Username
            </label>

            <input
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              placeholder="Enter username"
              autoComplete="username"
              disabled={loading}
            />

          </div>

          <div className="form-group">

            <label>
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Enter password"
              autoComplete="current-password"
              disabled={loading}
            />

          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>

        </form>

        <div className="login-footer">
          Log Delivery Management
        </div>

      </div>

    </div>
  );
}