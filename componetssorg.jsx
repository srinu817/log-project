import React, { useState } from "react";
import {
  LayoutDashboard,
  History,
  GitBranch,
  Settings,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock3,
  Archive,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Wifi,
  X,
  Save,
  Server,
  Mail,
  FolderGit2,
  FileText,
  Timer,
  GitCommit,
  Eye,
  AlertTriangle,
  Link2,
  Target,
  Users,
  Send,
  UserCircle2,
  LogOut,
  ListChecks,
} from "lucide-react";
import {
  translateLegacy,
  translateMessage,
  getCurrentLanguageCode,
} from "./i18n";
import { useAuth } from "./auth/AuthContext";
import { API, formatBytes, getApiError } from "./services";

const t = translateLegacy;

const getLocaleForLanguage = () =>
  ({ en: "en-US", te: "te-IN", hi: "hi-IN" }[
    getCurrentLanguageCode()
  ] || "en-US");

const getUserInitials = (user) => {
  const name = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ") || user?.username || "User";

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
};

const getUserAvatar = (user) => {
  const initials = getUserInitials(user);
  const seed = String(user?.username || user?.email || initials);
  const hue = [...seed].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  ) % 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="hsl(${hue} 85% 58%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 38) % 360} 78% 42%)"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="48" fill="url(#background)"/>
      <text x="48" y="58" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="34" font-weight="700">${initials}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const authStyles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "minmax(360px, 0.82fr) minmax(420px, 1.18fr)",
    background: "#f5f7fb",
  },

  brandPanel: {
    minHeight: "100vh",
    padding: "48px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    background: "#0f172a",
    color: "#ffffff",
  },

  brandTop: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  logo: {
    width: "52px",
    height: "52px",
    display: "grid",
    placeItems: "center",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    letterSpacing: "0.04em",
  },

  content: {
    maxWidth: "560px",
  },

  eyebrow: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.14em",
    color: "#94a3b8",
    marginBottom: "10px",
  },

  title: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1.12,
    letterSpacing: "-0.03em",
  },

  subtitle: {
    margin: "14px 0 0",
    color: "#94a3b8",
    fontSize: "15px",
    lineHeight: 1.7,
    maxWidth: "480px",
  },

  feature: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    marginTop: "20px",
  },

  featureIcon: {
    width: "34px",
    height: "34px",
    flex: "0 0 34px",
    display: "grid",
    placeItems: "center",
    borderRadius: "9px",
    background: "rgba(255,255,255,0.08)",
    color: "#e2e8f0",
  },

  formArea: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "32px",
    background: "#f5f7fb",
  },

  card: {
    width: "100%",
    maxWidth: "500px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "34px",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  },
};

function AuthBrandPanel({ mode = "login" }) {
  return (
    <div style={authStyles.brandPanel}>
      <div>
        <div style={authStyles.brandTop}>
          <div style={authStyles.logo}>LD</div>

          <div>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>
              {t("Log Delivery")}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                marginTop: "3px",
              }}
            >
              {t("Management")}
            </div>
          </div>
        </div>

        <div
          style={{
            ...authStyles.content,
            marginTop: "92px",
          }}
        >
          <div style={authStyles.eyebrow}>
            {t("OPERATIONS CENTER")}
          </div>

          <h1 style={authStyles.title}>
            {t("Secure log delivery,")}
            <br />
            {t("without the manual work.")}
          </h1>

          <p style={authStyles.subtitle}>
            {t("Collect application files from configured repositories and deliver them securely to your configured recipients.")}
          </p>

          <AuthFeature
            icon={ShieldCheck}
            title={t("Secure access")}
            text={t("JWT authentication keeps your application session protected.")}
          />

          <AuthFeature
            icon={GitBranch}
            title={t("Repository based")}
            text={t("Connect GitHub, GitLab, Azure DevOps, internal or local Git sources.")}
          />

          <AuthFeature
            icon={Send}
            title={t("Controlled delivery")}
            text={t("Select targets and multiple recipients before every delivery.")}
          />
        </div>
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
        }}
      >
        {t("Secure mode")} ·{" "}
        {mode === "signup"
          ? t("New account")
          : t("Authentication")}
      </div>
    </div>
  );
}

function AuthFeature({ icon: Icon, title, text }) {
  return (
    <div style={authStyles.feature}>
      <div style={authStyles.featureIcon}>
        <Icon size={17} />
      </div>

      <div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 750,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: "4px",
            color: "#94a3b8",
            fontSize: "12px",
            lineHeight: 1.5,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function AuthCardHeader({
  eyebrow,
  title,
  description,
}) {
  return (
    <div
      style={{
        marginBottom: "22px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: "#64748b",
          marginBottom: "7px",
        }}
      >
        {eyebrow}
      </div>

      <h1
        style={{
          margin: 0,
          fontSize: "28px",
          color: "#0f172a",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>

      <p
        style={{
          margin: "8px 0 0",
          color: "#64748b",
          fontSize: "14px",
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function AuthMessage({ error, success }) {
  if (!error && !success) return null;

  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "11px 13px",
        borderRadius: "10px",
        background: error ? "#fef2f2" : "#f0fdf4",
        border: `1px solid ${
          error ? "#fecaca" : "#bbf7d0"
        }`,
        color: error ? "#b91c1c" : "#15803d",
        fontSize: "13px",
        lineHeight: 1.5,
      }}
    >
      {error || success}
    </div>
  );
}

// ============================================================
// AUTH LOADING SCREEN
// ============================================================

function AuthLoadingScreen() {
  return (
    <div style={authStyles.page}>
      <AuthBrandPanel />

      <div style={authStyles.formArea}>
        <div
          style={{
            ...authStyles.card,
            textAlign: "center",
            maxWidth: "430px",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              margin: "0 auto 16px",
              display: "grid",
              placeItems: "center",
              borderRadius: "14px",
              background: "#111827",
              color: "#ffffff",
              fontWeight: 800,
            }}
          >
            LD
          </div>

          <strong style={{ color: "#0f172a" }}>
            {t("Checking your session...")}
          </strong>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AUTH SCREEN
// ============================================================

function AuthScreen({
  mode,
  onModeChange,
  onAuthenticated,
}) {
  const { login } = useAuth();

  const isSignup = mode === "signup";

  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    password_confirm: "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const switchMode = (nextMode) => {
    if (busy) return;

    setError("");
    setSuccess("");

    setForm({
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      password: "",
      password_confirm: "",
    });

    onModeChange(nextMode);
  };

  const submit = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (
        isSignup &&
        form.password !== form.password_confirm
      ) {
        throw new Error(t("Passwords do not match."));
      }

      const endpoint = isSignup
        ? `${API}/auth/signup/`
        : `${API}/auth/login/`;

      const payload = isSignup
        ? {
            username: form.username.trim(),
            email: form.email.trim(),
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            password: form.password,
            password_confirm:
              form.password_confirm,
          }
        : {
            username: form.username.trim(),
            password: form.password,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(getApiError(result));
      }

      if (isSignup) {
        setSuccess(
          result.message ||
            t("Account created successfully. Please sign in.")
        );

        setTimeout(() => {
          onModeChange("login");
          setSuccess("");
          setError("");

          setForm({
            username: "",
            email: "",
            first_name: "",
            last_name: "",
            password: "",
            password_confirm: "",
          });
        }, 900);

        return;
      }

      const loginResult = await login(
        form.username.trim(),
        form.password
      );

      onAuthenticated(
        loginResult?.user || null
      );
    } catch (submitError) {
      setError(
        submitError.message ||
          t("Unable to complete the request.")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={authStyles.page}>
      <AuthBrandPanel
        mode={isSignup ? "signup" : "login"}
      />

      <div style={authStyles.formArea}>
        <div style={authStyles.card}>
          <AuthCardHeader
            eyebrow={t("SECURE ACCESS")}
            title={
              isSignup
                ? t("Create account")
                : t("Welcome back")
            }
            description={
              isSignup
                ? t("Create your account to access the Log Delivery Management operations center.")
                : t("Sign in to continue to the Log Delivery Management operations center.")
            }
          />

          <AuthMessage
            error={error}
            success={success}
          />

          <form onSubmit={submit}>
            {isSignup && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "14px",
                }}
              >
                <AuthInput
                  label={t("First name")}
                  value={form.first_name}
                  onChange={(value) =>
                    updateField(
                      "first_name",
                      value
                    )
                  }
                  autoComplete="given-name"
                />

                <AuthInput
                  label={t("Last name")}
                  value={form.last_name}
                  onChange={(value) =>
                    updateField(
                      "last_name",
                      value
                    )
                  }
                  autoComplete="family-name"
                />
              </div>
            )}

            <AuthInput
              label={t("Username")}
              value={form.username}
              onChange={(value) =>
                updateField(
                  "username",
                  value
                )
              }
              autoComplete="username"
              required
              placeholder={
                isSignup
                  ? t("Choose a username")
                  : t("Username or email")
              }
            />

            {isSignup && (
              <AuthInput
                label={t("Email")}
                type="email"
                value={form.email}
                onChange={(value) =>
                  updateField(
                    "email",
                    value
                  )
                }
                autoComplete="email"
                required
                placeholder={t("you@company.com")}
              />
            )}

            <AuthInput
              label={t("Password")}
              type="password"
              value={form.password}
              onChange={(value) =>
                updateField(
                  "password",
                  value
                )
              }
              autoComplete={
                isSignup
                  ? "new-password"
                  : "current-password"
              }
              required
              placeholder={
                isSignup
                  ? t("Minimum 8 characters")
                  : t("Enter your password")
              }
            />

            {isSignup && (
              <AuthInput
                label={t("Confirm password")}
                type="password"
                value={
                  form.password_confirm
                }
                onChange={(value) =>
                  updateField(
                    "password_confirm",
                    value
                  )
                }
                autoComplete="new-password"
                required
                placeholder={t("Repeat your password")}
              />
            )}

            {!isSignup && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "-3px",
                  marginBottom: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    onModeChange("forgot")
                  }
                  disabled={busy}
                  style={{
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    color: "#2563eb",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: busy
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {t("Forgot password?")}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "12px 16px",
                border: 0,
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                fontWeight: 700,
                cursor: busy
                  ? "not-allowed"
                  : "pointer",
                opacity: busy ? 0.65 : 1,
                boxShadow:
                  "0 6px 16px rgba(15, 23, 42, 0.12)",
              }}
            >
              {busy
                ? t("Please wait...")
                : isSignup
                ? t("Create account")
                : t("Sign in")}
            </button>
          </form>

          <div
            style={{
              textAlign: "center",
              marginTop: "20px",
              paddingTop: "18px",
              borderTop:
                "1px solid #e2e8f0",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            {isSignup
              ? t("Already have an account?")
              : t("Don't have an account?")}

            <button
              type="button"
              onClick={() =>
                switchMode(
                  isSignup
                    ? "login"
                    : "signup"
                )
              }
              disabled={busy}
              style={{
                marginLeft: "6px",
                padding: 0,
                border: 0,
                background:
                  "transparent",
                color: "#2563eb",
                fontWeight: 700,
                cursor: busy
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {isSignup
                ? t("Sign in")
                : t("Create account")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FORGOT PASSWORD
// ============================================================

function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  const submit = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setSuccess("");
    setResetUrl("");

    try {
      const response = await fetch(
        `${API}/auth/forgot-password/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          getApiError(result)
        );
      }

      setSuccess(
        result.message ||
          t("If an account exists for this email, a password reset link has been sent.")
      );

      if (result.reset_url) {
        setResetUrl(
          result.reset_url
        );
      }
    } catch (error) {
      setError(
        translateMessage(
          error.message
        ) ||
          t(
            t("Unable to send the reset link.")
          )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={authStyles.page}>
      <AuthBrandPanel mode="recovery" />

      <div style={authStyles.formArea}>
        <div style={authStyles.card}>
          <AuthCardHeader
            eyebrow={t("ACCOUNT RECOVERY")}
            title={t("Reset your password")}
            description={t("Enter your registered email and we’ll send you a secure reset link.")}
          />

          <AuthMessage
            error={error}
            success={success}
          />

          {resetUrl && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 13px",
                borderRadius: "10px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1d4ed8",
                fontSize: "13px",
                lineHeight: 1.5,
                wordBreak: "break-all",
              }}
            >
              <b>
                {t(
                  "Local development reset link"
                )}
              </b>

              <div
                style={{
                  marginTop: "7px",
                }}
              >
                <a
                  href={resetUrl}
                  style={{
                    color: "#2563eb",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {t(
                    "Open password reset page"
                  )}
                </a>
              </div>
            </div>
          )}

          <form onSubmit={submit}>
            <AuthInput
              label={t(
                t("Registered email")
              )}
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder={t("you@company.com")}
              required
            />

            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "12px 16px",
                border: 0,
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                fontWeight: 700,
                cursor: busy
                  ? "not-allowed"
                  : "pointer",
                opacity: busy
                  ? 0.65
                  : 1,
              }}
            >
              {busy
                ? t("Sending...")
                : t("Send reset link")}
            </button>
          </form>

          <div
            style={{
              textAlign: "center",
              marginTop: "20px",
              paddingTop: "18px",
              borderTop:
                "1px solid #e2e8f0",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            {t(
              t("Remember your password?")
            )}

            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              style={{
                marginLeft: "6px",
                padding: 0,
                border: 0,
                background:
                  "transparent",
                color: "#2563eb",
                fontWeight: 700,
                cursor: busy
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {t("Back to sign in")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RESET PASSWORD
// ============================================================

function PasswordResetScreen({
  uid,
  token,
  onComplete,
}) {
  const [form, setForm] = useState({
    password: "",
    password_confirm: "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (form.password.length < 8) {
        throw new Error(
          t("Password must be at least 8 characters.")
        );
      }

      if (
        form.password !==
        form.password_confirm
      ) {
        throw new Error(
          t("Passwords do not match.")
        );
      }

      const response = await fetch(
        `${API}/auth/reset-password/${encodeURIComponent(
          uid
        )}/${encodeURIComponent(token)}/`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            password:
              form.password,
            password_confirm:
              form.password_confirm,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getApiError(result)
        );
      }

      if (
        result.access &&
        result.refresh
      ) {
        localStorage.setItem(
          "access_token",
          result.access
        );

        localStorage.setItem(
          "refresh_token",
          result.refresh
        );

        setSuccess(
          result.message ||
            t("Password reset successfully. Signing you in...")
        );

        setTimeout(() => {
          window.location.href = "/";
        }, 700);

        return;
      }

      setSuccess(
        result.message ||
          t("Password reset successfully. You can now sign in with your new password.")
      );

      setTimeout(() => {
        onComplete(null);
      }, 1200);
    } catch (submitError) {
      setError(
        submitError.message ||
          t("Unable to reset your password.")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={authStyles.page}>
      <AuthBrandPanel mode="password reset" />

      <div style={authStyles.formArea}>
        <div style={authStyles.card}>
          <AuthCardHeader
            eyebrow={t("ACCOUNT RECOVERY")}
            title={t("Create new password")}
            description={t("Choose a new secure password for your Log Delivery account.")}
          />

          <AuthMessage
            error={error}
            success={success}
          />

          <form onSubmit={submit}>
            <AuthInput
              label={t("New password")}
              type="password"
              value={form.password}
              onChange={(value) =>
                updateField(
                  "password",
                  value
                )
              }
              autoComplete="new-password"
              placeholder={t("Minimum 8 characters")}
              required
            />

            <AuthInput
              label={t(
                "Confirm new password"
              )}
              type="password"
              value={
                form.password_confirm
              }
              onChange={(value) =>
                updateField(
                  "password_confirm",
                  value
                )
              }
              autoComplete="new-password"
              placeholder={t("Repeat your password")}
              required
            />

            <div
              style={{
                margin: "4px 0 14px",
                padding: "10px 12px",
                borderRadius: "9px",
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              {t(
                "Use at least 8 characters and make both password fields match."
              )}
            </div>

            <button
              type="submit"
              disabled={
                busy || Boolean(success)
              }
              style={{
                width: "100%",
                padding: "12px 16px",
                border: 0,
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                fontWeight: 700,
                cursor:
                  busy || success
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  busy || success
                    ? 0.65
                    : 1,
              }}
            >
              {busy
                ? t("Updating password...")
                : success
                ? t("Password updated")
                : t("Reset password")}
            </button>
          </form>

          <div
            style={{
              textAlign: "center",
              marginTop: "20px",
              paddingTop: "18px",
              borderTop:
                "1px solid #e2e8f0",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            <button
              type="button"
              onClick={() => {
                window.history.replaceState(
                  {},
                  "",
                  "/"
                );
                onComplete(null);
              }}
              disabled={busy}
              style={{
                padding: 0,
                border: 0,
                background:
                  "transparent",
                color: "#2563eb",
                fontWeight: 700,
                cursor: busy
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {t("Back to sign in")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  required = false,
  autoComplete,
  placeholder = "",
}) {
  return (
    <div
      style={{
        marginBottom: "14px",
      }}
    >
      <label
        style={{
          display: "block",
          marginBottom: "6px",
          fontSize: "12px",
          fontWeight: 700,
          color: "#334155",
        }}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "11px 12px",
          border:
            "1px solid #cbd5e1",
          borderRadius: "9px",
          outline: "none",
          background: "#ffffff",
          color: "#0f172a",
          fontSize: "14px",
        }}
        onFocus={(event) => {
          event.currentTarget.style.borderColor =
            "#64748b";

          event.currentTarget.style.boxShadow =
            "0 0 0 3px rgba(100, 116, 139, 0.10)";
        }}
        onBlur={(event) => {
          event.currentTarget.style.borderColor =
            "#cbd5e1";

          event.currentTarget.style.boxShadow =
            "none";
        }}
      />
    </div>
  );
}

// ============================================================
// AUDIT LOG TABLE
// ============================================================

function AuditLogTable({
  logs,
  canDelete = false,
  deletingAuditLogId = null,
  onDelete,
  onView,
}) {
  const columnTemplate = canDelete
    ? "1.1fr 1fr 0.9fr 0.65fr 1fr 1.2fr 0.9fr"
    : "1.25fr 1.1fr 1fr 0.75fr 1.25fr 1.4fr";

  return (
    <div className="table">
      <div
        className="tr th"
        style={{
          gridTemplateColumns:
            columnTemplate,
        }}
      >
        <span>{t("User")}</span>
        <span>{t("Action")}</span>
        <span>{t("Resource")}</span>
        <span>{t("Resource ID")}</span>
        <span>{t("IP Address")}</span>
        <span>{t("Timestamp")}</span>
        {canDelete && (
          <span>{t("Actions")}</span>
        )}
      </div>

      {logs.map((log) => (
        <div
          className="tr"
          key={log.id}
          style={{
            gridTemplateColumns:
              columnTemplate,
          }}
        >
          <span>
            <b>
              {log.username ||
                log.user?.username ||
                t("System")}
            </b>

            {(log.user_id ||
              log.user?.id) && (
              <small>
                {t("User ID")}:{" "}
                {log.user_id ||
                  log.user?.id}
              </small>
            )}
          </span>

          <span>
            <span
              className="status"
              style={{
                background: "#eff6ff",
                color: "#1d4ed8",
              }}
            >
              <ListChecks size={14} />

              {t(log.action || "UNKNOWN")}
            </span>
          </span>

          <span>
            {log.resource ? t(log.resource) : "—"}
          </span>

          <span>
            {log.resource_id || "—"}
          </span>

          <span>
            {log.ip_address || "—"}
          </span>

          <span>
            {log.timestamp
              ? new Date(log.timestamp).toLocaleString(
                  getLocaleForLanguage()
                )
              : "—"}
          </span>

          {canDelete && (
            <span>
              <div className="auditLogActionButtons">
                {onView && (
                  <button
                    className="ghost small auditLogViewButton"
                    type="button"
                    onClick={() =>
                      onView(log)
                    }
                    title={t("View audit log")}
                  >
                    <Eye size={14} />
                    {t("View")}
                  </button>
                )}

                <button
                  className="danger small"
                  type="button"
                  disabled={
                    deletingAuditLogId !== null
                  }
                  onClick={() =>
                    onDelete(log)
                  }
                  title={t(
                    "Delete audit log"
                  )}
                >
                  {String(
                    deletingAuditLogId
                  ) === String(log.id) ? (
                    <>
                      <RefreshCw size={14} />
                      {t("Deleting...")}
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      {t("Delete")}
                    </>
                  )}
                </button>
              </div>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// USER MANAGEMENT TABLE
// ============================================================

function UserManagementTable({
  users,
  currentUserId,
  busy,
  onEdit,
  onToggle,
}) {
  return (
    <div className="table">
      <div className="tr th">
        <span>{t("User")}</span>
        <span>{t("Role")}</span>
        <span>{t("Status")}</span>
        <span>{t("Created")}</span>
        <span>{t("Actions")}</span>
      </div>

      {users.map((user) => {
        const isCurrentUser =
          String(user.id) ===
          String(currentUserId);

        return (
          <div
            className="tr"
            key={user.id}
          >
            <span>
              <img
                className="userAvatar"
                src={user.avatar_url || getUserAvatar(user)}
                alt={t("Avatar for") + " " + (user.username || t("User"))}
              />

              <span className="userIdentity">
              <b>
                {user.username}
              </b>

              <small>
                {user.email}

                {(user.first_name ||
                  user.last_name) &&
                  ` · ${[
                    user.first_name,
                    user.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                `}
              </small>
              </span>
            </span>

            <span>
              <span
                className={`status ${String(
                  user.role || "USER"
                ).toLowerCase()}`}
              >
                <ShieldCheck size={14} />

                {user.role
                  ? t(user.role)
                  : t("USER")}
              </span>
            </span>

            <span>
              <span
                className={`status ${
                  user.is_active
                    ? "success"
                    : "failed"
                }`}
              >
                {user.is_active ? (
                  <CheckCircle2
                    size={14}
                  />
                ) : (
                  <XCircle
                    size={14}
                  />
                )}

                {user.is_active
                  ? t("ACTIVE")
                  : t("INACTIVE")}
              </span>
            </span>

            <span>
              {user.created_at
                ? new Date(
                    user.created_at
                  ).toLocaleString()
                : "—"}
            </span>

            <span>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="ghost small"
                  disabled={busy}
                  onClick={() =>
                    onEdit(user)
                  }
                >
                  <Pencil size={14} />
                  {t("Edit")}
                </button>

                <button
                  className={
                    user.is_active
                      ? "danger small"
                      : "ghost small"
                  }
                  disabled={
                    busy ||
                    isCurrentUser
                  }
                  onClick={() =>
                    onToggle(user)
                  }
                  title={
                    isCurrentUser
                      ? t(
                          "You cannot deactivate your own account."
                        )
                      : ""
                  }
                >
                  {user.is_active ? (
                    <>
                      <XCircle
                        size={14}
                      />
                      {t("Deactivate")}
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={14}
                      />
                      {t("Activate")}
                    </>
                  )}
                </button>
              </div>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// USER MANAGEMENT MODAL
// ============================================================

function UserManagementModal({
  form,
  editing,
  currentUserId,
  busy,
  onChange,
  onClose,
  onSubmit,
}) {
  const isCurrentUser =
    editing &&
    String(form.id) ===
      String(currentUserId);

  return (
    <div className="modalOverlay">
      <div className="modal">
        <div className="modalHeader">
          <div>
            <div className="eyebrow">
              {t(
                "ACCESS ADMINISTRATION"
              )}
            </div>

            <h2>
              {editing
                ? t("Edit user")
                : t("Create user")}
            </h2>

            <span>
              {editing
                ? t(
                    "Update the user's profile, role or account status."
                  )
                : t(
                    "Create an application account and assign its role."
                  )}
            </span>
          </div>

          <button
            className="iconButton"
            onClick={onClose}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="formSectionTitle">
            <Users size={16} />
            {t("Account details")}
          </div>

          <div className="formGrid">
            <FormInput
              label={t("Username")}
              value={form.username}
              onChange={(value) =>
                onChange(
                  "username",
                  value
                )
              }
              placeholder={t(
                "username"
              )}
              required
            />

            <FormInput
              label={t("Email")}
              value={form.email}
              onChange={(value) =>
                onChange(
                  "email",
                  value
                )
              }
              placeholder={t(
                "user@company.com"
              )}
              required
            />

            <FormInput
              label={t("First name")}
              value={form.first_name}
              onChange={(value) =>
                onChange(
                  "first_name",
                  value
                )
              }
              placeholder={t(
                "First name"
              )}
            />

            <FormInput
              label={t("Last name")}
              value={form.last_name}
              onChange={(value) =>
                onChange(
                  "last_name",
                  value
                )
              }
              placeholder={t(
                "Last name"
              )}
            />

            <div className="formField">
              <label>
                {t("Role")}
              </label>

              <select
                value={form.role}
                onChange={(event) =>
                  onChange(
                    "role",
                    event.target.value
                  )
                }
                disabled={
                  isCurrentUser
                }
              >
                <option value="USER">
                  {t("USER")}
                </option>

                <option value="MANAGER">
                  {t("MANAGER")}
                </option>

                <option value="ADMIN">
                  {t("ADMIN")}
                </option>
              </select>

              {isCurrentUser && (
                <span
                  style={{
                    marginTop: "6px",
                  }}
                >
                  {t(
                    "Your ADMIN role cannot be changed from this screen."
                  )}
                </span>
              )}
            </div>

            {editing && (
              <div className="formField">
                <label>
                  {t(
                    "Account status"
                  )}
                </label>

                <select
                  value={
                    form.is_active
                      ? "ACTIVE"
                      : "INACTIVE"
                  }
                  onChange={(event) =>
                    onChange(
                      "is_active",
                      event.target.value ===
                        "ACTIVE"
                    )
                  }
                  disabled={
                    isCurrentUser
                  }
                >
                  <option value="ACTIVE">
                    {t("ACTIVE")}
                  </option>

                  <option value="INACTIVE">
                    {t("INACTIVE")}
                  </option>
                </select>
              </div>
            )}
          </div>

          {!editing && (
            <>
              <div className="formSectionTitle">
                <ShieldCheck size={16} />
                {t(
                  t("Initial password")
                )}
              </div>

              <div className="formGrid">
                <FormInput
                  label={t("Password")}
                  value={form.password}
                  onChange={(value) =>
                    onChange(
                      "password",
                      value
                    )
                  }
                  placeholder={t(
                    t("Minimum 8 characters")
                  )}
                  required
                />

                <FormInput
                  label={t(
                    t("Confirm password")
                  )}
                  value={
                    form.password_confirm
                  }
                  onChange={(value) =>
                    onChange(
                      "password_confirm",
                      value
                    )
                  }
                  placeholder={t(
                    t("Repeat password")
                  )}
                  required
                />
              </div>
            </>
          )}

          <div className="smtpNotice">
            <ShieldCheck size={16} />

            <span>
              {t(
                t("User-management permissions are enforced by the Django backend.")
              )}
            </span>
          </div>

          <div className="modalFooter">
            <button
              type="button"
              className="ghost"
              onClick={onClose}
              disabled={busy}
            >
              {t("Cancel")}
            </button>

            <button
              type="submit"
              className="primary"
              disabled={busy}
            >
              <Save size={16} />

              {busy
                ? t("Saving...")
                : editing
                ? t("Save changes")
                : t("Create user")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// MY PROFILE MODAL
// ============================================================

function ProfileModal({
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div className="modalOverlay">
      <div className="modal">
        <div className="modalHeader">
          <div>
            <div className="eyebrow">
              {t("ACCOUNT")}
            </div>

            <h2>
              {t("Edit profile")}
            </h2>

            <span>
              {t(
                t("Update your personal account information.")
              )}
            </span>
          </div>

          <button
            className="iconButton"
            onClick={onClose}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="formSectionTitle">
            <UserCircle2 size={16} />
            {t(
              "Personal information"
            )}
          </div>

          <div className="formGrid">
            <div className="formField">
              <label>
                {t("Username")}
              </label>

              <input
                value={form.username}
                readOnly
                disabled
              />

              <span
                style={{
                  marginTop: "6px",
                }}
              >
                {t(
                  t("Username cannot be changed from the profile screen.")
                )}
              </span>
            </div>

            <FormInput
              label={t("Email")}
              value={form.email}
              onChange={(value) =>
                onChange(
                  "email",
                  value
                )
              }
              placeholder={t("user@company.com")}
              required
            />

            <FormInput
              label={t("First name")}
              value={form.first_name}
              onChange={(value) =>
                onChange(
                  "first_name",
                  value
                )
              }
              placeholder={t("First name")}
            />

            <FormInput
              label={t("Last name")}
              value={form.last_name}
              onChange={(value) =>
                onChange(
                  "last_name",
                  value
                )
              }
              placeholder={t("Last name")}
            />
          </div>

          <div className="smtpNotice">
            <ShieldCheck size={16} />

            <span>
              {t(
                t("Your role and account status are managed separately and cannot be changed here.")
              )}
            </span>
          </div>

          <div className="modalFooter">
            <button
              type="button"
              className="ghost"
              onClick={onClose}
              disabled={busy}
            >
              {t("Cancel")}
            </button>

            <button
              type="submit"
              className="primary"
              disabled={busy}
            >
              <Save size={16} />

              {busy
                ? t("Saving...")
                : t("Save profile")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// REPOSITORY WIZARD STEP INDICATOR
// ============================================================

function RepositoryWizardSteps({
  currentStep,
}) {
  const steps = [
    {
      number: 1,
      label: t("Source"),
    },
    {
      number: 2,
      label: t("Authentication"),
    },
    {
      number: 3,
      label: t("Targets"),
    },
    {
      number: 4,
      label: t("Delivery"),
    },
    {
      number: 5,
      label: t("Review"),
    },
  ];

  return (
    <div
      className="repositoryWizardSteps"
      aria-label={t("Repository configuration steps")}
    >
      {steps.map((step, index) => {
        const completed =
          currentStep > step.number;

        const active =
          currentStep === step.number;

        return (
          <React.Fragment key={step.number}>
            <div
              className={`repositoryWizardStep ${
                active
                  ? "active"
                  : completed
                  ? "completed"
                  : ""
              }`}
            >
              <div className="repositoryWizardCircle">
                {completed ? (
                  <CheckCircle2
                    size={13}
                  />
                ) : (
                  step.number
                )}
              </div>

              <span>
                {t(step.label)}
              </span>
            </div>

            {index <
              steps.length - 1 && (
              <div
                className={`repositoryWizardLine ${
                  currentStep >
                  step.number
                    ? "completed"
                    : ""
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================
// REPOSITORY MODAL
// ============================================================

function RepositoryModal({
  form,
  editing,
  busy,
  connectionResult,
  onChange,
  onClose,
  onSubmit,
  onTestConnection,
  branches,
  branchesLoading,
  branchesError,
  onFetchBranches,
  onAddTarget,
  onRemoveTarget,
  onUpdateTarget,
  onAddRecipient,
  onRemoveRecipient,
  onUpdateRecipient,
}) {
  const [currentStep, setCurrentStep] =
    useState(1);

  const isLocal =
    form.repository_type ===
    "LOCAL";

  const goNext = () => {
    setCurrentStep((previous) =>
      Math.min(5, previous + 1)
    );
  };

  const goBack = () => {
    setCurrentStep((previous) =>
      Math.max(1, previous - 1)
    );
  };

  const submitFinal = (event) => {
    event.preventDefault();

    if (currentStep < 5) {
      goNext();
      return;
    }

    onSubmit(event);
  };

  const sourceValue = isLocal
    ? form.local_path
    : form.repository_url;

  const targets = Array.isArray(
    form.targets
  )
    ? form.targets
    : [];

  const recipients = Array.isArray(
    form.recipients
  )
    ? form.recipients
    : [];

  const sourceTypeLabel =
    form.repository_type ===
    "AZURE_DEVOPS"
      ? t("Azure DevOps")
      : form.repository_type ===
        "GITLAB"
      ? t("GitLab")
      : form.repository_type ===
        "INTERNAL_GIT"
      ? t("Internal Git")
      : form.repository_type ===
        "LOCAL"
      ? t("Local Git")
      : t("GitHub");

  return (
    <div className="modalOverlay repositoryModalOverlay">
      <div className="modal repositoryWizardModal">
        <div className="modalHeader repositoryWizardHeader">
          <div>
            <h2>
              {editing
                ? t("Edit repository")
                : t("Add repository")}
            </h2>

            <span>
              {t(
                t("Follow the steps to configure your repository.")
              )}
            </span>
          </div>

          <button
            className="iconButton"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("Close")}
          >
            <X size={18} />
          </button>
        </div>

        <RepositoryWizardSteps
          currentStep={currentStep}
        />

        <form
          onSubmit={submitFinal}
          className="repositoryWizardForm"
        >
          {currentStep === 1 && (
            <div className="repositoryWizardPanel">
              <div className="repositoryWizardPanelHeader">
                <div className="repositoryWizardPanelIcon">
                  <GitBranch size={18} />
                </div>

                <div>
                  <h3>
                    {t(
                      "Repository source"
                    )}
                  </h3>

                  <p>
                    {t(
                      "Configure where the application will collect files from."
                    )}
                  </p>
                </div>
              </div>

              <div className="formGrid">
                <FormInput
                  label={t(
                    "Repository name"
                  )}
                  value={form.name}
                  onChange={(value) =>
                    onChange(
                      "name",
                      value
                    )
                  }
                  placeholder={t("SR Finance")}
                  required
                />

                <FormInput
                  label={t("Description")}
                  value={
                    form.description
                  }
                  onChange={(value) =>
                    onChange(
                      "description",
                      value
                    )
                  }
                  placeholder={t("Application log delivery source")}
                />

                <div className="formField">
                  <label>
                    {t(
                      "Repository type"
                    )}
                  </label>

                  <select
                    value={
                      form.repository_type
                    }
                    onChange={(event) =>
                      onChange(
                        "repository_type",
                        event.target.value
                      )
                    }
                  >
                    <option value="GITHUB">
                      {t("GitHub")}
                    </option>

                    <option value="GITLAB">
                      {t("GitLab")}
                    </option>

                    <option value="AZURE_DEVOPS">
                      {t(
                        "Azure DevOps"
                      )}
                    </option>

                    <option value="INTERNAL_GIT">
                      {t(
                        "Internal Git"
                      )}
                    </option>

                    <option value="LOCAL">
                      {t("Local Git")}
                    </option>
                  </select>
                </div>

                {isLocal ? (
                  <FormInput
                    label={t(
                      "Local repository path"
                    )}
                    value={
                      form.local_path
                    }
                    onChange={(value) =>
                      onChange(
                        "local_path",
                        value
                      )
                    }
                    placeholder={t("C:\\Projects\\MyApplication")}
                    required
                  />
                ) : (
                  <FormInput
                    label={t(
                      "Repository URL"
                    )}
                    value={
                      form.repository_url
                    }
                    onChange={(value) =>
                      onChange(
                        "repository_url",
                        value
                      )
                    }
                    placeholder="https://github.com/org/project"
                    required
                  />
                )}

                {isLocal ? (
                  <FormInput
                    label={t("Default branch")}
                    value={form.branch}
                    onChange={(value) =>
                      onChange(
                        "branch",
                        value
                      )
                    }
                    placeholder="main"
                    required
                  />
                ) : (
                  <div className="formField">
                    <label>
                      {t(
                        t("Default branch")
                      )}
                    </label>

                    <div
                      className="repositoryBranchControl"
                    >
                      <select
                        value={
                          form.branch ||
                          ""
                        }
                        onChange={(event) =>
                          onChange(
                            "branch",
                            event.target.value
                          )
                        }
                        disabled={
                          branchesLoading
                        }
                        required
                      >
                        {branches.length ===
                          0 && (
                          <option
                            value={
                              form.branch ||
                              "main"
                            }
                          >
                            {form.branch ||
                              "main"}
                          </option>
                        )}

                        {branches.map(
                          (branch) => (
                            <option
                              key={branch}
                              value={branch}
                            >
                              {branch}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        type="button"
                        className="ghost small"
                        onClick={
                          onFetchBranches
                        }
                        disabled={
                          busy ||
                          !editing ||
                          branchesLoading
                        }
                        title={
                          !editing
                            ? t("Save the repository first.")
                            : t("Fetch branches from the repository")
                        }
                      >
                        <GitBranch
                          size={14}
                        />

                        {branchesLoading
                          ? t("Loading...")
                          : t("Fetch branches")}
                      </button>
                    </div>

                    {branchesError && (
                      <span
                        style={{
                          color:
                            "#c0392b",
                          marginTop:
                            "6px",
                        }}
                      >
                        {
                          branchesError
                        }
                      </span>
                    )}

                    {!branchesLoading &&
                      !branchesError &&
                      branches.length ===
                        0 &&
                      editing && (
                        <span
                          style={{
                            marginTop:
                              "6px",
                          }}
                        >
                          {t(
                            t("Click Fetch to load all branches from this repository.")
                          )}
                        </span>
                      )}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="repositoryWizardPanel">
              <div className="repositoryWizardPanelHeader">
                <div className="repositoryWizardPanelIcon">
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <h3>
                    {t(
                      t("Authentication")
                    )}
                  </h3>

                  <p>
                    {t(
                      t("Configure how Log Delivery authenticates with the repository.")
                    )}
                  </p>
                </div>
              </div>

              {isLocal ? (
                <div className="smtpNotice">
                  <ShieldCheck size={16} />

                  <span>
                    {t(
                      t("Local Git repositories do not require remote authentication.")
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <div className="formField">
                    <label>
                      {t(
                        "Authentication type"
                      )}
                    </label>

                    <select
                      value={
                        form.auth_type ||
                        "NONE"
                      }
                      onChange={(
                        event
                      ) => {
                        const value =
                          event
                            .target
                            .value;

                        onChange(
                          "auth_type",
                          value
                        );

                        if (
                          value ===
                          "NONE"
                        ) {
                          onChange(
                            "username",
                            ""
                          );

                          onChange(
                            "token",
                            ""
                          );
                        }
                      }}
                    >
                      <option value="NONE">
                        {t(
                          t("Public repository — No authentication")
                        )}
                      </option>

                      <option value="PAT">
                        {t(
                          t("Private repository — Personal Access Token")
                        )}
                      </option>
                    </select>
                  </div>

                  {form.auth_type ===
                    "PAT" && (
                    <>
                      <div className="formGrid">
                        <FormInput
                          label={t(
                            "Git username"
                          )}
                          value={
                            form.username ||
                            ""
                          }
                          onChange={(
                            value
                          ) =>
                            onChange(
                              "username",
                              value
                            )
                          }
                          placeholder="github-username"
                          required
                        />

                        <div className="formField">
                          <label>
                            {t(
                              "Personal Access Token"
                            )}
                          </label>

                          <input
                            type="password"
                            value={
                              form.token ||
                              ""
                            }
                            onChange={(
                              event
                            ) =>
                              onChange(
                                "token",
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder={
                              editing
                                ? t("Enter PAT again only if changing or repairing authentication")
                                : "ghp_xxxxxxxxxxxxxxxxxxxx"
                            }
                            required={
                              !editing
                            }
                            autoComplete="new-password"
                          />

                          <span
                            style={{
                              marginTop:
                                "6px",
                              lineHeight:
                                1.45,
                            }}
                          >
                            {editing
                              ? form.authentication_configured
                                ? t("A credential is already stored. Leave this blank to keep it.")
                                : t("No credential is currently stored. Enter the PAT to repair authentication.")
                              : t("The PAT will be encrypted and stored by Django. It will never be returned to the browser.")}
                          </span>
                        </div>
                      </div>

                      <div className="smtpNotice">
                        <ShieldCheck
                          size={16}
                        />

                        <span>
                          {form.authentication_configured
                            ? t("Authentication is already configured. Leave the token blank to keep the existing credential.")
                            : t("The token is sent only to Django for secure storage. Never put a PAT in the repository URL.")}
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}

              {connectionResult && (
                <div
                  className={
                    connectionResult.success
                      ? "connectionResult success"
                      : "connectionResult failed"
                  }
                >
                  {connectionResult.success ? (
                    <CheckCircle2
                      size={17}
                    />
                  ) : (
                    <XCircle
                      size={17}
                    />
                  )}

                  <div>
                    <b>
                      {
                        connectionResult.message
                      }
                    </b>

                    {connectionResult.details && (
                      <span>
                        Branch:{" "}
                        {
                          connectionResult
                            .details
                            .branch
                        }

                        {" · "}

                        Commit:{" "}
                        {
                          connectionResult
                            .details
                            .commit
                        }
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="repositoryWizardPanel">
              <div className="repositoryWizardPanelHeader">
                <div className="repositoryWizardPanelIcon">
                  <Target size={18} />
                </div>

                <div>
                  <h3>
                    {t(
                      t("Target selection")
                    )}
                  </h3>

                  <p>
                    {t(
                      "Add one or more files or folders you want to collect."
                    )}
                  </p>
                </div>
              </div>

              <div className="targetHint">
                {t(
                  t("Add one or more files or folders relative to the repository root.")
                )}

                {" "}

                {t("Examples:")}{" "}
                <b>
                  backend/logs
                </b>
                ,{" "}
                <b>
                  frontend/logs
                </b>
                ,{" "}
                <b>
                  logs/application.log
                </b>
              </div>

              <div
                className="repositoryTargetList"
              >
                {targets.map(
                  (
                    target,
                    index
                  ) => (
                    <div
                      className="repositoryTargetRow"
                      key={index}
                    >
                      <div className="formField">
                        <label>
                          {t("Target")}{" "}
                          {index + 1}
                        </label>

                        <input
                          value={
                            target.path ||
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            onUpdateTarget(
                              index,
                              "path",
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="frontend/src/logs"
                          required
                        />
                      </div>

                      <div className="formField">
                        <label>
                          {t(
                            "Extensions"
                          )}
                        </label>

                        <input
                          value={
                            Array.isArray(
                              target.extensions
                            )
                              ? target.extensions.join(
                                  ", "
                                )
                              : ""
                          }
                          onChange={(
                            event
                          ) =>
                            onUpdateTarget(
                              index,
                              "extensions",
                              event.target.value
                                .split(
                                  ","
                                )
                                .map(
                                  (
                                    item
                                  ) =>
                                    item.trim()
                                )
                                .filter(
                                  Boolean
                                )
                            )
                          }
                          placeholder={t(".log, .txt, .json")}
                        />
                      </div>

                      <button
                        type="button"
                        className="danger small repositoryDeleteButton"
                        onClick={() =>
                          onRemoveTarget(
                            index
                          )
                        }
                        disabled={
                          busy ||
                          targets.length <=
                            1
                        }
                        title={t(
                          "Remove target"
                        )}
                      >
                        <Trash2
                          size={14}
                        />
                      </button>
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                className="ghost small"
                onClick={
                  onAddTarget
                }
                disabled={busy}
              >
                <Plus size={15} />
                {t("Add target")}
              </button>
            </div>
          )}

          {currentStep === 4 && (
            <div className="repositoryWizardPanel">
              <div className="repositoryWizardPanelHeader">
                <div className="repositoryWizardPanelIcon">
                  <Mail size={18} />
                </div>

                <div>
                  <h3>
                    {t(
                      t("Delivery configuration")
                    )}
                  </h3>

                  <p>
                    {t(
                      t("Configure recipients and delivery method.")
                    )}
                  </p>
                </div>
              </div>

              <div className="formGrid">
                <div className="formField">
                  <label>
                    {t(
                      "Recipients"
                    )}
                  </label>

                  <div className="repositoryRecipientList">
                    {recipients.map(
                      (
                        recipient,
                        index
                      ) => (
                        <div
                          className="repositoryRecipientRow"
                          key={index}
                        >
                          <input
                            type="email"
                            value={
                              recipient ||
                              ""
                            }
                            onChange={(
                              event
                            ) =>
                              onUpdateRecipient(
                                index,
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="admin@company.com"
                            required
                          />

                          <button
                            type="button"
                            className="danger small"
                            onClick={() =>
                              onRemoveRecipient(
                                index
                              )
                            }
                            disabled={
                              busy
                            }
                            title={t(
                              "Remove recipient"
                            )}
                          >
                            <Trash2
                              size={14}
                            />
                          </button>
                        </div>
                      )
                    )}

                    <button
                      type="button"
                      className="ghost small"
                      onClick={
                        onAddRecipient
                      }
                      disabled={busy}
                    >
                      <Plus size={15} />
                      {t(
                        "Add recipient"
                      )}
                    </button>
                  </div>
                </div>

                <div className="formField">
                  <label>
                    {t(
                      "Email mode"
                    )}
                  </label>

                  <select
                    value={
                      form.email_mode
                    }
                    onChange={(event) =>
                      onChange(
                        "email_mode",
                        event.target.value
                      )
                    }
                  >
                    <option value="SMTP">
                      {t(
                        t("SMTP — Real delivery")
                      )}
                    </option>

                    <option value="SIMULATION">
                      {t(
                        t("Simulation — No email")
                      )}
                    </option>
                  </select>
                </div>
              </div>

              {form.email_mode ===
                "SMTP" && (
                <div className="smtpNotice">
                  <ShieldCheck
                    size={16}
                  />

                  <span>
                    {t("SMTP delivery is enabled. The configured archive will be sent to the recipients after a successful run.")}
                  </span>
                </div>
              )}

              {!isLocal &&
                onTestConnection && (
                  <div
                    className="repositoryTestArea"
                  >
                    <button
                      type="button"
                      className="ghost small"
                      onClick={
                        onTestConnection
                      }
                      disabled={
                        busy ||
                        !editing
                      }
                      title={
                        !editing
                          ? t("Save the repository first.")
                          : t("Test repository connection")
                      }
                    >
                      <Wifi size={15} />
                      {t(
                        "Test connection"
                      )}
                    </button>

                    {!editing && (
                      <span>
                        {t(
                          t("Save the repository first to test the connection.")
                        )}
                      </span>
                    )}
                  </div>
                )}

              {connectionResult && (
                <div
                  className={
                    connectionResult.success
                      ? "connectionResult success"
                      : "connectionResult failed"
                  }
                >
                  {connectionResult.success ? (
                    <CheckCircle2
                      size={17}
                    />
                  ) : (
                    <XCircle
                      size={17}
                    />
                  )}

                  <div>
                    <b>
                      {
                        connectionResult.message
                      }
                    </b>

                    {connectionResult.details && (
                      <span>
                        Branch:{" "}
                        {
                          connectionResult
                            .details
                            .branch
                        }

                        {" · "}

                        Commit:{" "}
                        {
                          connectionResult
                            .details
                            .commit
                        }
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="repositoryWizardPanel">
              <div className="repositoryWizardPanelHeader">
                <div className="repositoryWizardPanelIcon">
                  <CheckCircle2 size={18} />
                </div>

                <div>
                  <h3>
                    {t(
                      "Review & confirm"
                    )}
                  </h3>

                  <p>
                    {t(
                      t("Please review your repository configuration before saving.")
                    )}
                  </p>
                </div>
              </div>

              <div className="repositoryReview">
                <div className="repositoryReviewRow">
                  <span>
                    {t("Name")}
                  </span>

                  <strong>
                    {form.name ||
                      "—"}
                  </strong>
                </div>

                <div className="repositoryReviewRow">
                  <span>
                    {t("Type")}
                  </span>

                  <strong>
                    {sourceTypeLabel}
                  </strong>
                </div>

                <div className="repositoryReviewRow">
                  <span>
                    {t("URL")}
                  </span>

                  <strong>
                    {sourceValue ||
                      "—"}
                  </strong>
                </div>

                <div className="repositoryReviewRow">
                  <span>
                    {t("Branch")}
                  </span>

                  <strong>
                    {form.branch ||
                      "main"}
                  </strong>
                </div>

                <div className="repositoryReviewRow">
                  <span>
                    {t("Targets")}
                  </span>

                  <strong>
                    {targets.length}{" "}
                    {t(
                      "configured"
                    )}
                  </strong>
                </div>

                <div className="repositoryReviewRow">
                  <span>
                    {t("Recipients")}
                  </span>

                  <strong>
                    {
                      recipients.filter(
                        Boolean
                      ).length
                    }{" "}
                    {t(
                      "recipients"
                    )}
                  </strong>
                </div>

                <div className="repositoryReviewRow">
                  <span>
                    {t("Delivery")}
                  </span>

                  <strong>
                    {form.email_mode ===
                    "SIMULATION"
                      ? t("Simulation — No email")
                      : t("SMTP — Real delivery")}
                  </strong>
                </div>

                <div className="repositoryReviewRow">
                  <span>
                    {t(
                      t("Authentication")
                    )}
                  </span>

                  <strong>
                    {isLocal
                      ? t("Local Git")
                      : form.auth_type ===
                        "PAT"
                      ? t("PAT (Personal Access Token)")
                      : t("Public repository")}
                  </strong>
                </div>
              </div>

              <div className="repositoryReviewTargets">
                <div className="repositoryReviewTitle">
                  <Target size={15} />

                  <b>
                    {t(
                      "Configured targets"
                    )}
                  </b>
                </div>

                {targets.length >
                0 ? (
                  targets.map(
                    (
                      target,
                      index
                    ) => (
                      <div
                        className="repositoryReviewTarget"
                        key={index}
                      >
                        <span>
                          {index + 1}
                        </span>

                        <strong>
                          {target.path ||
                            "—"}
                        </strong>

                        <small>
                          {Array.isArray(
                            target.extensions
                          )
                            ? target.extensions.join(
                                ", "
                              )
                            : t("All supported files")}
                        </small>
                      </div>
                    )
                  )
                ) : (
                  <div className="repositoryReviewTarget">
                    <strong>
                      {t(
                        "No targets configured"
                      )}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="modalFooter repositoryWizardFooter">
            <div className="repositoryWizardFooterLeft">
              {currentStep > 1 ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={goBack}
                  disabled={busy}
                >
                  ← {t("Back")}
                </button>
              ) : (
                <button
                  type="button"
                  className="ghost"
                  onClick={onClose}
                  disabled={busy}
                >
                  {t("Cancel")}
                </button>
              )}
            </div>

            <div className="repositoryWizardFooterRight">
              {currentStep === 4 &&
                onTestConnection && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={
                      onTestConnection
                    }
                    disabled={
                      busy ||
                      !editing
                    }
                  >
                    <Wifi size={15} />
                    {t(
                      "Test connection"
                    )}
                  </button>
                )}

              {currentStep < 5 ? (
                <button
                  type="submit"
                  className="primary"
                  disabled={busy}
                >
                  {t("Next")}
                  <span
                    style={{
                      fontSize:
                        "17px",
                      lineHeight: 1,
                    }}
                  >
                    →
                  </span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="primary"
                  disabled={busy}
                >
                  <Save size={16} />

                  {busy
                    ? editing
                      ? t(
                          t("Saving...")
                        )
                      : t(
                          "Creating..."
                        )
                    : editing
                    ? t(
                        "Save changes"
                      )
                    : t(
                        t("Save repository")
                      )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
// ============================================================
// REPOSITORY CARD
// ============================================================

function RepositoryCard({
  repository,
  busy,
  canManage,
  canDelete,
  selected,
  onSelect,
  onEdit,
  onTest,
  onDelete,
  onActivate,
}) {
  // ------------------------------------------------------------
  // IMPORTANT:
  // A deactivated repository is NOT deleted.
  // It remains in the database and remains visible in the UI.
  // ------------------------------------------------------------

  const isActive =
    repository?.active !== false;

  const status = String(
    repository?.connection_status ||
      "UNKNOWN"
  ).toUpperCase();

  const statusClass =
    !isActive
      ? "failed"
      : status === "CONNECTED"
      ? "connected"
      : status === "FAILED" ||
        status === "OFFLINE"
      ? "failed"
      : "unknown";

  const source =
    repository?.repository_type ===
    "LOCAL"
      ? repository?.local_path
      : repository?.repository_url;

  const targets = Array.isArray(
    repository?.targets
  )
    ? repository.targets
    : [];

  const targetCount =
    targets.length > 0
      ? targets.length
      : repository?.target_path ||
        repository?.log_directory
      ? 1
      : 0;

  const primaryTarget =
    targets[0]?.path ||
    repository?.target_path ||
    repository?.log_directory ||
    t("Not configured");

  const recipients =
    Array.isArray(
      repository?.recipients
    )
      ? repository.recipients.filter(
          Boolean
        )
      : [];

  const extensionValues =
    targets.length > 0
      ? targets.flatMap((target) =>
          Array.isArray(
            target?.extensions
          )
            ? target.extensions
            : []
        )
      : Array.isArray(
          repository?.extensions
        )
      ? repository.extensions
      : [];

  const extensions = Array.from(
    new Set(
      extensionValues.filter(Boolean)
    )
  );

  const provider =
    repository?.repository_type ||
    "GITHUB";

  const authentication =
    repository?.authentication_configured
      ? "PAT"
      : "PUBLIC";

  const connectionLabel =
    !isActive
      ? t("Deactivated")
      : status === "CONNECTED"
      ? "Connected"
      : status === "FAILED"
      ? "Needs attention"
      : status === "OFFLINE"
      ? "Offline"
      : "Unknown";

  const StatusIcon =
    !isActive
      ? XCircle
      : status === "CONNECTED"
      ? CheckCircle2
      : status === "FAILED" ||
        status === "OFFLINE"
      ? XCircle
      : Clock3;

  const formatDate = (value) => {
    if (!value) {
      return t("Never");
    }

    try {
      return new Date(
        value
      ).toLocaleString();
    } catch {
      return String(value);
    }
  };

  const lastChecked =
    repository?.last_checked_at ||
    repository?.last_checked ||
    repository?.checked_at;

  const lastSuccessfulDelivery =
    repository?.last_successful_delivery_at ||
    repository?.last_successful_delivery ||
    repository?.last_delivery_at;

  return (
    <article
      className={`repoCard targetRepoCard ${
        selected ? "selected" : ""
      } ${statusClass} ${
        !isActive
          ? "deactivated"
          : ""
      }`}
      onClick={
        isActive
          ? onSelect
          : undefined
      }
      style={{
        cursor: isActive
          ? "pointer"
          : "default",
      }}
    >
      {/* ====================================================
          CARD HEADER
      ==================================================== */}

      <div className="targetRepoHeader">
        <div className="targetRepoIdentity">
          <div className="repoIcon targetRepoIcon">
            <FolderGit2 size={21} />
          </div>

          <div className="repoInfo">
            <div className="repoTitle">
              <b>
                {repository?.name ||
                  t("Unnamed repository")}
              </b>

              {selected && isActive && (
                <span className="selectedBadge">
                  {t("Selected")}
                </span>
              )}

              {!isActive && (
                <span className="selectedBadge">
                  {t("Deactivated")}
                </span>
              )}
            </div>

            {repository?.description && (
              <p>
                {
                  repository.description
                }
              </p>
            )}
          </div>
        </div>

        <span
          className={`connectionBadge ${statusClass}`}
        >
          <StatusIcon size={13} />
          {t(connectionLabel)}
        </span>
      </div>

      {/* ====================================================
          SOURCE URL
      ==================================================== */}

      <div className="targetRepoSource">
        <Link2 size={13} />

        <span title={source || ""}>
          {source ||
            t("Source not configured")}
        </span>
      </div>

      {/* ====================================================
          DETAIL GRID
      ==================================================== */}

      <div className="targetRepoDetails">
        <div className="targetRepoDetail">
          <GitBranch size={14} />

          <div>
            <span>
              {t("Branch")}
            </span>

            <strong>
              {repository?.branch ||
                "main"}
            </strong>
          </div>
        </div>

        <div className="targetRepoDetail">
          <Target size={14} />

          <div>
            <span>
              {t("Targets")}
            </span>

            <strong>
              {primaryTarget}
            </strong>
          </div>
        </div>

        <div className="targetRepoDetail">
          <Users size={14} />

          <div>
            <span>
              {t("Recipients")}
            </span>

            <strong>
              {recipients.length}
            </strong>
          </div>
        </div>

        <div className="targetRepoDetail">
          <Server size={14} />

          <div>
            <span>
              {t("Provider")}
            </span>

            <strong>
              {provider}
            </strong>
          </div>
        </div>

        <div className="targetRepoDetail">
          <ShieldCheck size={14} />

          <div>
            <span>
              {t("Authentication")}
            </span>

            <strong>
              {authentication}
            </strong>
          </div>
        </div>

        <div className="targetRepoDetail">
          <Mail size={14} />

          <div>
            <span>
              {t("Delivery")}
            </span>

            <strong>
              {repository?.email_mode ||
                t("SMTP")}
            </strong>
          </div>
        </div>
      </div>

      {/* ====================================================
          CONFIGURED TARGETS
      ==================================================== */}

      <div className="targetRepoTargets">
        <div className="targetRepoSectionLabel">
          <Target size={13} />

          <span>
            {t("Configured targets")}
          </span>
        </div>

        <div className="targetRepoTargetList">
          {targets.length > 0 ? (
            targets
              .slice(0, 3)
              .map(
                (
                  target,
                  index
                ) => (
                  <div
                    className="targetRepoTarget"
                    key={`${repository?.id || "repository"}-${index}`}
                  >
                    <span className="targetRepoTargetIndex">
                      {index + 1}
                    </span>

                    <span
                      title={
                        target?.path ||
                        ""
                      }
                    >
                      {target?.path ||
                        t(
                          t("Not configured")
                        )}
                    </span>
                  </div>
                )
              )
          ) : (
            <div className="targetRepoTarget">
              <span
                title={
                  repository?.target_path ||
                  repository?.log_directory ||
                  ""
                }
              >
                {repository?.target_path ||
                  repository?.log_directory ||
                  t(
                    t("Not configured")
                  )}
              </span>
            </div>
          )}

          {targetCount > 3 && (
            <span className="targetRepoMore">
              +{targetCount - 3}{" "}
              {t("more")}
            </span>
          )}
        </div>

        {extensions.length > 0 && (
          <div className="targetRepoExtensions">
            {extensions
              .slice(0, 5)
              .map(
                (extension) => (
                  <span key={extension}>
                    {extension}
                  </span>
                )
              )}

            {extensions.length > 5 && (
              <span>
                +{extensions.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ====================================================
          ACTIVITY
      ==================================================== */}

      <div className="targetRepoActivity">
        <div>
          <span>
            {t("Last checked")}
          </span>

          <strong>
            {formatDate(
              lastChecked
            )}
          </strong>
        </div>

        <div>
          <span>
            {t(
              "Last successful delivery"
            )}
          </span>

          <strong>
            {formatDate(
              lastSuccessfulDelivery
            )}
          </strong>
        </div>
      </div>

      {/* ====================================================
          ACTIONS
      ==================================================== */}

      <div className="repoActions targetRepoActions">

        {/* ----------------------------------------------------
            ACTIVE REPOSITORY
        ---------------------------------------------------- */}

        {isActive && (
          <>
            <button
              type="button"
              className={
                selected
                  ? "primary small"
                  : "ghost small"
              }
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onSelect();
              }}
            >
              {selected
                ? t("Selected")
                : t("Use repository")}
            </button>

            {canManage && (
              <button
                type="button"
                className="ghost small"
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  onTest(repository);
                }}
              >
                <Wifi size={14} />
                {t("Test")}
              </button>
            )}

            {canManage && (
              <button
                type="button"
                className="ghost small"
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(repository);
                }}
              >
                <Pencil size={14} />
                {t("Edit")}
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                className="danger small"
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(repository);
                }}
              >
                <Trash2 size={14} />
                {t("Deactivate")}
              </button>
            )}
          </>
        )}

        {/* ----------------------------------------------------
            DEACTIVATED REPOSITORY
        ---------------------------------------------------- */}

        {!isActive && (
          <>
            <span className="connectionBadge failed">
              <XCircle size={14} />
              {t("Deactivated")}
            </span>

            <button
              type="button"
              className="ghost small"
              disabled
              title={t(
                t("Deactivated repositories cannot be tested.")
              )}
            >
              <Wifi size={14} />
              {t("Test")}
            </button>

            <button
              type="button"
              className="ghost small"
              disabled
              title={t(
                t("Deactivated repositories cannot be used for delivery.")
              )}
            >
              <Send size={14} />
              {t("Use repository")}
            </button>

            {canManage && (
              <button
                type="button"
                className="primary small"
                disabled={
                  busy ||
                  typeof onActivate !==
                    "function"
                }
                onClick={(event) => {
                  event.stopPropagation();

                  if (
                    typeof onActivate ===
                    "function"
                  ) {
                    onActivate(
                      repository
                    );
                  }
                }}
                title={t(
                  t("Activate repository")
                )}
              >
                <CheckCircle2
                  size={14}
                />
                {t("Activate")}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

// ============================================================
// REPOSITORY SUMMARY
// ============================================================

function RepositorySummary({
  repository,
}) {
  const source =
    repository.repository_type ===
    "LOCAL"
      ? repository.local_path
      : repository.repository_url;

  return (
    <div className="repo">
      <div className="repoIcon">
        <GitBranch />
      </div>

      <b>
        {repository.name}
      </b>

      <span>
        {source}
      </span>

      <div className="repoRow">
        <span>
          {t("Type")}
        </span>

        <b>
          {repository.repository_type}
        </b>
      </div>

      <div className="repoRow">
        <span>
          {t("Branch")}
        </span>

        <b>
          {repository.branch}
        </b>
      </div>

      <div className="repoRow">
        <span>
          {t("Target")}
        </span>

        <b>
          {repository.target_path ||
            repository.log_directory ||
            t("Not configured")}
        </b>
      </div>

      <div className="repoRow">
        <span>
          {t("Connection")}
        </span>

        <b
          className={
            repository.connection_status ===
            "CONNECTED"
              ? "green"
              : repository.connection_status ===
                "FAILED"
              ? "red"
              : ""
          }
        >
          {repository.connection_status
            ? t(repository.connection_status)
            : t("UNKNOWN")}
        </b>
      </div>

      <div className="repoRow">
        <span>
          {t("Authentication")}
        </span>

        <b
          className={
            repository.authentication_configured
              ? "green"
              : ""
          }
        >
          {repository.authentication_configured
            ? `PAT${
                repository.username
                  ? ` · ${repository.username}`
                  : ""
              }`
            : "NONE"}
        </b>
      </div>

      <div className="repoRow">
        <span>
          {t("Email")}
        </span>

        <b className="green">
          {repository.email_mode}
        </b>
      </div>
    </div>
  );
}

// ============================================================
// AUDIT LOG DETAIL MODAL
// ============================================================

function AuditLogDetailModal({
  log,
  onClose,
}) {
  if (!log) return null;

  return (
    <div className="modalOverlay">
      <div className="deliveryModal auditLogDetailModal">
        <div className="deliveryResultHeader">
          <div className="resultIcon success">
            <Eye size={25} />
          </div>

          <div className="resultHeaderText">
            <div className="eyebrow">
              {t("AUDIT LOG")}
            </div>

            <h2>
              {String(log.action || "UNKNOWN").replaceAll("_", " ")}
            </h2>

            <span>
              {log.timestamp
                ? new Date(log.timestamp).toLocaleString()
                : "—"}
            </span>
          </div>

          <button className="iconButton" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="resultGrid">
          <ResultItem icon={Users} label={t("User")} value={log.username || log.user?.username || t("System")} />
          <ResultItem icon={IdCard} label={t("User ID")} value={log.user_id || log.user?.id || "—"} />
          <ResultItem icon={ListChecks} label={t("Action")} value={String(log.action || "UNKNOWN").replaceAll("_", " ")} />
          <ResultItem icon={FolderGit2} label={t("Resource")} value={log.resource ? t(log.resource) : "—"} />
          <ResultItem icon={FileText} label={t("Resource ID")} value={log.resource_id || "—"} mono />
          <ResultItem icon={Globe2} label={t("IP Address")} value={log.ip_address || "—"} mono />
          <ResultItem icon={CalendarDays} label={t("Timestamp")} value={log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"} />
          <ResultItem icon={Server} label={t("Source")} value={log.source || "—"} />
        </div>

        <div className="deliveryModalFooter">
          <button className="ghost" onClick={onClose}>
            {t("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DELIVERY RESULT MODAL
// ============================================================

function DeliveryResultModal({
  result,
  onClose,
  onHistory,
}) {
  const rawStatus =
    String(
      result?.status ||
        result?._status ||
        ""
    ).toUpperCase();

  const success =
    rawStatus === "SUCCESS" ||
    rawStatus === "DRY_RUN" ||
    result?._success === true;

  const dryRun =
    result?.is_dry_run ??
    result?._dryRun ??
    rawStatus === "DRY_RUN";

  const status =
    rawStatus ||
    (success
      ? "SUCCESS"
      : "FAILED");

  const statusLabel =
    status === "DRY_RUN"
      ? t("Dry run completed")
      : success
      ? t("Delivery completed")
      : t("Delivery failed");

  return (
    <div className="modalOverlay">
      <div className="deliveryModal">
        <div className="deliveryResultHeader">
          <div
            className={`resultIcon ${
              success
                ? "success"
                : "failed"
            }`}
          >
            {success ? (
              <CheckCircle2 size={25} />
            ) : (
              <XCircle size={25} />
            )}
          </div>

          <div className="resultHeaderText">
            <div className="eyebrow">
              {t(
                "DELIVERY EXECUTION"
              )}
            </div>

            <h2>
              {statusLabel}
            </h2>

            <span>
              {dryRun
                ? t("Files were validated without creating or sending an archive.")
                : success
                ? t("Archive created and delivery completed.")
                : t("The delivery job failed. Review the error below.")}
            </span>
          </div>

          <button
            className="iconButton"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {result.job_reference && (
          <div className="jobReference">
            <span>
              {t("Job reference")}
            </span>

            <strong>
              {result.job_reference}
            </strong>
          </div>
        )}

        {!success &&
          result.error && (
            <div className="deliveryError">
              <AlertTriangle
                size={17}
              />

              <div>
                <b>
                  {t(
                    "Execution error"
                  )}
                </b>

                <span>
                  {result.error}
                </span>
              </div>
            </div>
          )}

        <div className="resultGrid">
          <ResultItem
            icon={GitBranch}
            label={t("Repository")}
            value={
              result.repository_name ||
              "Repository"
            }
          />

          <ResultItem
            icon={Server}
            label={t("Repository type")}
            value={
              result.repository_type ||
              "LOCAL"
            }
          />

          <ResultItem
            icon={GitCommit}
            label={t("Commit")}
            value={
              result.commit || "—"
            }
            mono
          />

          <ResultItem
            icon={Target}
            label={t("Target")}
            value={
              result.target?.path ||
              t("Configured target")
            }
          />

          <ResultItem
            icon={FileText}
            label={t("Files collected")}
            value={
              result.files_count ??
              0
            }
          />

          <ResultItem
            icon={Timer}
            label={t("Duration")}
            value={
              result.duration_seconds !=
              null
                ? `${Number(
                    result.duration_seconds
                  ).toFixed(
                    3
                  )} sec`
                : "—"
            }
          />

          <ResultItem
            icon={Archive}
            label={t("Archive")}
            value={
              result.archive_name ||
              t("Not created")
            }
          />

          <ResultItem
            icon={Archive}
            label={t("Archive size")}
            value={
              result.archive_size
                ? formatBytes(
                    result.archive_size
                  )
                : dryRun
                ? t("0 bytes")
                : "—"
            }
          />

          <ResultItem
            icon={Mail}
            label={t("Email mode")}
            value={
              result.email_mode ||
              (dryRun
                ? "SIMULATION"
                : t("SMTP"))
            }
          />
        </div>

        {result.recipients?.length >
          0 && (
          <div className="recipientsBlock">
            <div className="recipientTitle">
              <Mail size={15} />

              <b>
                {t("Recipients")}
              </b>
            </div>

            <div className="recipientList">
              {result.recipients.map(
                (
                  recipient,
                  index
                ) => (
                  <span
                    key={`${recipient}-${index}`}
                  >
                    {recipient}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        <div className="deliveryModalFooter">
          <button
            className="ghost"
            onClick={onClose}
          >
            {t("Close")}
          </button>

          <button
            className="primary"
            onClick={onHistory}
          >
            <Eye size={15} />
            {t(
              t("View delivery history")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RESULT ITEM
// ============================================================

function ResultItem({
  icon: Icon,
  label,
  value,
  mono = false,
}) {
  return (
    <div className="resultItem">
      <div className="resultItemIcon">
        <Icon size={15} />
      </div>

      <div>
        <span>
          {label}
        </span>

        <strong
          className={
            mono
              ? "resultMono"
              : ""
          }
        >
          {value}
        </strong>
      </div>
    </div>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function Card({
  icon: Icon,
  label,
  value,
  ok,
  bad,
}) {
  return (
    <div className="stat">
      <div className="statIcon">
        <Icon size={19} />
      </div>

      <span>
        {label}
      </span>

      <strong
        className={
          ok
            ? "green"
            : bad
            ? "red"
            : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}

// ============================================================
// JOB TABLE
// ============================================================

function JobTable({
  jobs,
}) {
  if (!jobs.length) {
    return (
      <div className="empty">
        {t("No delivery jobs yet.")}
        {" "}
        {t("Run a delivery to create the first record.")}
      </div>
    );
  }

  return (
    <div className="table">
      <div className="tr th">
        <span>
          {t("Repository")}
        </span>

        <span>
          {t("Status")}
        </span>

        <span>
          {t("Files")}
        </span>

        <span>
          {t("Archive")}
        </span>

        <span>
          {t("Created")}
        </span>
      </div>

      {jobs.map((job) => (
        <div
          className="tr"
          key={job.id}
        >
          <span>
            <b>
              {job.repository_name ||
                t("Repository")}
            </b>

            <small>
              #
              {job.job_reference ||
                job.id}

              {" · "}

              {job.commit ||
                "—"}
            </small>
          </span>

          <span>
            <Status
              s={job.status}
            />
          </span>

          <span>
            {job.files_count}
          </span>

          <span>
            {job.archive_name ||
              "—"}
          </span>

          <span>
            {job.created_at
              ? new Date(
                  job.created_at
                ).toLocaleString()
              : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// STATUS
// ============================================================

function Status({ s }) {
  const Icon =
    s === "SUCCESS"
      ? CheckCircle2
      : s === "FAILED"
      ? XCircle
      : Clock3;

  const displayStatus =
    String(
      s || "UNKNOWN"
    ).replaceAll(
      "_",
      " "
    );

  return (
    <span
      className={`status ${String(
        s || "unknown"
      ).toLowerCase()}`}
    >
      <Icon size={14} />
      {t(displayStatus)}
    </span>
  );
}

// ============================================================
// FORM INPUT
// ============================================================

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}) {
  return (
    <div className="formField">
      <label>
        {t(label)}
      </label>

      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
            ? t(placeholder)
            : placeholder
        }
        required={required}
      />
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================

function SettingField({
  label,
  value,
}) {
  return (
    <label>
      {t(label)}

      <input
        value={value}
        readOnly
      />
    </label>
  );
}

// ============================================================
// PAGINATION
// ============================================================

function Pagination({
  currentPage = 1,
  totalPages,
  totalItems,
  itemsPerPage = 10,
  onPrevious,
  onNext,
  onPageChange,
}) {
  const calculatedTotalPages =
    totalPages != null
      ? Number(totalPages) || 1
      : Math.ceil(
          (Number(totalItems) || 0) /
            (Number(itemsPerPage) || 10)
        );

  const safeTotalPages =
    Math.max(
      1,
      calculatedTotalPages
    );

  const safeCurrentPage =
    Math.min(
      Math.max(
        Number(currentPage) || 1,
        1
      ),
      safeTotalPages
    );

  if (safeTotalPages <= 1) {
    return null;
  }

  const changePage = (page) => {
    const nextPage =
      Math.min(
        Math.max(
          Number(page) || 1,
          1
        ),
        safeTotalPages
      );

    if (
      nextPage ===
      safeCurrentPage
    ) {
      return;
    }

    if (
      typeof onPageChange ===
      "function"
    ) {
      onPageChange(nextPage);
      return;
    }

    if (
      nextPage ===
        safeCurrentPage - 1 &&
      typeof onPrevious ===
        "function"
    ) {
      onPrevious();
      return;
    }

    if (
      nextPage ===
        safeCurrentPage + 1 &&
      typeof onNext ===
        "function"
    ) {
      onNext();
    }
  };

  return (
    <div className="historyPagination">
      <span>
        {t("Page")}{" "}
        {safeCurrentPage}{" "}
        {t("of")}{" "}
        {safeTotalPages}
      </span>

      <div>
        <button
          type="button"
          className="paginationButton"
          onClick={() =>
            changePage(
              safeCurrentPage - 1
            )
          }
          disabled={
            safeCurrentPage <= 1
          }
        >
          {t("Previous")}
        </button>

        <button
          type="button"
          className="paginationButton"
          onClick={() =>
            changePage(
              safeCurrentPage + 1
            )
          }
          disabled={
            safeCurrentPage >=
            safeTotalPages
          }
        >
          {t("Next")}
        </button>
      </div>
    </div>
  );
}

export {
  AuthBrandPanel,
  AuthFeature,
  AuthCardHeader,
  AuthMessage,
  AuthLoadingScreen,
  AuthScreen,
  ForgotPasswordScreen,
  PasswordResetScreen,
  AuthInput,
  AuditLogTable,
  UserManagementTable,
  UserManagementModal,
  ProfileModal,
  RepositoryModal,
  RepositoryCard,
  AuditLogDetailModal,
  RepositorySummary,
  DeliveryResultModal,
  ResultItem,
  Card,
  JobTable,
  Status,
  FormInput,
  SettingField,
  Pagination,
};
