import React, { useEffect, useMemo, useState } from "react";
import DashboardEnhancement from "./dashboard/DashboardEnhancement";
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
  Globe2,
  CalendarDays,
  KeyRound,
  Info,
  Search,
  IdCard,
  Bell,
} from "lucide-react";
import { useAuth } from "./auth/AuthContext";
import {
  getCurrentLanguage,
  getCurrentLanguageCode,
  setCurrentLanguage,
  translateLegacy,
  translateMessage,
} from "./i18n";
import {
  API,
  createAuthFetch,
  getApiError,
  normalizeArrayResponse,
  getSettings,
  updateSettings,
} from "./services";
import {
  AuthLoadingScreen,
  AuthScreen,
  ForgotPasswordScreen,
  PasswordResetScreen,
  AuditLogTable,
  UserManagementTable,
  UserManagementModal,
  ProfileModal,
  RepositoryModal,
  RepositoryCard,
  RepositorySummary,
  DeliveryResultModal,
  Card,
  JobTable,
  Status,
  SettingField,
  Pagination,
} from "./components";

const t = translateLegacy;

const EMPTY_REPOSITORY = {
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
  extensions: [".log", ".txt"],

  recipients: [],
  email_mode: "SMTP",
  auth_type: "NONE",
  username: "",
  token: "",
  authentication_configured: false,
  active: true,
};

function getPasswordResetRoute() {
  const match = window.location.pathname.match(
    /^\/reset-password\/([^/]+)\/([^/]+)\/?$/
  );

  if (!match) return null;

  return {
    uid: decodeURIComponent(match[1]),
    token: decodeURIComponent(match[2]),
  };
}

function getStoredItemsPerPage() {
  try {
    const saved = localStorage.getItem("ld_settings");
    const parsed = saved ? JSON.parse(saved) : null;
    return Math.max(1, Number(parsed?.itemsPerPage || 10));
  } catch {
    return 10;
  }
}

function App() {
  const [page, setPage] = useState("Dashboard");

  // ==========================================================
  // CENTRAL AUTH CONTEXT
  // ==========================================================

  const {
    user: authUser,
    loading: authLoading,
    logout,
    refreshAccessToken,
    fetchCurrentUser,
    clearAuth,
    accessToken,
  } = useAuth();

  const [authMode, setAuthMode] =
    useState("login");

  // ==========================================================
  // AUTHENTICATED API FETCH
  // ==========================================================

  const authFetch = useMemo(
    () =>
      createAuthFetch({
        getToken: () =>
          localStorage.getItem("access_token") ||
          accessToken,
        refreshAccessToken,
        clearAuth,
      }),
    [
      accessToken,
      refreshAccessToken,
      clearAuth,
    ]
  );

  // ==========================================================
  // AUTHENTICATION HANDLERS
  // ==========================================================

  const handleAuthenticated = (user) => {
    setAuthMode("login");
    setPage("Dashboard");
    setNotice("");
  };

  const handleLogout = async () => {
    setBusy(true);

    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setBusy(false);
      setPage("Dashboard");
      setAuthMode("login");
      setData(null);
      setRepos([]);
      setJobs([]);
      setSelectedRepositoryId("");
      setNotice("");
    }
  };

  // ==========================================================
  // FRONTEND RBAC
  // ==========================================================

  const userRole =
    authUser?.role || "USER";

  const isAdmin =
    userRole === "ADMIN";

  const isManager =
    userRole === "MANAGER";

  const isAuthenticated =
    Boolean(authUser?.id);

  const canManageRepositories =
    isAuthenticated;

  const canRunDelivery =
    isAuthenticated;

  const canManageUsers =
    isAdmin;

  const canDeleteRepository =
    isAdmin;

  const [data, setData] =
    useState(null);

  const [repos, setRepos] =
    useState([]);

  const [jobs, setJobs] =
    useState([]);

  // ==========================================================
  // REPOSITORIES UI STATE
  // ==========================================================

  const [repositorySearch, setRepositorySearch] =
    useState("");

  const [repositoryStatusFilter, setRepositoryStatusFilter] =
    useState("ALL");

  const [repositoryViewMode, setRepositoryViewMode] =
    useState("grid");

  const [repositoryPage, setRepositoryPage] =
    useState(1);

  const repositoriesPerPage = 4;

  // ==========================================================
  // DELIVERY HISTORY PAGINATION
  // ==========================================================

  const [currentPage, setCurrentPage] =
    useState(1);

  const [jobSearch, setJobSearch] =
    useState("");

  const [jobStatusFilter, setJobStatusFilter] =
    useState("ALL");

  const [jobRepositoryFilter, setJobRepositoryFilter] =
    useState("ALL");

  const [jobModeFilter, setJobModeFilter] =
    useState("ALL");

  const [jobDateFrom, setJobDateFrom] =
    useState("");

  const [jobDateTo, setJobDateTo] =
    useState("");

  // ==========================================================
  // SETTINGS STATE
  // ==========================================================
  //
  // Keep these state declarations above any derived values
  // that depend on settingsPreferences or selectedTheme.
  // This prevents a temporal-dead-zone ReferenceError during
  // the initial App render.
  // ==========================================================

  const [settingsPreferences, setSettingsPreferences] =
    useState({
      theme: "System default",
      font: "Inter",
      language: "English",
      defaultRepository: "",
      defaultDeliveryMode: "Live",
      itemsPerPage: getStoredItemsPerPage(),
      confirmBeforeDelivery: true,
      autoRefreshDashboard: true,
      autoRefreshInterval: 5,
      notifications: {
        successfulDeliveries: true,
        failedDeliveries: true,
        dryRunCompletions: true,
        repositoryConnectionFailures: true,
      },
      notificationRecipients: [],
    });

  const [selectedTheme, setSelectedTheme] =
    useState("System default");

  const jobsPerPage = Math.max(
    1,
    Number(
      settingsPreferences?.itemsPerPage ||
        getStoredItemsPerPage()
    )
  );

  const jobRepositoryOptions =
    useMemo(() => {
      const unique = new Set(
        jobs
          .map(
            (job) =>
              job.repository_name ||
              job.repository ||
              ""
          )
          .filter(Boolean)
      );

      return [...unique].sort();
    }, [jobs]);

  const filteredJobs =
    useMemo(() => {
      const searchTerm =
        jobSearch
          .trim()
          .toLowerCase();

      return jobs.filter((job) => {
        const status =
          String(
            job.status || ""
          ).toUpperCase();

        const repositoryName =
          String(
            job.repository_name ||
              job.repository ||
              ""
          );

        const mode =
          status === "DRY_RUN"
            ? "DRY_RUN"
            : "LIVE";

        const createdAt =
          job.created_at
            ? new Date(job.created_at)
            : null;

        if (
          jobStatusFilter !==
            "ALL" &&
          status !== jobStatusFilter
        ) {
          return false;
        }

        if (
          jobRepositoryFilter !==
            "ALL" &&
          repositoryName !==
            jobRepositoryFilter
        ) {
          return false;
        }

        if (
          jobModeFilter !==
            "ALL" &&
          mode !== jobModeFilter
        ) {
          return false;
        }

        if (
          jobDateFrom &&
          createdAt &&
          createdAt <
            new Date(jobDateFrom)
        ) {
          return false;
        }

        if (
          jobDateTo &&
          createdAt &&
          createdAt >
            new Date(jobDateTo)
        ) {
          return false;
        }

        if (!searchTerm) {
          return true;
        }

        const searchable = [
          job.job_reference,
          repositoryName,
          job.commit,
          job.archive_name,
          job.repository,
          job.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(
          searchTerm
        );
      });
    }, [
      jobs,
      jobSearch,
      jobStatusFilter,
      jobRepositoryFilter,
      jobModeFilter,
      jobDateFrom,
      jobDateTo,
    ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    jobSearch,
    jobStatusFilter,
    jobRepositoryFilter,
    jobModeFilter,
    jobDateFrom,
    jobDateTo,
  ]);

  const totalJobPages =
    Math.max(
      1,
      Math.ceil(
        filteredJobs.length /
          jobsPerPage
      )
    );

  useEffect(() => {
    if (
      currentPage >
      totalJobPages
    ) {
      setCurrentPage(
        totalJobPages
      );
    }
  }, [
    currentPage,
    totalJobPages,
  ]);

  const paginatedJobs =
    useMemo(() => {
      const startIndex =
        (currentPage - 1) *
        jobsPerPage;

      return filteredJobs.slice(
        startIndex,
        startIndex +
          jobsPerPage
      );
    }, [
      filteredJobs,
      currentPage,
      jobsPerPage,
    ]);

  // ==========================================================
  // AUDIT LOGS
  // ==========================================================

  const [auditLogs, setAuditLogs] =
    useState([]);

  const [auditLogsLoading, setAuditLogsLoading] =
    useState(false);

  const [auditActionFilter, setAuditActionFilter] =
    useState("");

  const [auditResourceFilter, setAuditResourceFilter] =
    useState("");

  const [auditPage, setAuditPage] =
    useState(1);

  const [selectedAuditLog, setSelectedAuditLog] =
    useState(null);

  const [deletingAuditLogId, setDeletingAuditLogId] =
    useState(null);

  const [selectedDeliveryJob, setSelectedDeliveryJob] =
    useState(null);

  const [deletingJobId, setDeletingJobId] =
    useState(null);

  const [busy, setBusy] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  const [showRepositoryForm, setShowRepositoryForm] =
    useState(false);

  const [editingRepository, setEditingRepository] =
    useState(null);

  const [repositoryForm, setRepositoryForm] =
    useState(EMPTY_REPOSITORY);

  const [selectedRepositoryId, setSelectedRepositoryId] =
    useState("");

  const selectedRepository =
    useMemo(() => {
      return (
        repos.find(
          (repo) =>
            String(repo.id) ===
            String(
              selectedRepositoryId
            )
        ) || null
      );
    }, [
      repos,
      selectedRepositoryId,
    ]);

  // ==========================================================
  // REPOSITORY STATISTICS
  // ==========================================================

  const repositoryStats =
    useMemo(() => {
      const connected =
        repos.filter(
          (repository) =>
            repository?.active !== false &&
            String(
              repository?.connection_status ||
                ""
            ).toUpperCase() ===
            "CONNECTED"
        ).length;

      const needsAttention =
        repos.filter(
          (repository) => {
            if (
              repository?.active ===
              false
            ) {
              return false;
            }

            const status =
              String(
                repository?.connection_status ||
                  ""
              ).toUpperCase();

            return (
              status === "FAILED" ||
              status ===
                "NEEDS_ATTENTION"
            );
          }
        ).length;

      const offline =
        repos.filter(
          (repository) =>
            repository?.active !== false &&
            String(
              repository?.connection_status ||
                ""
            ).toUpperCase() ===
            "OFFLINE"
        ).length;

      return {
        connected,
        needsAttention,
        offline,
        total: repos.length,
      };
    }, [repos]);

  // ==========================================================
  // REPOSITORY SEARCH + STATUS FILTER
  // ==========================================================

  const filteredRepositories =
    useMemo(() => {
      const searchTerm =
        repositorySearch
          .trim()
          .toLowerCase();

      return repos.filter(
        (repository) => {
          const isActive =
            repository?.active !==
            false;

          const status =
            String(
              repository?.connection_status ||
                "UNKNOWN"
            ).toUpperCase();

          let statusMatches =
            true;

          if (
            repositoryStatusFilter ===
            "CONNECTED"
          ) {
            statusMatches =
              isActive &&
              status ===
                "CONNECTED";
          }

          if (
            repositoryStatusFilter ===
            "NEEDS_ATTENTION"
          ) {
            statusMatches =
              isActive &&
              (status === "FAILED" ||
                status ===
                  "NEEDS_ATTENTION");
          }

          if (
            repositoryStatusFilter ===
            "OFFLINE"
          ) {
            statusMatches =
              isActive &&
              status === "OFFLINE";
          }

          if (
            repositoryStatusFilter ===
            "DEACTIVATED"
          ) {
            statusMatches =
              !isActive;
          }

          if (!statusMatches) {
            return false;
          }

          if (!searchTerm) {
            return true;
          }

          const searchableText = [
            repository?.name,
            repository?.description,
            repository?.repository_url,
            repository?.local_path,
            repository?.repository_type,
            repository?.branch,
            repository?.target_path,
            repository?.log_directory,
            isActive
              ? "active"
              : "deactivated",
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            searchTerm
          );
        }
      );
    }, [
      repos,
      repositorySearch,
      repositoryStatusFilter,
    ]);

  // ==========================================================
  // REPOSITORY PAGINATION
  // ==========================================================

  const repositoryTotalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRepositories.length /
          repositoriesPerPage
      )
    );

  const paginatedRepositories =
    useMemo(() => {
      const startIndex =
        (repositoryPage - 1) *
        repositoriesPerPage;

      return filteredRepositories.slice(
        startIndex,
        startIndex +
          repositoriesPerPage
      );
    }, [
      filteredRepositories,
      repositoryPage,
    ]);

  useEffect(() => {
    if (
      repositoryPage >
      repositoryTotalPages
    ) {
      setRepositoryPage(
        repositoryTotalPages
      );
    }
  }, [
    repositoryPage,
    repositoryTotalPages,
  ]);

  useEffect(() => {
    setRepositoryPage(1);
  }, [
    repositorySearch,
    repositoryStatusFilter,
  ]);

  const [deliveryResult, setDeliveryResult] =
    useState(null);

  const [connectionResult, setConnectionResult] =
    useState(null);

  const [branches, setBranches] =
    useState([]);

  const [branchesLoading, setBranchesLoading] =
    useState(false);

  const [branchesError, setBranchesError] =
    useState("");

  // ==========================================================
  // USER MANAGEMENT
  // ==========================================================

  const [managedUsers, setManagedUsers] =
    useState([]);

  const [usersLoading, setUsersLoading] =
    useState(false);

  const [userFormOpen, setUserFormOpen] =
    useState(false);

  const [editingManagedUser, setEditingManagedUser] =
    useState(null);

  const [userForm, setUserForm] =
    useState({
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      password: "",
      password_confirm: "",
      role: "USER",
      is_active: true,
    });

  // ==========================================================
  // MY PROFILE
  // ==========================================================

  const [profileFormOpen, setProfileFormOpen] =
    useState(false);

  const [profileForm, setProfileForm] =
    useState({
      username: "",
      email: "",
      first_name: "",
      last_name: "",
    });

  // ==========================================================
  // LANGUAGE + FONT
  // ==========================================================

  const [selectedLanguage, setSelectedLanguage] =
    useState(() =>
      getCurrentLanguage()
    );

  const [selectedFont, setSelectedFont] =
    useState(() =>
      localStorage.getItem(
        "ld_font"
      ) || "Inter"
    );

  const languageOptions = [
    {
      value: "English",
      label: "English",
      flag: "🇬🇧",
    },
    {
      value: "Telugu",
      label: "తెలుగు",
      flag: "🇮🇳",
    },
    {
      value: "Hindi",
      label: "हिन्दी",
      flag: "🇮🇳",
    },
  ];

  const fontOptions = [
    {
      value: "Inter",
      label: "Inter",
      description:
        "Clean modern UI font",
      family:
        "Inter, system-ui, sans-serif",
    },
    {
      value: "Noto Sans",
      label: "Noto Sans",
      description:
        "Clear multilingual font",
      family:
        '"Noto Sans", system-ui, sans-serif',
    },
    {
      value: "Poppins",
      label: "Poppins",
      description:
        "Modern rounded font",
      family:
        "Poppins, system-ui, sans-serif",
    },
  ];

  const applySelectedFont =
    (fontName) => {
      const selected =
        fontOptions.find(
          (option) =>
            option.value ===
            fontName
        );

      if (!selected) {
        return;
      }

      document.documentElement.style.setProperty(
        "--app-font-family",
        selected.family
      );
    };

  const applySelectedTheme = (themeName) => {
    const root = document.documentElement;
    const theme =
      themeName === "System default"
        ? "light"
        : themeName === "Dark"
          ? "dark"
          : "light";

    root.dataset.theme = theme;
  };

  const defaultSettings = {
    theme: "System default",
    font: "Inter",
    language: "English",
    defaultRepository: "",
    defaultDeliveryMode: "Live",
    itemsPerPage: 10,
    confirmBeforeDelivery: true,
    autoRefreshDashboard: true,
    autoRefreshInterval: 5,
    notifications: {
      successfulDeliveries: true,
      failedDeliveries: true,
      dryRunCompletions: true,
      repositoryConnectionFailures: true,
    },
    notificationRecipients: [],
  };

  const normalizeSettingsFromApi = (
    response
  ) => {
    const settings =
      response?.settings ||
      response ||
      {};

    return {
      theme:
        settings.theme ||
        defaultSettings.theme,

      font:
        settings.font ||
        defaultSettings.font,

      language:
        localStorage.getItem("ld_language")
          ? getCurrentLanguage()
          : settings.language ||
            defaultSettings.language,

      defaultRepository:
        settings.default_repository != null
          ? String(
              settings.default_repository
            )
          : defaultSettings.defaultRepository,

      defaultDeliveryMode:
        settings.default_delivery_mode ||
        defaultSettings.defaultDeliveryMode,

      itemsPerPage:
        Number(
          settings.items_per_page ||
            defaultSettings.itemsPerPage
        ),

      confirmBeforeDelivery:
        settings.confirm_before_delivery ??
        defaultSettings.confirmBeforeDelivery,

      autoRefreshDashboard:
        settings.auto_refresh_dashboard ??
        defaultSettings.autoRefreshDashboard,

      autoRefreshInterval:
        Number(
          settings.auto_refresh_interval ||
            defaultSettings.autoRefreshInterval
        ),

      notifications: {
        successfulDeliveries:
          settings.successful_deliveries ??
          defaultSettings.notifications
            .successfulDeliveries,

        failedDeliveries:
          settings.failed_deliveries ??
          defaultSettings.notifications
            .failedDeliveries,

        dryRunCompletions:
          settings.dry_run_completions ??
          defaultSettings.notifications
            .dryRunCompletions,

        repositoryConnectionFailures:
          settings.repository_connection_failures ??
          defaultSettings.notifications
            .repositoryConnectionFailures,
      },

      notificationRecipients:
        Array.isArray(
          settings.notification_recipients
        )
          ? settings.notification_recipients
          : [],
    };
  };

  const buildSettingsPayload = (
    preferences,
    theme,
    font,
    language,
    recipients
  ) => ({
    theme:
      theme || defaultSettings.theme,

    font:
      font || defaultSettings.font,

    language:
      language || defaultSettings.language,

    default_repository:
      preferences.defaultRepository
        ? Number(
            preferences.defaultRepository
          )
        : null,

    default_delivery_mode:
      preferences.defaultDeliveryMode ||
      defaultSettings.defaultDeliveryMode,

    items_per_page:
      Number(
        preferences.itemsPerPage ||
          defaultSettings.itemsPerPage
      ),

    confirm_before_delivery:
      Boolean(
        preferences.confirmBeforeDelivery
      ),

    auto_refresh_dashboard:
      Boolean(
        preferences.autoRefreshDashboard
      ),

    auto_refresh_interval:
      Number(
        preferences.autoRefreshInterval ||
          defaultSettings.autoRefreshInterval
      ),

    successful_deliveries:
      Boolean(
        preferences.notifications
          .successfulDeliveries
      ),

    failed_deliveries:
      Boolean(
        preferences.notifications
          .failedDeliveries
      ),

    dry_run_completions:
      Boolean(
        preferences.notifications
          .dryRunCompletions
      ),

    repository_connection_failures:
      Boolean(
        preferences.notifications
          .repositoryConnectionFailures
      ),

    notification_recipients:
      recipients,
  });

  const [settingsLoaded, setSettingsLoaded] =
    useState(false);

  const [savedSettingsSnapshot, setSavedSettingsSnapshot] =
    useState(defaultSettings);

  const [notificationRecipientsInput, setNotificationRecipientsInput] =
    useState("");

  const [settingsLoading, setSettingsLoading] =
    useState(false);

  const [settingsSaving, setSettingsSaving] =
    useState(false);

  const applySettingsFromApi = (
    response
  ) => {
    const normalized =
      normalizeSettingsFromApi(
        response
      );

    setSavedSettingsSnapshot(
      normalized
    );

    setSettingsPreferences(
      normalized
    );

    setSelectedTheme(
      normalized.theme
    );
    applySelectedTheme(normalized.theme);

    setSelectedFont(
      normalized.font
    );

    setSelectedLanguage(
      normalized.language
    );

    setNotificationRecipientsInput(
      normalized.notificationRecipients.join(
        ", "
      )
    );

    applySelectedFont(
      normalized.font
    );

    setSelectedRepositoryId(
      normalized.defaultRepository || ""
    );

    return normalized;
  };

  const loadSettings =
    async () => {
      if (!authUser?.id) {
        return null;
      }

      setSettingsLoading(true);

      try {
        const response =
          await getSettings(
            authFetch
          );

        const normalized =
          applySettingsFromApi(
            response
          );

        setSettingsLoaded(
          true
        );

        return normalized;
      } catch (error) {
        setSettingsLoaded(
          false
        );

        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to load your settings.")
        );

        return null;
      } finally {
        setSettingsLoading(
          false
        );
      }
    };

  const handleLanguageChange =
    (language) => {
      const normalizedLanguage =
        setCurrentLanguage(
          language
        );

      setSelectedLanguage(
        normalizedLanguage
      );

      setSettingsPreferences(
        (previous) => ({
          ...previous,
          language:
            normalizedLanguage,
        })
      );

      setNotice(
        `${t(
          "Language"
        )}: ${language} ${t(
          "selected"
        )}.`
      );
    };

  const handleFontChange =
    (font) => {
      setSelectedFont(font);

      setSettingsPreferences(
        (previous) => ({
          ...previous,
          font,
        })
      );

      applySelectedFont(
        font
      );

      setNotice(
        `${t("Font selected")}: ${font}.`
      );
    };

  const applyThemeSelection =
    (themeName) => {
      setSelectedTheme(
        themeName
      );

      setSettingsPreferences(
        (previous) => ({
          ...previous,
          theme: themeName,
        })
      );

      setNotice(
        `${t("Theme updated")}: ${t(themeName)}.`
      );
    };

  const updatePreference = (
    key,
    value
  ) => {
    setSettingsPreferences(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );
  };

  const updateNotificationPreference = (
    key,
    value
  ) => {
    setSettingsPreferences(
      (previous) => ({
        ...previous,
        notifications: {
          ...previous.notifications,
          [key]: value,
        },
      })
    );
  };

  const parseNotificationRecipients =
    (value) =>
      String(value || "")
        .split(",")
        .map((email) =>
          email.trim()
        )
        .filter(Boolean);

  const saveSettings =
    async () => {
      if (!authUser?.id) {
        setNotice(
          t("Unable to identify the authenticated user.")
        );
        return;
      }

      setSettingsSaving(
        true
      );
      setNotice("");

      try {
        const recipients =
          parseNotificationRecipients(
            notificationRecipientsInput
          );

        const payload =
          buildSettingsPayload(
            settingsPreferences,
            selectedTheme,
            selectedFont,
            selectedLanguage,
            recipients
          );

        const response =
          await updateSettings(
            authFetch,
            payload
          );

        const normalized =
          applySettingsFromApi(
            response
          );

        setCurrentLanguage(
          normalized.language
        );

        applySelectedFont(
          normalized.font
        );

        setCurrentPage(1);

        setNotice(
          t("Settings updated successfully.")
        );
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to save settings.")
        );
      } finally {
        setSettingsSaving(
          false
        );
      }
    };

  const discardSettings =
    () => {
      const restored =
        savedSettingsSnapshot;

      setSettingsPreferences(
        restored
      );

      setSelectedTheme(
        restored.theme
      );

      setSelectedFont(
        restored.font
      );

      setSelectedLanguage(
        restored.language
      );

      setNotificationRecipientsInput(
        restored.notificationRecipients.join(
          ", "
        )
      );

      setCurrentLanguage(
        restored.language
      );

      applySelectedFont(
        restored.font
      );

      setSelectedRepositoryId(
        restored.defaultRepository || ""
      );

      setNotice(
        t("Changes discarded.")
      );
    };

  const resetSettings =
    async () => {
      if (!authUser?.id) {
        setNotice(
          t("Unable to identify the authenticated user.")
        );
        return;
      }

      setSettingsSaving(
        true
      );
      setNotice("");

      try {
        const response =
          await updateSettings(
            authFetch,
            buildSettingsPayload(
              defaultSettings,
              defaultSettings.theme,
              defaultSettings.font,
              defaultSettings.language,
              defaultSettings.notificationRecipients
            )
          );

        const normalized =
          applySettingsFromApi(
            response
          );

        setCurrentLanguage(
          normalized.language
        );

        applySelectedFont(
          normalized.font
        );

        setCurrentPage(1);

        setNotice(
          t("Settings reset to defaults.")
        );
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to reset settings.")
        );
      } finally {
        setSettingsSaving(
          false
        );
      }
    };

  useEffect(() => {
    const syncLanguagePreference =
      (event) => {
        if (
          event.key ===
            "ld_language" &&
          event.newValue
        ) {
          setSelectedLanguage(
            getCurrentLanguage()
          );
        }
      };

    window.addEventListener(
      "storage",
      syncLanguagePreference
    );

    return () => {
      window.removeEventListener(
        "storage",
        syncLanguagePreference
      );
    };
  }, []);

  useEffect(() => {
    applySelectedFont(
      selectedFont
    );
  }, [selectedFont]);

  useEffect(() => {
    applySelectedTheme(selectedTheme);
  }, [selectedTheme]);

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const load = async () => {
    const [
      dashboardResponse,
      repositoriesResponse,
      jobsResponse,
    ] = await Promise.all([
      authFetch(
        `${API}/dashboard/`
      ),
      authFetch(
        `${API}/repositories/`
      ),
      authFetch(
        `${API}/jobs/`
      ),
    ]);

    if (!dashboardResponse.ok) {
      throw new Error(
        t("Failed to load dashboard data.")
      );
    }

    if (!repositoriesResponse.ok) {
      throw new Error(
        t("Failed to load repositories.")
      );
    }

    if (!jobsResponse.ok) {
      throw new Error(
        t("Failed to load delivery jobs.")
      );
    }

    const dashboard =
      await dashboardResponse.json();

    const repositories =
      await repositoriesResponse.json();

    const deliveryJobs =
      await jobsResponse.json();

    const repositoryList =
      normalizeArrayResponse(repositories);
    const jobList =
      normalizeArrayResponse(deliveryJobs);

    setData(dashboard);

    // ----------------------------------------------------------
    // IMPORTANT:
    //
    // The repository endpoint may return only active repositories.
    // Keep any repositories that were already locally known as
    // deactivated so they remain visible in the UI.
    // ----------------------------------------------------------

    setRepos(
      (previous) => {
        const serverRepositories =
          repositoryList;

        const serverIds =
          new Set(
            serverRepositories.map(
              (repo) =>
                String(
                  repo.id
                )
            )
          );

        const preservedDeactivated =
          previous.filter(
            (repo) =>
              repo?.active ===
                false &&
              !serverIds.has(
                String(
                  repo.id
                )
              )
          );

        return [
          ...serverRepositories,
          ...preservedDeactivated,
        ];
      }
    );

    setJobs(
      jobList
    );

    setCurrentPage(1);

    if (
      repositoryList.length > 0 &&
      !repositoryList.some(
        (repo) =>
          String(repo.id) ===
          String(
            selectedRepositoryId
          )
      )
    ) {
      setSelectedRepositoryId(
        String(
          (
            repositoryList.find(
              (repo) =>
                String(repo.id) ===
                String(
                  settingsPreferences.defaultRepository
                )
            ) || repositoryList[0]
          ).id
        )
      );
    }
  };

  useEffect(() => {
    if (!authUser) {
      return;
    }

    if (
      page ===
        "User Management" &&
      !isAdmin
    ) {
      setPage("Dashboard");
      return;
    }

    if (
      page === "Audit Logs" &&
      !isAdmin &&
      !isManager
    ) {
      setPage("Dashboard");
      return;
    }

    Promise.all([
      load(),
      loadSettings(),
    ]).catch((error) => {
      setNotice(
        translateMessage(
          error.message
        ) ||
          t("Backend is not running. Start Django on port 8000.")
      );
    });
  }, [authUser]);

  useEffect(() => {
    if (
      !authUser ||
      page !== "Dashboard" ||
      !settingsPreferences.autoRefreshDashboard
    ) {
      return undefined;
    }

    const intervalMatch =
      String(
        settingsPreferences.autoRefreshInterval
      ).match(/\d+/);
    const minutes = Number(
      intervalMatch?.[0] || 5
    );
    const intervalId = window.setInterval(
      () => {
        load().catch((error) => {
          setNotice(
            translateMessage(error.message) ||
              t("Unable to refresh dashboard data.")
          );
        });
      },
      Math.max(1, minutes) * 60 * 1000
    );

    return () => window.clearInterval(intervalId);
  }, [
    authUser,
    page,
    settingsPreferences.autoRefreshDashboard,
    settingsPreferences.autoRefreshInterval,
  ]);

  // ==========================================================
  // AUDIT LOGS
  // ==========================================================

  const loadAuditLogs =
    async () => {
      if (!isAdmin && !isManager) {
        setAuditLogs([]);
        return;
      }

      setAuditLogsLoading(true);

      try {
        const params =
          new URLSearchParams();

        if (auditActionFilter) {
          params.set(
            "action",
            auditActionFilter
          );
        }

        if (auditResourceFilter) {
          params.set(
            "resource",
            auditResourceFilter
          );
        }

        params.set(
          "limit",
          "100"
        );

        const queryString =
          params.toString();

        const response =
          await authFetch(
            `${API}/auth/audit-logs/${
              queryString
                ? `?${queryString}`
                : ""
            }`
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getApiError(result)
          );
        }

        setAuditLogs(
          Array.isArray(result)
            ? result
            : Array.isArray(
                result.logs
              )
            ? result.logs
            : Array.isArray(
                result.results
              )
            ? result.results
            : []
        );
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to load audit logs.")
        );
      } finally {
        setAuditLogsLoading(false);
      }
    };

  useEffect(() => {
    if (
      authUser &&
      (isAdmin || isManager) &&
      page === "Audit Logs"
    ) {
      loadAuditLogs();
    }
  }, [
    authUser,
    isAdmin,
    isManager,
    page,
    auditActionFilter,
    auditResourceFilter,
  ]);

  const auditActionOptions =
    useMemo(() => {
      const unique = new Set(
        auditLogs
          .map((log) =>
            String(
              log.action || ""
            ).trim()
          )
          .filter(Boolean)
      );

      return [...unique].sort();
    }, [auditLogs]);

  const auditResourceOptions =
    useMemo(() => {
      const unique = new Set(
        auditLogs
          .map((log) =>
            String(
              log.resource || ""
            ).trim()
          )
          .filter(Boolean)
      );

      return [...unique].sort();
    }, [auditLogs]);

  const auditSummary =
    useMemo(() => {
      const total =
        auditLogs.length;

      let success = 0;
      let warning = 0;
      let failed = 0;

      for (const log of auditLogs) {
        const action =
          String(
            log.action || ""
          ).toUpperCase();

        if (
          action.includes(
            "SUCCESS"
          ) ||
          action.includes(
            "LOGIN"
          ) ||
          action.includes(
            "LOGOUT"
          ) ||
          action.includes(
            "RESET"
          ) ||
          action.includes(
            "COMPLETED"
          )
        ) {
          success += 1;
        } else if (
          action.includes(
            "FAIL"
          ) ||
          action.includes(
            "ERROR"
          ) ||
          action.includes(
            "DENY"
          ) ||
          action.includes(
            "REJECT"
          )
        ) {
          failed += 1;
        } else if (
          action.includes(
            "START"
          ) ||
          action.includes(
            "RUN"
          ) ||
          action.includes(
            "WARN"
          ) ||
          action.includes(
            "UPDATE"
          )
        ) {
          warning += 1;
        } else if (
          action.includes(
            "DELETE"
          ) ||
          action.includes(
            "CREATE"
          )
        ) {
          success += 1;
        }
      }

      return {
        total,
        success,
        warning,
        failed,
      };
    }, [auditLogs]);

  const auditPageSize = 10;

  const auditTotalPages =
    Math.max(
      1,
      Math.ceil(
        auditLogs.length /
          auditPageSize
      )
    );

  useEffect(() => {
    setAuditPage(
      (previous) =>
        Math.min(
          previous,
          auditTotalPages
        )
    );
  }, [auditTotalPages]);

  const paginatedAuditLogs =
    useMemo(() => {
      const safePage =
        Math.min(
          Math.max(
            auditPage,
            1
          ),
          auditTotalPages
        );

      const startIndex =
        (safePage - 1) *
        auditPageSize;

      return auditLogs.slice(
        startIndex,
        startIndex +
          auditPageSize
      );
    }, [
      auditLogs,
      auditPage,
      auditTotalPages,
    ]);

  const deleteAuditLog =
    async (log) => {
      if (!isAdmin) {
        setNotice(
          t("Administrator access is required to delete audit logs.")
        );
        return;
      }

      if (!log?.id) {
        setNotice(
          t("Unable to identify the audit log.")
        );
        return;
      }

      const confirmed =
        window.confirm(
          `${t(
            "Delete audit log"
          )} #${log.id}? ${t(
            t("This action cannot be undone.")
          )}`
        );

      if (!confirmed) {
        return;
      }

      setDeletingAuditLogId(
        log.id
      );

      setNotice("");

      try {
        const response =
          await authFetch(
            `${API}/auth/audit-logs/?id=${encodeURIComponent(
              log.id
            )}`,
            {
              method: "DELETE",
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getApiError(result)
          );
        }

        setAuditLogs(
          (previous) =>
            previous.filter(
              (item) =>
                String(
                  item.id
                ) !==
                String(log.id)
            )
        );

        setNotice(
          result.message ||
            `${t("Audit log")} #${log.id} ${t("deleted successfully.")}`
        );
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to delete audit log.")
        );
      } finally {
        setDeletingAuditLogId(
          null
        );
      }
    };

  const deleteJob =
    async (job) => {
      if (!isAdmin && !isManager) {
        setNotice(
          t("Administrator or Manager access is required to delete delivery jobs.")
        );
        return;
      }

      if (!job?.id) {
        setNotice(
          "Unable to identify the delivery job."
        );
        return;
      }

      const confirmed =
        window.confirm(
          `${t("Delete delivery job")} #${job.id}? ${t("This action cannot be undone.")}`
        );

      if (!confirmed) {
        return;
      }

      setDeletingJobId(job.id);
      setNotice("");

      try {
        const response =
          await authFetch(
            `${API}/jobs/${encodeURIComponent(
              job.id
            )}/`,
            {
              method: "DELETE",
            }
          );

        const result =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            getApiError(result)
          );
        }

        setJobs(
          (previous) =>
            previous.filter(
              (item) =>
                String(
                  item.id
                ) !==
                String(job.id)
            )
        );

        setSelectedDeliveryJob(
          null
        );

        setNotice(
          result.message ||
            `${t("Delivery job")} #${job.id} ${t("deleted successfully.")}`
        );
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to delete delivery job.")
        );
      } finally {
        setDeletingJobId(
          null
        );
      }
    };

  // ==========================================================
  // USER MANAGEMENT
  // ==========================================================

  const resetUserForm =
    () => {
      setUserForm({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        password: "",
        password_confirm: "",
        role: "USER",
        is_active: true,
      });
    };

  const loadManagedUsers =
    async () => {
      if (!canManageUsers) {
        return;
      }

      setUsersLoading(true);

      try {
        const response =
          await authFetch(
            `${API}/auth/users/`
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getApiError(result)
          );
        }

        setManagedUsers(
          Array.isArray(result)
            ? result
            : []
        );
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            "Unable to load users."
        );
      } finally {
        setUsersLoading(false);
      }
    };

  useEffect(() => {
    if (
      authUser &&
      isAdmin &&
      page === "User Management"
    ) {
      loadManagedUsers();
    }
  }, [
    authUser,
    canManageUsers,
    page,
  ]);

  const openCreateUser =
    () => {
      if (!canManageUsers) {
        setNotice(
          t("Administrator access is required.")
        );
        return;
      }

      setEditingManagedUser(
        null
      );

      resetUserForm();

      setUserFormOpen(true);
      setNotice("");
    };

  const openEditUser =
    (user) => {
      if (!canManageUsers) {
        setNotice(
          t("Administrator access is required.")
        );
        return;
      }

      setEditingManagedUser(
        user
      );

      setUserForm({
        id: user.id,
        username:
          user.username || "",
        email:
          user.email || "",
        first_name:
          user.first_name || "",
        last_name:
          user.last_name || "",
        password: "",
        password_confirm: "",
        role:
          user.role || "USER",
        is_active:
          user.is_active ??
          true,
      });

      setUserFormOpen(true);
      setNotice("");
    };

  const closeUserForm =
    () => {
      if (busy) {
        return;
      }

      setUserFormOpen(false);
      setEditingManagedUser(
        null
      );

      resetUserForm();
    };

  const updateUserField =
    (field, value) => {
      setUserForm(
        (previous) => ({
          ...previous,
          [field]: value,
        })
      );
    };

  const saveManagedUser =
    async (event) => {
      event.preventDefault();

      if (!canManageUsers) {
        setNotice(
          t("Administrator access is required.")
        );
        return;
      }

      setBusy(true);
      setNotice("");

      try {
        if (editingManagedUser) {
          const payload = {
            username:
              userForm.username.trim(),
            email:
              userForm.email.trim(),
            first_name:
              userForm.first_name.trim(),
            last_name:
              userForm.last_name.trim(),
            role: userForm.role,
            is_active:
              userForm.is_active,
          };

          const response =
            await authFetch(
              `${API}/auth/users/${editingManagedUser.id}/`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify(
                    payload
                  ),
              }
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              getApiError(result)
            );
          }

          setNotice(
            t("User updated successfully.")
          );
        } else {
          if (
            userForm.password !==
            userForm.password_confirm
          ) {
            throw new Error(
              t("Passwords do not match.")
            );
          }

          const payload = {
            username:
              userForm.username.trim(),
            email:
              userForm.email.trim(),
            first_name:
              userForm.first_name.trim(),
            last_name:
              userForm.last_name.trim(),
            password:
              userForm.password,
            password_confirm:
              userForm.password_confirm,
            role: userForm.role,
          };

          const response =
            await authFetch(
              `${API}/auth/users/`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify(
                    payload
                  ),
              }
            );

          const result =
            await response.json();

          if (!response.ok) {
            if (
              result.code ===
              "USERNAME_EXISTS"
            ) {
              throw new Error(
                t("Username already exists. Please choose a different username.")
              );
            }

            if (
              result.code ===
              "EMAIL_EXISTS"
            ) {
              throw new Error(
                t("Email already exists. Please use a different email address.")
              );
            }

            throw new Error(
              getApiError(result)
            );
          }

          setNotice(
            t("User created successfully.")
          );
        }

        setUserFormOpen(false);
        setEditingManagedUser(
          null
        );

        resetUserForm();

        await loadManagedUsers();
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to save user.")
        );
      } finally {
        setBusy(false);
      }
    };

  const toggleManagedUser =
    async (user) => {
      if (!canManageUsers) {
        setNotice(
          t("Administrator access is required.")
        );
        return;
      }

      if (
        String(user.id) ===
        String(authUser?.id)
      ) {
        setNotice(
          t("You cannot deactivate your own account.")
        );
        return;
      }

      const nextActive =
        !user.is_active;

      const confirmed =
        window.confirm(
          `${nextActive ? t("Activate") : t("Deactivate")} "${user.username}"?`
        );

      if (!confirmed) {
        return;
      }

      setBusy(true);
      setNotice("");

      try {
        const response =
          await authFetch(
            `${API}/auth/users/${user.id}/`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  is_active:
                    nextActive,
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

        setNotice(
          nextActive
            ? t("User activated successfully.")
            : t("User deactivated successfully.")
        );

        await loadManagedUsers();
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to update user status.")
        );
      } finally {
        setBusy(false);
      }
    };

  // ==========================================================
  // MY PROFILE
  // ==========================================================

  const openProfileEdit =
    () => {
      if (!authUser) {
        return;
      }

      setProfileForm({
        username:
          authUser.username ||
          "",
        email:
          authUser.email || "",
        first_name:
          authUser.first_name ||
          "",
        last_name:
          authUser.last_name ||
          "",
      });

      setProfileFormOpen(true);
      setNotice("");
    };

  const closeProfileEdit =
    () => {
      if (busy) {
        return;
      }

      setProfileFormOpen(false);
    };

  const updateProfileField =
    (field, value) => {
      setProfileForm(
        (previous) => ({
          ...previous,
          [field]: value,
        })
      );
    };

  const saveMyProfile =
    async (event) => {
      event.preventDefault();

      if (!authUser?.id) {
        setNotice(
          t("Unable to identify the authenticated user.")
        );
        return;
      }

      setBusy(true);
      setNotice("");

      try {
        const payload = {
          email:
            profileForm.email.trim(),
          first_name:
            profileForm.first_name.trim(),
          last_name:
            profileForm.last_name.trim(),
        };

        const response =
          await authFetch(
            `${API}/auth/me/`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getApiError(result)
          );
        }

        const updatedUser =
          result?.user ||
          result;

        if (!updatedUser) {
          throw new Error(
            t("Profile was updated, but the updated user could not be loaded.")
          );
        }

        await fetchCurrentUser(
          localStorage.getItem(
            "access_token"
          )
        );

        setProfileFormOpen(
          false
        );

        setNotice(
          t("Profile updated successfully.")
        );
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to update your profile.")
        );
      } finally {
        setBusy(false);
      }
    };

  // ==========================================================
  // REPOSITORY FORM
  // ==========================================================

  const openAddRepository =
    () => {
      if (!canManageRepositories) {
        setNotice(
          t("You must be signed in to manage repositories.")
        );
        return;
      }

      setEditingRepository(
        null
      );

      setRepositoryForm({
        ...EMPTY_REPOSITORY,

        targets: [
          {
            path: "",
            extensions: [],
          },
        ],

        extensions: [
          ".log",
          ".txt",
        ],

        recipients: [""],
      });

      setConnectionResult(
        null
      );

      setBranches([]);
      setBranchesError("");

      setShowRepositoryForm(
        true
      );

      setNotice("");
    };

  const openEditRepository =
    (repository) => {
      if (!canManageRepositories) {
        setNotice(
          t("You must be signed in to manage repositories.")
        );
        return;
      }

      setEditingRepository(
        repository
      );

      setRepositoryForm({
        name:
          repository.name || "",

        description:
          repository.description ||
          "",

        repository_type:
          repository.repository_type ||
          "GITHUB",

        repository_url:
          repository.repository_url ||
          "",

        local_path:
          repository.local_path ||
          "",

        branch:
          repository.branch ||
          "main",

        targets:
          Array.isArray(
            repository.targets
          ) &&
          repository.targets.length >
            0
            ? repository.targets.map(
                (target) => ({
                  path:
                    target?.path ||
                    "",
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
                    repository.extensions ||
                    [],
                },
              ],

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
            : [".log", ".txt"],

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

        token: "",

        authentication_configured:
          repository.authentication_configured ??
          false,

        active:
          repository.active ??
          true,
      });

      setConnectionResult(
        null
      );

      setBranches([]);
      setBranchesError("");

      setShowRepositoryForm(
        true
      );

      setNotice("");

      // Do not fetch branches for a deactivated repository.
      if (
        repository.active ===
        false
      ) {
        return;
      }

      if (
        repository.repository_type !==
        "LOCAL"
      ) {
        authFetch(
          `${API}/repositories/${repository.id}/branches/`
        )
          .then(
            async (
              response
            ) => {
              const result =
                await response.json();

              if (!response.ok) {
                throw new Error(
                  getApiError(
                    result
                  ) ||
                    result.message ||
                    t("Unable to fetch repository branches.")
                );
              }

              return result;
            }
          )
          .then(
            (result) => {
              const fetchedBranches =
                Array.isArray(
                  result.branches
                )
                  ? result.branches
                  : [];

              setBranches(
                fetchedBranches
              );

              if (
                fetchedBranches.length >
                0
              ) {
                const currentBranch =
                  result.current_branch ||
                  repository.branch ||
                  fetchedBranches[0];

                const selectedBranch =
                  fetchedBranches.includes(
                    currentBranch
                  )
                    ? currentBranch
                    : fetchedBranches[0];

                setRepositoryForm(
                  (previous) => ({
                    ...previous,
                    branch:
                      selectedBranch,
                  })
                );
              }
            }
          )
          .catch(
            (error) => {
              setBranches([]);
              setBranchesError(
                translateMessage(
                  error.message
                ) ||
                  t(
                    t("Unable to fetch repository branches.")
                  )
              );
            }
          );
      }
    };

  const closeRepositoryForm =
    () => {
      if (busy) {
        return;
      }

      setShowRepositoryForm(
        false
      );

      setEditingRepository(
        null
      );

      setConnectionResult(
        null
      );

      setBranches([]);
      setBranchesError("");

      setRepositoryForm({
        ...EMPTY_REPOSITORY,
        targets: [
          {
            path: "",
            extensions: [],
          },
        ],
        recipients: [],
      });
    };

  const updateRepositoryField =
    (field, value) => {
      setRepositoryForm(
        (previous) => ({
          ...previous,
          [field]: value,
        })
      );
    };

  // ==========================================================
  // MULTIPLE TARGETS
  // ==========================================================

  const addTarget = () => {
    setRepositoryForm(
      (previous) => ({
        ...previous,
        targets: [
          ...(Array.isArray(
            previous.targets
          )
            ? previous.targets
            : []),
          {
            path: "",
            extensions: [],
          },
        ],
      })
    );
  };

  const removeTarget =
    (index) => {
      setRepositoryForm(
        (previous) => {
          const targets =
            Array.isArray(
              previous.targets
            )
              ? [
                  ...previous.targets,
                ]
              : [];

          if (
            targets.length <=
            1
          ) {
            return {
              ...previous,
              targets: [
                {
                  path: "",
                  extensions: [],
                },
              ],
            };
          }

          targets.splice(
            index,
            1
          );

          return {
            ...previous,
            targets,
          };
        }
      );
    };

  const updateTarget =
    (
      index,
      field,
      value
    ) => {
      setRepositoryForm(
        (previous) => {
          const targets =
            Array.isArray(
              previous.targets
            )
              ? [
                  ...previous.targets,
                ]
              : [];

          const current =
            targets[index] || {
              path: "",
              extensions: [],
            };

          targets[index] = {
            ...current,
            [field]: value,
          };

          return {
            ...previous,
            targets,
          };
        }
      );
    };

  // ==========================================================
  // MULTIPLE RECIPIENTS
  // ==========================================================

  const addRecipient = () => {
    setRepositoryForm(
      (previous) => ({
        ...previous,
        recipients: [
          ...(Array.isArray(
            previous.recipients
          )
            ? previous.recipients
            : []),
          "",
        ],
      })
    );
  };

  const removeRecipient =
    (index) => {
      setRepositoryForm(
        (previous) => {
          const recipients =
            Array.isArray(
              previous.recipients
            )
              ? [
                  ...previous.recipients,
                ]
              : [];

          recipients.splice(
            index,
            1
          );

          return {
            ...previous,
            recipients,
          };
        }
      );
    };

  const updateRecipient =
    (
      index,
      value
    ) => {
      setRepositoryForm(
        (previous) => {
          const recipients =
            Array.isArray(
              previous.recipients
            )
              ? [
                  ...previous.recipients,
                ]
              : [];

          recipients[index] =
            value;

          return {
            ...previous,
            recipients,
          };
        }
      );
    };

  // ==========================================================
  // SAVE REPOSITORY
  // ==========================================================

  const saveRepository =
    async (event) => {
      event.preventDefault();

      if (!canManageRepositories) {
        setNotice(
          t("You must be signed in to manage repositories.")
        );
        return;
      }

      setBusy(true);
      setNotice("");
      setConnectionResult(
        null
      );

      try {
        const rawExtensions =
          Array.isArray(
            repositoryForm.extensions
          )
            ? repositoryForm.extensions
            : String(
                repositoryForm.extensions ||
                  ""
              )
                .split(",")
                .map(
                  (item) =>
                    item.trim()
                )
                .filter(Boolean);

        const targets =
          (
            Array.isArray(
              repositoryForm.targets
            )
              ? repositoryForm.targets
              : []
          )
            .map((target) => ({
              path: String(
                target?.path ||
                  ""
              )
                .trim()
                .replaceAll(
                  "\\",
                  "/"
                ),

              extensions:
                Array.isArray(
                  target?.extensions
                )
                  ? target.extensions
                      .map(
                        (extension) =>
                          String(
                            extension
                          )
                            .trim()
                            .toLowerCase()
                      )
                      .filter(Boolean)
                  : [],
            }))
            .filter(
              (target) =>
                target.path
            );

        if (
          targets.length ===
          0
        ) {
          throw new Error(
            "Add at least one target file or folder."
          );
        }

        const recipients =
          (
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

        if (
          recipients.length ===
          0
        ) {
          throw new Error(
            "Add at least one recipient email address."
          );
        }

        const repositoryType =
          String(
            repositoryForm.repository_type ||
              "GITHUB"
          )
            .trim()
            .toUpperCase();

        const name =
          String(
            repositoryForm.name ||
              ""
          ).trim();

        if (!name) {
          throw new Error(
            t("Repository name cannot be empty.")
          );
        }

        const branch =
          String(
            repositoryForm.branch ||
              "main"
          ).trim();

        if (!branch) {
          throw new Error(
            t("Branch name cannot be empty.")
          );
        }

        const isLocal =
          repositoryType ===
          "LOCAL";

        const repositoryUrl =
          String(
            repositoryForm.repository_url ||
              ""
          ).trim();

        const localPath =
          String(
            repositoryForm.local_path ||
              ""
          ).trim();

        if (
          isLocal &&
          !localPath
        ) {
          throw new Error(
            t("Local path is required for a local repository.")
          );
        }

        if (
          !isLocal &&
          !repositoryUrl
        ) {
          throw new Error(
            t("Repository URL is required for this repository type.")
          );
        }

        const firstTarget =
          targets[0];

        const legacyExtensions =
          firstTarget
            ?.extensions?.length
            ? firstTarget.extensions
            : rawExtensions.length
            ? rawExtensions
            : [".log", ".txt"];

        const payload = {
          name,

          description:
            String(
              repositoryForm.description ||
                ""
            ).trim(),

          repository_type:
            repositoryType,

          repository_url:
            isLocal
              ? ""
              : repositoryUrl,

          local_path:
            isLocal
              ? localPath
              : "",

          branch,

          target_path:
            firstTarget?.path ||
            "",

          log_directory:
            String(
              repositoryForm.log_directory ||
                "logs"
            ).trim() ||
            "logs",

          extensions:
            legacyExtensions,

          targets,

          recipients,

          email_mode:
            repositoryForm.email_mode ||
            "SMTP",
        };

        // ------------------------------------------------------
        // REPOSITORY AUTHENTICATION
        // ------------------------------------------------------

        if (isLocal) {
          payload.auth_type =
            "NONE";

          payload.username =
            "";
        } else if (
          String(
            repositoryForm.auth_type ||
              "NONE"
          ).toUpperCase() ===
          "PAT"
        ) {
          const username =
            String(
              repositoryForm.username ||
                ""
            ).trim();

          const token =
            String(
              repositoryForm.token ||
                ""
            ).trim();

          if (!username) {
            throw new Error(
              t("Git username is required for private repository authentication.")
            );
          }

          if (
            !editingRepository &&
            !token
          ) {
            throw new Error(
              t("Personal Access Token is required for a private repository.")
            );
          }

          payload.auth_type =
            "PAT";

          payload.username =
            username;

          if (token) {
            payload.access_token =
              token;
          }
        } else {
          payload.auth_type =
            "NONE";

          payload.username =
            "";
        }

        const url =
          editingRepository
            ? `${API}/repositories/${editingRepository.id}/`
            : `${API}/repositories/`;

        const method =
          editingRepository
            ? "PATCH"
            : "POST";

        const response =
          await authFetch(
            url,
            {
              method,
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const result =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            getApiError(result) ||
              result.message ||
              t("Unable to save repository.")
          );
        }

        const savedRepository =
          result?.id
            ? result
            : null;

        setShowRepositoryForm(
          false
        );

        setEditingRepository(
          null
        );

        setConnectionResult(
          null
        );

        setBranches([]);
        setBranchesError("");

        setRepositoryForm({
          ...EMPTY_REPOSITORY,
          targets: [
            {
              path: "",
              extensions: [],
            },
          ],
          recipients: [],
        });

        if (
          savedRepository
        ) {
          setRepos(
            (previous) => {
              const exists =
                previous.some(
                  (repository) =>
                    String(
                      repository.id
                    ) ===
                    String(
                      savedRepository.id
                    )
                );

              if (exists) {
                return previous.map(
                  (repository) =>
                    String(
                      repository.id
                    ) ===
                    String(
                      savedRepository.id
                    )
                      ? {
                          ...repository,
                          ...savedRepository,
                        }
                      : repository
                );
              }

              return [
                ...previous,
                savedRepository,
              ];
            }
          );

          setSelectedRepositoryId(
            String(
              savedRepository.id
            )
          );
        }

        setNotice(
          editingRepository
            ? t("Repository updated successfully.")
            : t("Repository added successfully.")
        );

        try {
          await load();
        } catch (refreshError) {
          console.warn(
            "Repository saved, but dashboard refresh failed:",
            refreshError
          );
        }
      } catch (error) {
        console.error(
          "Repository save error:",
          error
        );

        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to save repository.")
        );
      } finally {
        setBusy(false);
      }
    };

  // ==========================================================
  // FETCH REPOSITORY BRANCHES
  // ==========================================================

  const fetchRepositoryBranches =
    async (repository) => {
      if (!repository?.id) {
        return;
      }

      // Deactivated repositories cannot fetch branches.
      if (
        repository.active ===
        false
      ) {
        setBranches([]);
        setBranchesError(
          t("This repository is deactivated. Activate it before fetching branches.")
        );
        return;
      }

      if (
        repository.repository_type ===
        "LOCAL"
      ) {
        setBranches([]);
        setBranchesError("");
        return;
      }

      setBranchesLoading(true);
      setBranchesError("");

      try {
        const response =
          await authFetch(
            `${API}/repositories/${repository.id}/branches/`
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getApiError(result) ||
              result.message ||
              t("Unable to fetch repository branches.")
          );
        }

        const fetchedBranches =
          Array.isArray(
            result.branches
          )
            ? result.branches
            : [];

        setBranches(
          fetchedBranches
        );

        if (
          fetchedBranches.length >
          0
        ) {
          const currentBranch =
            result.current_branch ||
            repository.branch ||
            fetchedBranches[0];

          const selectedBranch =
            fetchedBranches.includes(
              currentBranch
            )
              ? currentBranch
              : fetchedBranches[0];

          updateRepositoryField(
            "branch",
            selectedBranch
          );
        }
      } catch (error) {
        setBranches([]);
        setBranchesError(
          translateMessage(
            error.message
          ) ||
            t(
              t("Unable to fetch repository branches.")
            )
        );
      } finally {
        setBranchesLoading(
          false
        );
      }
    };

  // ==========================================================
  // TEST CONNECTION
  // ==========================================================

  const testConnection =
    async (repository) => {
      if (!repository?.id) {
        return;
      }

      if (
        repository.active ===
        false
      ) {
        setConnectionResult({
          success: false,
          message:
            t("This repository is deactivated. Activate it before testing the connection."),
        });

        setNotice(
          t("Deactivated repositories cannot be tested.")
        );

        return;
      }

      setBusy(true);
      setNotice("");
      setConnectionResult(
        null
      );

      try {
        const response =
          await authFetch(
            `${API}/repositories/${repository.id}/test/`,
            {
              method: "POST",
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              result.message ||
              t("Repository connection failed.")
          );
        }

        setConnectionResult({
          success: true,
          message:
            result.message ||
            t("Repository connection successful."),
          details:
            result.details ||
            null,
        });

        setNotice(
          `${t("Repository connected successfully: ")}${repository.name}`
        );

        await load();
      } catch (error) {
        setConnectionResult({
          success: false,
          message:
            translateMessage(
              error.message
            ) ||
            t(
              t("Repository connection failed.")
            ),
        });

        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Repository connection failed.")
        );
      } finally {
        setBusy(false);
      }
    };

  // ==========================================================
  // TEST CONNECTION FROM FORM
  // ==========================================================

  const testFormConnection =
    async () => {
      if (!editingRepository) {
        setNotice(
          t("Save the repository first, then test its connection.")
        );
        return;
      }

      if (
        editingRepository.active ===
        false
      ) {
        setNotice(
          t("This repository is deactivated. Activate it before testing the connection.")
        );
        return;
      }

      await testConnection(
        editingRepository
      );
    };

  // ==========================================================
  // DEACTIVATE REPOSITORY
  // ==========================================================
  //
  // IMPORTANT:
  // The backend DELETE endpoint performs a SOFT DEACTIVATION.
  // It keeps the repository row in the database and sets
  // active=False.
  //
  // IMPORTANT FRONTEND BEHAVIOR:
  // Do NOT remove the repository from `repos`.
  // Instead, keep it visible and update active=false.
  // ==========================================================

  const deactivateRepository =
    async (repository) => {
      if (!canDeleteRepository) {
        setNotice(
          t("Administrator access is required to deactivate repositories.")
        );
        return;
      }

      if (!repository?.id) {
        setNotice(
          t("Unable to identify the repository.")
        );
        return;
      }

      if (
        repository.active ===
        false
      ) {
        setNotice(
          t("Repository is already deactivated.")
        );
        return;
      }

      const confirmed =
        window.confirm(
          `${t("Deactivate")} "${repository.name}"? ${t("The repository will remain in the database and visible here, but it cannot be used until activated again.")}`
        );

      if (!confirmed) {
        return;
      }

      setBusy(true);
      setNotice("");

      try {
        const response =
          await authFetch(
            `${API}/repositories/${repository.id}/`,
            {
              method: "DELETE",
            }
          );

        const result =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            getApiError(result) ||
              result.message ||
              t("Unable to deactivate repository.")
          );
        }

        // ------------------------------------------------------
        // IMPORTANT:
        //
        // DO NOT FILTER THE REPOSITORY OUT.
        //
        // Keep the repository visible and mark it inactive.
        // ------------------------------------------------------

        setRepos(
          (previous) =>
            previous.map(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  repository.id
                )
                  ? {
                      ...item,
                      active: false,
                    }
                  : item
            )
        );

        // A deactivated repository must not remain selected
        // for delivery operations.
        if (
          String(
            selectedRepositoryId
          ) ===
          String(
            repository.id
          )
        ) {
          setSelectedRepositoryId(
            ""
          );
        }

        setBranches([]);
        setBranchesError("");

        setNotice(
          result.message ||
            t("Repository deactivated successfully. The repository was not deleted and remains visible.")
        );
      } catch (error) {
        console.error(
          "Repository deactivation error:",
          error
        );

        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to deactivate repository.")
        );
      } finally {
        setBusy(false);
      }
    };

  // ==========================================================
  // ACTIVATE REPOSITORY
  // ==========================================================
  //
  // Reactivate the same database record.
  // No new repository is created.
  // ==========================================================

  const activateRepository =
    async (repository) => {
      if (!canDeleteRepository) {
        setNotice(
          t("Administrator access is required to activate repositories.")
        );
        return;
      }

      if (!repository?.id) {
        setNotice(
          t("Unable to identify the repository.")
        );
        return;
      }

      if (
        repository.active !==
        false
      ) {
        setNotice(
          t("Repository is already active.")
        );
        return;
      }

      const confirmed =
        window.confirm(
          `${t("Activate")} "${repository.name}"? ${t("The repository will become available for testing, branch fetching and delivery again.")}`
        );

      if (!confirmed) {
        return;
      }

      setBusy(true);
      setNotice("");

      try {
        const response =
          await authFetch(
            `${API}/repositories/${repository.id}/`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  active: true,
                }),
            }
          );

        const result =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            getApiError(result) ||
              result.message ||
              t("Unable to activate repository.")
          );
        }

        const activatedRepository =
          result?.id
            ? result
            : null;

        setRepos(
          (previous) =>
            previous.map(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  repository.id
                )
                  ? {
                      ...item,
                      ...(activatedRepository ||
                        {}),
                      active: true,
                    }
                  : item
            )
        );

        setNotice(
          result.message ||
            "Repository activated successfully."
        );
      } catch (error) {
        console.error(
          "Repository activation error:",
          error
        );

        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to activate repository.")
        );
      } finally {
        setBusy(false);
      }
    };

  // Keep the existing function name so any existing integration
  // that uses `deleteRepository` continues to work.
  const deleteRepository =
    deactivateRepository;

  // ==========================================================
  // DELIVERY
  // ==========================================================

  const runDelivery =
    async (dryRun = false) => {
      if (!canRunDelivery) {
        setNotice(
          t("You must be signed in to run delivery.")
        );
        return;
      }

      if (!selectedRepositoryId) {
        setNotice(
          t("Select a repository before starting delivery.")
        );
        return;
      }

      // ------------------------------------------------------
      // IMPORTANT:
      // Deactivated repositories cannot be used for delivery.
      // ------------------------------------------------------

      if (
        selectedRepository?.active ===
        false
      ) {
        setNotice(
          t("This repository is deactivated. Activate it before running delivery.")
        );
        return;
      }

      const shouldRunDry =
        dryRun ||
        settingsPreferences.defaultDeliveryMode ===
          "Dry run";

      if (
        settingsPreferences.confirmBeforeDelivery &&
        !window.confirm(
          shouldRunDry
            ? t("Start a dry-run delivery for the selected repository?")
            : t("Start delivery for the selected repository?")
        )
      ) {
        return;
      }

      setBusy(true);
      setNotice("");
      setDeliveryResult(
        null
      );

      try {
        const response =
          await authFetch(
            `${API}/jobs/`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  repository_id:
                    Number(
                      selectedRepositoryId
                    ),
                  dry_run:
                    shouldRunDry,
                }),
            }
          );

        const result =
          await response.json();

        setDeliveryResult({
          ...result,
          _success:
            response.ok,
          _dryRun:
            shouldRunDry,
        });

        if (!response.ok) {
          throw new Error(
            getApiError(result)
          );
        }

        setNotice(
          dryRun
            ? t("Dry run completed successfully.")
            : t("Delivery completed successfully.")
        );

        await load();
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Delivery failed.")
        );

        setDeliveryResult(
          (previous) => {
            if (previous) {
              return previous;
            }

            return {
              _success: false,
              _dryRun: dryRun,
              error:
                translateMessage(
                  error.message
                ) ||
                t(
                  t("Delivery failed.")
                ),
            };
          }
        );
      } finally {
        setBusy(false);
      }
    };

  const signOutAllSessions =
    async () => {
      if (!authUser?.id) {
        setNotice(
          t("Unable to identify the authenticated user.")
        );
        return;
      }

      const confirmed =
        window.confirm(
          "Sign out all active sessions? You will need to sign in again on this device."
        );

      if (!confirmed) {
        return;
      }

      setBusy(true);
      setNotice("");

      try {
        const response =
          await authFetch(
            `${API}/auth/signout-all/`,
            {
              method: "POST",
            }
          );

        const result =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            getApiError(result) ||
              t("Unable to sign out all sessions.")
          );
        }

        setNotice(
          result.message ||
            t("All active sessions were signed out. Please sign in again.")
        );

        await logout();
      } catch (error) {
        setNotice(
          translateMessage(
            error.message
          ) ||
            t("Unable to sign out all sessions.")
        );
      } finally {
        setBusy(false);
      }
    };

  const stats =
    data?.stats || {
      total: 0,
      success: 0,
      failed: 0,
      dry_run: 0,
    };

  if (authLoading) {
    return (
      <AuthLoadingScreen />
    );
  }

  const passwordResetRoute =
    getPasswordResetRoute();

  if (
    !authUser &&
    passwordResetRoute
  ) {
    return (
      <PasswordResetScreen
        uid={
          passwordResetRoute.uid
        }
        token={
          passwordResetRoute.token
        }
        onComplete={(user) => {
          window.history.replaceState(
            {},
            "",
            "/"
          );

          setNotice("");

          if (user) {
            setAuthMode("login");
            setPage("Dashboard");
            return;
          }

          clearAuth();
          setAuthMode("login");
          setPage("Dashboard");
        }}
      />
    );
  }

  if (!authUser) {
    if (
      authMode ===
      "forgot"
    ) {
      return (
        <ForgotPasswordScreen
          onBack={() =>
            setAuthMode(
              "login"
            )
          }
        />
      );
    }

    return (
      <AuthScreen
        mode={authMode}
        onModeChange={
          setAuthMode
        }
        onAuthenticated={
          handleAuthenticated
        }
      />
    );
  }

  const profileInitial = (
    authUser?.first_name ||
    authUser?.username ||
    "U"
  )
    .trim()
    .charAt(0)
    .toUpperCase();

  const profileName =
    [
      authUser?.first_name,
      authUser?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    authUser?.username ||
    "User";

  const memberSince =
    authUser?.created_at
      ? new Intl.DateTimeFormat(
        { en: "en-US", te: "te-IN", hi: "hi-IN" }[
          getCurrentLanguageCode()
        ] || "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        ).format(
          new Date(
            authUser.created_at
          )
        )
      : "Not available";

  return (
    <div
      className="app"
      data-language={
        selectedLanguage ===
        "Telugu"
          ? "te"
          : selectedLanguage ===
            "Hindi"
          ? "hi"
          : "en"
      }
      data-font={selectedFont
        .toLowerCase()
        .replaceAll(
          " ",
          "-"
        )}
    >
      {/* ======================================================
          SIDEBAR
      ======================================================= */}

      <aside>
        <div className="logo">
          <div className="logoMark">
            LD
          </div>

          <div>
            <b>
              {t("Log Delivery")}
            </b>

            <span>
              {t("Management")}
            </span>
          </div>
        </div>

        <nav>
          {[
            [
              "Dashboard",
              LayoutDashboard,
            ],
            [
              "Delivery History",
              History,
            ],
            [
              "Repositories",
              GitBranch,
            ],
            ...(isAdmin ||
            isManager
              ? [
                  [
                    "Audit Logs",
                    ListChecks,
                  ],
                ]
              : []),
            ...(isAdmin
              ? [
                  [
                    "User Management",
                    Users,
                  ],
                ]
              : []),
            [
              "Settings",
              Settings,
            ],
            [
              "Profile",
              UserCircle2,
            ],
          ].map(
            ([name, Icon]) => (
              <button
                key={name}
                className={
                  page === name
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setPage(name)
                }
              >
                <Icon size={18} />
                {t(name)}
              </button>
            )
          )}
        </nav>

        <div
          style={{
            marginTop:
              "8px",
            paddingTop:
              "8px",
            borderTop:
              "1px solid rgba(148, 163, 184, 0.14)",
          }}
        >
          <button
            type="button"
            onClick={
              handleLogout
            }
            disabled={busy}
            style={{
              width: "100%",
              display:
                "flex",
              alignItems:
                "center",
              gap: "12px",
              padding:
                "12px 14px",
              border: 0,
              borderRadius:
                "9px",
              background:
                "transparent",
              color:
                "#cbd5e1",
              fontSize:
                "14px",
              fontWeight: 600,
              cursor: busy
                ? "not-allowed"
                : "pointer",
              textAlign:
                "left",
              opacity: busy
                ? 0.55
                : 1,
            }}
            onMouseEnter={(
              event
            ) => {
              if (!busy) {
                event.currentTarget.style.background =
                  "rgba(148, 163, 184, 0.10)";

                event.currentTarget.style.color =
                  "#ffffff";
              }
            }}
            onMouseLeave={(
              event
            ) => {
              event.currentTarget.style.background =
                "transparent";

              event.currentTarget.style.color =
                "#cbd5e1";
            }}
          >
            <LogOut size={18} />
            {t("Sign out")}
          </button>
        </div>

        <div className="sideBottom">
          <ShieldCheck size={18} />

          <div>
            <b>
              {t("Secure mode")} ·{" "}
              {t(userRole)}
            </b>

            <span>
              {isAdmin
                ? t(
                    "Administrator access"
                  )
                : isManager
                ? t(
                    "Manager access"
                  )
                : t(
                    "User access"
                  )}
            </span>
          </div>
        </div>
      </aside>

      {/* ======================================================
          MAIN
      ======================================================= */}

      <main>
        <header>
          <div>
            <div className="eyebrow">
              {t(
                "OPERATIONS CENTER"
              )}
            </div>

            <h1>
              {t(page)}
            </h1>

            <p>
              {page ===
              "Repositories"
                ? t(
                    "Configure Git repositories, targets, recipients and connection settings."
                  )
                : t(
                    "Collect application files from configured repositories and deliver them securely."
                  )}
            </p>
          </div>

          <div className="actions">
            {page !==
              "Repositories" && (
              <label className="dashboard-language-control">
                <Globe2 size={15} />

                <select
                  value={
                    selectedLanguage
                  }
                  onChange={(
                    event
                  ) =>
                    handleLanguageChange(
                      event.target
                        .value
                    )
                  }
                  aria-label={t("Language")}
                >
                  {languageOptions.map(
                    (
                      language
                    ) => (
                      <option
                        key={
                          language.value
                        }
                        value={
                          language.value
                        }
                      >
                        {
                          language.label
                        }
                      </option>
                    )
                  )}
                </select>
              </label>
            )}

            <button
              className="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);

                try {
                  await load();
                } catch (error) {
                  setNotice(
                    error.message ||
                      "Unable to refresh data."
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw
                size={16}
              />
              {t("Refresh")}
            </button>

            {page ===
              "Repositories" &&
              canManageRepositories && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={
                    openAddRepository
                  }
                >
                  <Plus size={16} />
                  {t(
                    "Add repository"
                  )}
                </button>
              )}

            {page !==
              "Repositories" &&
              canRunDelivery && (
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !selectedRepositoryId ||
                    selectedRepository?.active ===
                      false
                  }
                  onClick={() =>
                    runDelivery(
                      false
                    )
                  }
                >
                  <Send size={16} />

                  {busy
                    ? t(
                        "Processing..."
                      )
                    : selectedRepository?.active ===
                      false
                    ? t(
                        "Repository deactivated"
                      )
                    : t(
                        "Run delivery"
                      )}
                </button>
              )}
          </div>
        </header>

        {notice && (
          <div className="notice">
            {t(notice)}
          </div>
        )}

        {/* ======================================================
            DASHBOARD
        ======================================================= */}

        {page ===
          "Dashboard" && (
          <DashboardEnhancement
            jobs={jobs}
            repos={repos}
            stats={stats}
            selectedRepository={
              selectedRepository
            }
            onHistory={() =>
              setPage(
                "Delivery History"
              )
            }
            onRepositories={() =>
              setPage(
                "Repositories"
              )
            }
          />
        )}

        {/* ======================================================
            DELIVERY HISTORY
        ======================================================= */}

        {page ===
          "Delivery History" && (
          <section className="panel full historyPanel">
            <div className="historyHeader">
              <div className="historyFilters">
                <div className="historySearch">
                  <Search size={14} />

                  <input
                    type="search"
                    value={
                      jobSearch
                    }
                    onChange={(
                      event
                    ) =>
                      setJobSearch(
                        event.target
                          .value
                      )
                    }
                    placeholder={t("Search")}
                    aria-label={t("Search delivery job")}
                  />
                </div>

                <div className="historyFilterField">
                  <select
                    value={
                      jobStatusFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setJobStatusFilter(
                        event.target
                          .value
                      )
                    }
                    aria-label={t("Status filter")}
                  >
                    <option value="ALL">
                      {t("All statuses")}
                    </option>

                    <option value="SUCCESS">
                      {t("Success")}
                    </option>

                    <option value="FAILED">
                      {t("Failed")}
                    </option>

                    <option value="DRY_RUN">
                      {t("Dry run")}
                    </option>

                    <option value="RUNNING">
                      {t("Running")}
                    </option>

                    <option value="QUEUED">
                      {t("Queued")}
                    </option>
                  </select>
                </div>

                <div className="historyFilterField">
                  <select
                    value={
                      jobRepositoryFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setJobRepositoryFilter(
                        event.target
                          .value
                      )
                    }
                    aria-label={t("Repository filter")}
                  >
                    <option value="ALL">
                      {t("All repositories")}
                    </option>

                    {jobRepositoryOptions.map(
                      (repo) => (
                        <option
                          key={repo}
                          value={repo}
                        >
                          {repo}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="historyFilterField">
                  <select
                    value={
                      jobModeFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setJobModeFilter(
                        event.target
                          .value
                      )
                    }
                    aria-label={t("Mode filter")}
                  >
                    <option value="ALL">
                      {t("All modes")}
                    </option>

                    <option value="LIVE">
                      {t("Live")}
                    </option>

                    <option value="DRY_RUN">
                      {t("Dry run")}
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  className="ghost small"
                  onClick={() => {
                    setJobSearch("");
                    setJobStatusFilter(
                      "ALL"
                    );
                    setJobRepositoryFilter(
                      "ALL"
                    );
                    setJobModeFilter(
                      "ALL"
                    );
                    setJobDateFrom("");
                    setJobDateTo("");
                  }}
                >
                  <X size={14} />
                  {t(
                    "Clear filters"
                  )}
                </button>
              </div>

              <div className="historyFilters historyDateFilters">
                <div className="historyFilterField">
                  <label htmlFor="job-date-from">
                    {t("From")}
                  </label>

                  <input
                    id="job-date-from"
                    type="date"
                    value={
                      jobDateFrom
                    }
                    onChange={(
                      event
                    ) =>
                      setJobDateFrom(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="historyFilterField">
                  <label htmlFor="job-date-to">
                    {t("To")}
                  </label>

                  <input
                    id="job-date-to"
                    type="date"
                    value={
                      jobDateTo
                    }
                    onChange={(
                      event
                    ) =>
                      setJobDateTo(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <button
                  type="button"
                  className="primary small"
                  disabled={
                    busy ||
                    !selectedRepositoryId ||
                    selectedRepository?.active ===
                      false
                  }
                  onClick={() =>
                    runDelivery(
                      true
                    )
                  }
                >
                  <Clock3
                    size={15}
                  />
                  {t("Dry run")}
                </button>
              </div>
            </div>

            <div className="historyResultsInfo">
              <div>
                <b>
                  {
                    filteredJobs.length
                  }{" "}
                  {t("executions")}
                </b>
              </div>

              <span>
                {t("Page")}{" "}
                {
                  currentPage
                }{" "}
                {t("of")}{" "}
                {
                  totalJobPages
                }
              </span>
            </div>

            <div className="historyTable">
              <div className="historyRow historyHead">
                <span>
                  {t("Job ID")}
                </span>
                <span>
                  {t("Repository")}
                </span>
                <span>
                  {t("Branch")}
                </span>
                <span>
                  {t("Commit")}
                </span>
                <span>
                  {t("Status")}
                </span>
                <span>
                  {t("Mode")}
                </span>
                <span>
                  {t("Files")}
                </span>
                <span>
                  {t("Duration")}
                </span>
                <span>
                  {t("Archive")}
                </span>
                <span>
                  {t("Triggered by")}
                </span>
                <span>
                  {t("Created")}
                </span>
                <span>
                  {t("Actions")}
                </span>
              </div>

              {paginatedJobs.map(
                (job) => (
                  <div
                    key={job.id}
                    className="historyRow"
                  >
                    <span>
                      <b>
                        {
                          job.job_reference ||
                          `JOB-${job.id}`
                        }
                      </b>
                    </span>

                    <span>
                      <b>
                        {
                          job.repository_name ||
                          job.repository ||
                          "-"
                        }
                      </b>
                    </span>

                    <span>
                      {
                        job.branch ||
                        "main"
                      }
                    </span>

                    <span>
                      <small>
                        {
                          job.commit ||
                          "—"
                        }
                      </small>
                    </span>

                    <span>
                      <Status
                        s={
                          job.status
                        }
                      />
                    </span>

                    <span>
                      <span
                        className={`status ${
                          String(
                            job.status ||
                              ""
                          ).toUpperCase() ===
                          "DRY_RUN"
                            ? "dry_run"
                            : "success"
                        }`}
                      >
                        {String(
                          job.status ||
                            ""
                        ).toUpperCase() ===
                        "DRY_RUN"
                          ? t("DRY RUN")
                          : t("LIVE")}
                      </span>
                    </span>

                    <span>
                      {
                        job.files_count ??
                        0
                      }
                    </span>

                    <span>
                      {job.duration_seconds !=
                      null
                        ? `${Number(
                            job.duration_seconds
                          ).toFixed(
                            2
                          )} sec`
                        : "—"}
                    </span>

                    <span>
                      <small>
                        {
                          job.archive_name ||
                          "—"
                        }
                      </small>
                    </span>

                    <span>
                      {
                        job.created_by_name ||
                        job.created_by ||
                        "admin"
                      }
                    </span>

                    <span>
                      {job.created_at
                        ? new Date(
                            job.created_at
                          ).toLocaleString(
                            { en: "en-US", te: "te-IN", hi: "hi-IN" }[
                              getCurrentLanguageCode()
                            ] || "en-US"
                          )
                        : "—"}
                    </span>

                    <span>
                      <div className="historyRowActions">
                        <button
                          type="button"
                          className="ghost small"
                          onClick={() =>
                            setSelectedDeliveryJob(
                              job
                            )
                          }
                        >
                          <Eye
                            size={14}
                          />
                          {t("View")}
                        </button>

                        <button
                          type="button"
                          className="danger small"
                          onClick={() =>
                            deleteJob(
                              job
                            )
                          }
                          disabled={
                            deletingJobId ===
                            job.id
                          }
                        >
                          <Trash2
                            size={14}
                          />

                          {deletingJobId ===
                          job.id
                            ? t("Deleting...")
                            : t("Delete")}
                        </button>
                      </div>
                    </span>
                  </div>
                )
              )}
            </div>

            {filteredJobs.length >
              0 && (
              <div className="historyPagination">
                <span>
                  {t("Showing")}{" "}
                  {Math.min(
                    (currentPage -
                      1) *
                      jobsPerPage +
                      1,
                    filteredJobs.length
                  )}{" "}
                  {t("to")}{" "}
                  {Math.min(
                    currentPage *
                      jobsPerPage,
                    filteredJobs.length
                  )}{" "}
                  {t("of")}{" "}
                  {
                    filteredJobs.length
                  }{" "}
                  {t("results")}
                </span>

                <div>
                  <button
                    type="button"
                    className="paginationButton"
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.max(
                            1,
                            page -
                              1
                          )
                      )
                    }
                    disabled={
                      currentPage <=
                      1
                    }
                  >{t("Previous")}</button>

                  {Array.from(
                    {
                      length:
                        totalJobPages,
                    },
                    (
                      _,
                      index
                    ) =>
                      index + 1
                  ).map(
                    (
                      pageNumber
                    ) => (
                      <button
                        key={
                          pageNumber
                        }
                        type="button"
                        className={
                          currentPage ===
                          pageNumber
                            ? "paginationButton active"
                            : "paginationButton"
                        }
                        onClick={() =>
                          setCurrentPage(
                            pageNumber
                          )
                        }
                      >
                        {
                          pageNumber
                        }
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    className="paginationButton"
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.min(
                            totalJobPages,
                            page +
                              1
                          )
                      )
                    }
                    disabled={
                      currentPage >=
                      totalJobPages
                    }
                  >{t("Next")}</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================
            REPOSITORIES
        ======================================================= */}

        {page ===
          "Repositories" && (
          <section className="panel full repositoryPage">
            <div className="panelHead repositoryPageHeader">
              <div>
                <div className="eyebrow">
                  {t(
                    "SOURCE MANAGEMENT"
                  )}
                </div>

                <h2>
                  {t(
                    "Repositories"
                  )}
                </h2>

                <span>
                  {t(
                    "Configure Git repositories, targets, recipients and connection settings."
                  )}
                </span>
              </div>

              {canManageRepositories && (
                <button
                  className="primary small"
                  onClick={
                    openAddRepository
                  }
                  disabled={busy}
                >
                  <Plus size={16} />
                  {t(
                    "Add repository"
                  )}
                </button>
              )}
            </div>

            <div className="repositoryStats">
              <div className="repositoryStatCard connected">
                <div className="repositoryStatIcon">
                  <CheckCircle2
                    size={18}
                  />
                </div>

                <div>
                  <strong>
                    {
                      repositoryStats.connected
                    }
                  </strong>

                  <b>
                    {t("Connected")}
                  </b>

                  <span>
                    {t(
                      "Active & healthy"
                    )}
                  </span>
                </div>
              </div>

              <div className="repositoryStatCard attention">
                <div className="repositoryStatIcon">
                  <AlertTriangle
                    size={18}
                  />
                </div>

                <div>
                  <strong>
                    {
                      repositoryStats.needsAttention
                    }
                  </strong>

                  <b>
                    {t(
                      "Needs attention"
                    )}
                  </b>

                  <span>
                    {t(
                      "Check configuration"
                    )}
                  </span>
                </div>
              </div>

              <div className="repositoryStatCard offline">
                <div className="repositoryStatIcon">
                  <XCircle
                    size={18}
                  />
                </div>

                <div>
                  <strong>
                    {
                      repositoryStats.offline
                    }
                  </strong>

                  <b>
                    {t("Offline")}
                  </b>

                  <span>
                    {t(
                      "Not reachable"
                    )}
                  </span>
                </div>
              </div>

              <div className="repositoryStatCard total">
                <div className="repositoryStatIcon">
                  <Archive
                    size={18}
                  />
                </div>

                <div>
                  <strong>
                    {
                      repositoryStats.total
                    }
                  </strong>

                  <b>
                    {t(
                      "Total repositories"
                    )}
                  </b>

                  <span>
                    {t(
                      "All configured"
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="repositoryToolbar">
              <div className="repositorySearch">
                <div className="repositorySearchIcon">
                  <Search
                    size={15}
                  />
                </div>

                <input
                  type="search"
                  value={
                    repositorySearch
                  }
                  onChange={(
                    event
                  ) =>
                    setRepositorySearch(
                      event.target
                        .value
                    )
                  }
                  placeholder={t(
                    "Search repositories..."
                  )}
                  aria-label={t(
                    "Search repositories"
                  )}
                />

                {repositorySearch && (
                  <button
                    type="button"
                    className="repositorySearchClear"
                    onClick={() =>
                      setRepositorySearch(
                        ""
                      )
                    }
                    aria-label={t(
                      "Clear search"
                    )}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                className="repositoryStatusFilter"
                value={
                  repositoryStatusFilter
                }
                onChange={(
                  event
                ) =>
                  setRepositoryStatusFilter(
                    event.target
                      .value
                  )
                }
                aria-label={t(
                  "Repository status"
                )}
              >
                <option value="ALL">
                  {t(
                    "All statuses"
                  )}
                </option>

                <option value="CONNECTED">
                  {t("Connected")}
                </option>

                <option value="NEEDS_ATTENTION">
                  {t(
                    "Needs attention"
                  )}
                </option>

                <option value="OFFLINE">
                  {t("Offline")}
                </option>

                <option value="DEACTIVATED">
                  {t("Deactivated")}
                </option>
              </select>

              <div className="repositoryViewToggle">
                <button
                  type="button"
                  className={
                    repositoryViewMode ===
                    "grid"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setRepositoryViewMode(
                      "grid"
                    )
                  }
                  aria-label={t(
                    "Grid view"
                  )}
                  title={t(
                    "Grid view"
                  )}
                >
                  ▦
                </button>

                <button
                  type="button"
                  className={
                    repositoryViewMode ===
                    "list"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setRepositoryViewMode(
                      "list"
                    )
                  }
                  aria-label={t(
                    "List view"
                  )}
                  title={t(
                    "List view"
                  )}
                >
                  ☷
                </button>
              </div>
            </div>

            {repos.length >
              0 && (
              <div className="repositoryResultSummary">
                <div>
                  <b>
                    {t(
                      "Repositories"
                    )}
                  </b>

                  <span>
                    {
                      filteredRepositories.length
                    }{" "}
                    {t(
                      filteredRepositories.length ===
                        1
                        ? "repository"
                        : "repositories"
                    )}
                  </span>
                </div>

                {(repositorySearch ||
                  repositoryStatusFilter !==
                    "ALL") && (
                  <button
                    type="button"
                    className="repositoryClearFilters"
                    onClick={() => {
                      setRepositorySearch(
                        ""
                      );

                      setRepositoryStatusFilter(
                        "ALL"
                      );
                    }}
                  >
                    <X
                      size={13}
                    />

                    {t(
                      "Clear filters"
                    )}
                  </button>
                )}
              </div>
            )}

            {repos.length ===
            0 ? (
              <div className="empty">
                <GitBranch
                  size={38}
                />

                <b>
                  {t(
                    "No repositories configured"
                  )}
                </b>

                <span>
                  {t(
                    "Add your first repository to begin collecting files."
                  )}
                </span>

                {canManageRepositories && (
                  <button
                    className="primary small"
                    onClick={
                      openAddRepository
                    }
                  >
                    <Plus
                      size={15}
                    />

                    {t(
                      "Add repository"
                    )}
                  </button>
                )}
              </div>
            ) : filteredRepositories.length ===
              0 ? (
              <div className="empty">
                <GitBranch
                  size={38}
                />

                <b>
                  {t(
                    "No repositories found"
                  )}
                </b>

                <span>
                  {t(
                    "Try changing your search or status filter."
                  )}
                </span>

                <button
                  type="button"
                  className="ghost small"
                  onClick={() => {
                    setRepositorySearch(
                      ""
                    );

                    setRepositoryStatusFilter(
                      "ALL"
                    );
                  }}
                >
                  <X size={14} />

                  {t(
                    "Clear filters"
                  )}
                </button>
              </div>
            ) : (
              <div
                className={`repositoryList ${
                  repositoryViewMode ===
                  "grid"
                    ? "repositoryGrid"
                    : "repositoryListView"
                }`}
              >
                {paginatedRepositories.map(
                  (
                    repository
                  ) => (
                    <RepositoryCard
                      key={
                        repository.id
                      }
                      repository={
                        repository
                      }
                      busy={busy}
                      canManage={
                        canManageRepositories
                      }
                      canDelete={
                        canDeleteRepository
                      }
                      selected={
                        String(
                          selectedRepositoryId
                        ) ===
                        String(
                          repository.id
                        )
                      }
                      onSelect={() =>
                        setSelectedRepositoryId(
                          String(
                            repository.id
                          )
                        )
                      }
                      onEdit={
                        openEditRepository
                      }
                      onTest={
                        testConnection
                      }
                      onDelete={
                        deleteRepository
                      }
                      onActivate={
                        activateRepository
                      }
                    />
                  )
                )}
              </div>
            )}

            {filteredRepositories.length >
              0 && (
              <div className="repositoryPagination">
                <span>
                  {t(
                    "Showing"
                  )}{" "}
                  {Math.min(
                    (repositoryPage -
                      1) *
                      repositoriesPerPage +
                      1,
                    filteredRepositories.length
                  )}{" "}
                  {t("to")}{" "}
                  {Math.min(
                    repositoryPage *
                      repositoriesPerPage,
                    filteredRepositories.length
                  )}{" "}
                  {t("of")}{" "}
                  {
                    filteredRepositories.length
                  }{" "}
                  {t(
                    filteredRepositories.length ===
                      1
                      ? "repository"
                      : "repositories"
                  )}
                </span>

                <div className="repositoryPaginationControls">
                  <button
                    type="button"
                    disabled={
                      repositoryPage <=
                      1
                    }
                    onClick={() =>
                      setRepositoryPage(
                        (previous) =>
                          Math.max(
                            1,
                            previous -
                              1
                          )
                      )
                    }
                    aria-label={t(
                      "Previous page"
                    )}
                  >
                    ‹
                  </button>

                  {Array.from(
                    {
                      length:
                        repositoryTotalPages,
                    },
                    (
                      _,
                      index
                    ) =>
                      index + 1
                  )
                    .slice(
                      0,
                      5
                    )
                    .map(
                      (
                        pageNumber
                      ) => (
                        <button
                          key={
                            pageNumber
                          }
                          type="button"
                          className={
                            repositoryPage ===
                            pageNumber
                              ? "current"
                              : ""
                          }
                          onClick={() =>
                            setRepositoryPage(
                              pageNumber
                            )
                          }
                        >
                          {
                            pageNumber
                          }
                        </button>
                      )
                    )}

                  <button
                    type="button"
                    disabled={
                      repositoryPage >=
                      repositoryTotalPages
                    }
                    onClick={() =>
                      setRepositoryPage(
                        (previous) =>
                          Math.min(
                            repositoryTotalPages,
                            previous +
                              1
                          )
                      )
                    }
                    aria-label={t(
                      "Next page"
                    )}
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================
            AUDIT LOGS
        ======================================================= */}

        {page ===
          "Audit Logs" &&
          (isAdmin ||
            isManager) && (
            <section className="panel full">
              <div className="panelHead">
                <div>
                  <div className="eyebrow">
                    {t(
                      "SECURITY & COMPLIANCE"
                    )}
                  </div>

                  <h2>
                    {t(
                      "Audit Logs"
                    )}
                  </h2>

                  <span>
                    {t(
                      "Review authenticated application activity and security events."
                    )}
                  </span>
                </div>

                <button
                  className="ghost small"
                  onClick={
                    loadAuditLogs
                  }
                  disabled={
                    auditLogsLoading ||
                    busy
                  }
                >
                  <RefreshCw
                    size={15}
                  />

                  {auditLogsLoading
                    ? t(
                        "Loading..."
                      )
                    : t(
                        "Refresh"
                      )}
                </button>
              </div>

              <div className="audit-log-summary">
                <div className="audit-log-summary-card total">
                  <div className="audit-log-summary-icon">
                    <ListChecks
                      size={18}
                    />
                  </div>

                  <div className="audit-log-summary-body">
                    <strong>
                      {
                        auditSummary.total
                      }
                    </strong>

                    <span>
                      {t("Total events")}
                    </span>
                  </div>
                </div>

                <div className="audit-log-summary-card success">
                  <div className="audit-log-summary-icon">
                    <CheckCircle2
                      size={18}
                    />
                  </div>

                  <div className="audit-log-summary-body">
                    <strong>
                      {
                        auditSummary.success
                      }
                    </strong>

                    <span>
                      {t("Success events")}
                    </span>
                  </div>
                </div>

                <div className="audit-log-summary-card warning">
                  <div className="audit-log-summary-icon">
                    <AlertTriangle
                      size={18}
                    />
                  </div>

                  <div className="audit-log-summary-body">
                    <strong>
                      {
                        auditSummary.warning
                      }
                    </strong>

                    <span>
                      {t("Warning events")}
                    </span>
                  </div>
                </div>

                <div className="audit-log-summary-card failed">
                  <div className="audit-log-summary-icon">
                    <XCircle
                      size={18}
                    />
                  </div>

                  <div className="audit-log-summary-body">
                    <strong>
                      {
                        auditSummary.failed
                      }
                    </strong>

                    <span>
                      {t("Failed events")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="audit-log-filter-grid">
                <div className="formField">
                  <label>
                    {t("Action")}
                  </label>

                  <select
                    value={
                      auditActionFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setAuditActionFilter(
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      {t(
                        "All actions"
                      )}
                    </option>

                    {auditActionOptions.map(
                      (
                        action
                      ) => (
                        <option
                          key={
                            action
                          }
                          value={
                            action
                          }
                        >
                          {t(action)}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="formField">
                  <label>
                    {t(
                      "Resource"
                    )}
                  </label>

                  <select
                    value={
                      auditResourceFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setAuditResourceFilter(
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      {t(
                        "All resources"
                      )}
                    </option>

                    {auditResourceOptions.map(
                      (
                        resource
                      ) => (
                        <option
                          key={
                            resource
                          }
                          value={
                            resource
                          }
                        >
                          {t(resource)}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <button
                  className="ghost small audit-log-clear"
                  type="button"
                  onClick={() => {
                    setAuditActionFilter(
                      ""
                    );

                    setAuditResourceFilter(
                      ""
                    );
                  }}
                >
                  <X size={14} />
                  {t("Clear")}
                </button>
              </div>

              {auditLogsLoading &&
              auditLogs.length ===
                0 ? (
                <div className="empty">
                  <ListChecks
                    size={38}
                  />

                  <b>
                    {t(
                      "Loading audit logs..."
                    )}
                  </b>

                  <span>
                    {t(
                      "Retrieving security and application activity."
                    )}
                  </span>
                </div>
              ) : auditLogs.length ===
                0 ? (
                <div className="empty">
                  <ListChecks
                    size={38}
                  />

                  <b>
                    {t(
                      "No audit records found"
                    )}
                  </b>

                  <span>
                    {t(
                      "Try changing the filters or perform an authenticated action."
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <AuditLogTable
                    logs={
                      paginatedAuditLogs
                    }
                    canDelete={
                      isAdmin
                    }
                    deletingAuditLogId={
                      deletingAuditLogId
                    }
                    onDelete={
                      deleteAuditLog
                    }
                    onView={
                      setSelectedAuditLog
                    }
                  />

                  {auditTotalPages >
                    1 && (
                    <div className="historyPagination">
                      <span>
                        {t(
                          "Showing"
                        )}{" "}
                        {Math.min(
                          (auditPage -
                            1) *
                            auditPageSize +
                            1,
                          auditLogs.length
                        )}{" "}
                        {t("to")}{" "}
                        {Math.min(
                          auditPage *
                            auditPageSize,
                          auditLogs.length
                        )}{" "}
                        {t("of")}{" "}
                        {
                          auditLogs.length
                        }{" "}
                        {t(
                          "results"
                        )}
                      </span>

                      <div>
                        <button
                          type="button"
                          className="paginationButton"
                          onClick={() =>
                            setAuditPage(
                              (page) =>
                                Math.max(
                                  1,
                                  page -
                                    1
                                )
                            )
                          }
                          disabled={
                            auditPage <=
                            1
                          }
                        >
                          {t(
                            "Previous"
                          )}
                        </button>

                        {Array.from(
                          {
                            length:
                              auditTotalPages,
                          },
                          (
                            _,
                            index
                          ) =>
                            index + 1
                        ).map(
                          (
                            pageNumber
                          ) => (
                            <button
                              key={
                                pageNumber
                              }
                              type="button"
                              className={
                                auditPage ===
                                pageNumber
                                  ? "paginationButton active"
                                  : "paginationButton"
                              }
                              onClick={() =>
                                setAuditPage(
                                  pageNumber
                                )
                              }
                            >
                              {
                                pageNumber
                              }
                            </button>
                          )
                        )}

                        <button
                          type="button"
                          className="paginationButton"
                          onClick={() =>
                            setAuditPage(
                              (page) =>
                                Math.min(
                                  auditTotalPages,
                                  page +
                                    1
                                )
                            )
                          }
                          disabled={
                            auditPage >=
                            auditTotalPages
                          }
                        >
                          {t("Next")}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

        {/* ======================================================
            USER MANAGEMENT
        ======================================================= */}

        {page ===
          "User Management" &&
          canManageUsers && (
            <section className="panel full">
              <div className="panelHead">
                <div>
                  <div className="eyebrow">
                    {t(
                      "ACCESS ADMINISTRATION"
                    )}
                  </div>

                  <h2>
                    {t(
                      "User Management"
                    )}
                  </h2>

                  <span>
                    {t(
                      "Create application users, manage roles and control account access."
                    )}
                  </span>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "8px",
                  }}
                >
                  <button
                    className="ghost small"
                    onClick={
                      loadManagedUsers
                    }
                    disabled={
                      busy ||
                      usersLoading
                    }
                  >
                    <RefreshCw
                      size={15}
                    />

                    {usersLoading
                      ? t("Loading...")
                      : t("Refresh")}
                  </button>

                  <button
                    className="primary small"
                    onClick={
                      openCreateUser
                    }
                    disabled={busy}
                  >
                    <Plus
                      size={16}
                    />

                    {t(
                      "Create user"
                    )}
                  </button>
                </div>
              </div>

              {usersLoading &&
              managedUsers.length ===
                0 ? (
                <div className="empty">
                  <Users
                    size={38}
                  />

                  <b>
                    {t(
                      "Loading users..."
                    )}
                  </b>

                  <span>
                    {t(
                      "Retrieving the application user list."
                    )}
                  </span>
                </div>
              ) : managedUsers.length ===
                0 ? (
                <div className="empty">
                  <Users
                    size={38}
                  />

                  <b>
                    {t(
                      "No users found"
                    )}
                  </b>

                  <span>
                    {t(
                      "Create the first managed application user."
                    )}
                  </span>

                  <button
                    className="primary small"
                    onClick={
                      openCreateUser
                    }
                  >
                    <Plus
                      size={15}
                    />

                    {t(
                      "Create user"
                    )}
                  </button>
                </div>
              ) : (
                <UserManagementTable
                  users={
                    managedUsers
                  }
                  currentUserId={
                    authUser?.id
                  }
                  busy={busy}
                  onEdit={
                    openEditUser
                  }
                  onToggle={
                    toggleManagedUser
                  }
                />
              )}
            </section>
          )}

        {/* ======================================================
            PROFILE
        ======================================================= */}

        {page ===
          "Profile" && (
          <>
            <section className="panel full profilePage">
              <div className="panelHead">
                <div>
                  <div className="eyebrow">
                    {t("ACCOUNT")}
                  </div>

                  <h2>
                    {t(
                      "My Profile"
                    )}
                  </h2>

                  <span>
                    {t(
                      "View and update your Log Delivery Management account details."
                    )}
                  </span>
                </div>

                <button
                  className="primary small"
                  onClick={
                    openProfileEdit
                  }
                  disabled={busy}
                >
                  <Pencil
                    size={15}
                  />

                  {t(
                    "Edit profile"
                  )}
                </button>
              </div>

              <div className="profileOverview">
                <div className="profileIdentitySummary">
                  <div
                    className="profileAvatar"
                    aria-hidden="true"
                  >
                    {
                      profileInitial
                    }
                  </div>

                  <div className="profileIdentityDetails">
                    <div className="profileNameRow">
                      <h3>
                        {
                          profileName
                        }
                      </h3>

                      <span className="profileRoleBadge">
                        {
                          t(authUser?.role || "USER")
                        }
                      </span>
                    </div>

                    <span className="profileDetail">
                      <Mail
                        size={15}
                      />

                      {
                        authUser?.email ||
                        t("Not available")
                      }
                    </span>

                    <span className="profileDetail">
                      <CalendarDays
                        size={15}
                      />

                      {t("Member since")}{" "}
                      {
                        memberSince
                      }
                    </span>

                    <span className="profileStatusLine">
                      <i />

                      {authUser?.is_active
                        ? t("Active account")
                        : t("Inactive account")}
                    </span>
                  </div>
                </div>

                <div className="profileStats">
                  <div className="profileStat">
                    <span className="profileStatIcon">
                      <ShieldCheck
                        size={21}
                      />
                    </span>

                    <div>
                      <small>
                        {t("Role")}
                      </small>

                      <b>
                        {
                          t(authUser?.role || "USER")
                        }
                      </b>

                      <span>
                        {t("Account permissions")}
                      </span>
                    </div>
                  </div>

                  <div className="profileStat">
                    <span className="profileStatIcon success">
                      <CheckCircle2
                        size={21}
                      />
                    </span>

                    <div>
                      <small>
                        {t("Account status")}
                      </small>

                      <b>
                        {authUser?.is_active
                          ? t("ACTIVE")
                          : t("INACTIVE")}
                      </b>

                      <span>
                        {authUser?.is_active
                          ? t("Account is active")
                          : t("Account is inactive")}
                      </span>
                    </div>
                  </div>

                  <div className="profileStat">
                    <span className="profileStatIcon">
                      <Clock3
                        size={21}
                      />
                    </span>

                    <div>
                      <small>
                        {t("Session")}
                      </small>

                      <b>
                        {t("Current session")}
                      </b>

                      <span>
                        {t("Authenticated with JWT")}
                      </span>
                    </div>
                  </div>

                  <div className="profileStat">
                    <span className="profileStatIcon">
                      <IdCard
                        size={21}
                      />
                    </span>

                    <div>
                      <small>
                        {t("User ID")}
                      </small>

                      <b>
                        {
                          authUser?.id ||
                          "—"
                        }
                      </b>

                      <span>
                        {t("System user ID")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="profileDivider" />

              <section
                className="profilePersonal"
                aria-labelledby="personal-information-title"
              >
                <div className="profileSectionHeading">
                  <span>
                    <UserCircle2
                      size={20}
                    />
                  </span>

                  <h3 id="personal-information-title">
                    {t("Personal Information")}
                  </h3>
                </div>

                <div className="settings profileFormGrid">
                  <SettingField
                    label={t(
                      "Username"
                    )}
                    value={
                      authUser?.username ||
                      "—"
                    }
                  />

                  <SettingField
                    label={t("Email")}
                    value={
                      authUser?.email ||
                      "—"
                    }
                  />

                  <SettingField
                    label={t(
                      "First name"
                    )}
                    value={
                      authUser?.first_name ||
                      "—"
                    }
                  />

                  <SettingField
                    label={t(
                      "Last name"
                    )}
                    value={
                      authUser?.last_name ||
                      "—"
                    }
                  />

                  <SettingField
                    label={t("Role")}
                    value={
                      authUser?.role ||
                      "USER"
                    }
                  />

                  <SettingField
                    label={t(
                      "Account status"
                    )}
                    value={
                      authUser?.is_active
                        ? "ACTIVE"
                        : "INACTIVE"
                    }
                  />
                </div>
              </section>
            </section>

            <div
              className="profileActionCard"
              style={{
                marginTop:
                  "24px",
                padding:
                  "16px",
                borderRadius:
                  "12px",
                border:
                  "1px solid #e2e8f0",
                background:
                  "#f8fafc",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap:
                  "16px",
                flexWrap:
                  "wrap",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap:
                    "10px",
                }}
              >
                <ShieldCheck
                  size={18}
                />

                <div>
                  <b>
                    {t(
                      "Secure session"
                    )}
                  </b>

                  <div
                    style={{
                      marginTop:
                        "3px",
                      color:
                        "#64748b",
                      fontSize:
                        "12px",
                    }}
                  >
                    {t(
                      "Your account is authenticated using JWT."
                    )}
                  </div>
                </div>
              </div>

              <button
                className="ghost"
                onClick={
                  handleLogout
                }
                disabled={busy}
              >
                <LogOut
                  size={15}
                />

                {t(
                  "Sign out"
                )}
              </button>
            </div>

            <section className="profileActionCard profilePasswordCard">
              <div className="profileActionCopy">
                <span className="profileActionIcon">
                  <KeyRound
                    size={22}
                  />
                </span>

                <div>
                  <h3>
                    {t("Change Password")}
                  </h3>

                  <p>
                    {t("Update your password regularly to keep your account secure.")}
                  </p>
                </div>
              </div>

              <button
                className="ghost"
                onClick={() =>
                  setNotice(
                    t("Use Forgot password from the sign-in screen to update your password.")
                  )
                }
              >
                <KeyRound
                  size={15}
                />

                {t("Change password")}
              </button>
            </section>

            <aside
              className="profileAbout"
              aria-label={t("Profile information notice")}
            >
              <span>
                <Info size={23} />
              </span>

              <div>
                <h3>
                  {t("About your profile")}
                </h3>

                <p>
                  {t("This information is used for account management and security purposes.")}
                </p>

                <p>
                  {t("Contact an administrator if you notice any incorrect information.")}
                </p>
              </div>
            </aside>
          </>
        )}

        {/* ======================================================
            SETTINGS
        ======================================================= */}

        {page === "Settings" && (
          <section className="settingsPage panel full">
            {notice && (
              <div className="settingsNotice">
                <span className="settingsNoticeIcon">✓</span>
                <span>{t(notice)}</span>
                <button
                  type="button"
                  className="settingsNoticeClose"
                  onClick={() => setNotice("")}
                  aria-label={t("Dismiss notice")}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {settingsLoading && (
              <div className="settingsNotice">
                <span className="settingsNoticeIcon">↻</span>
                <span>{t("Loading your settings...")}</span>
              </div>
            )}

            <div className="settingsGridTwo">
              <div className="settingsCard">
                <div className="settingsCardHeader">
                  <div className="settingsCardIcon">
                    <Settings size={16} />
                  </div>
                  <div>
                    <h3>{t("Appearance")}</h3>
                    <p>{t("Customize how the application looks and feels.")}</p>
                  </div>
                </div>

                <div className="settingsFieldBlock">
                  <label>{t("Theme")}</label>
                  <p>{t("Select your preferred theme.")}</p>

                  <div className="themeButtons">
                    {[
                      "System default",
                      "Light",
                      "Dark",
                    ].map((theme) => (
                      <button
                        key={theme}
                        type="button"
                        className={
                          selectedTheme === theme
                            ? "themeButton selected"
                            : "themeButton"
                        }
                        onClick={() =>
                          applyThemeSelection(
                            theme
                          )
                        }
                      >
                        <span>{t(theme)}</span>
                        {selectedTheme === theme && (
                          <CheckCircle2 size={14} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settingsFieldBlock">
                  <label>{t("Font")}</label>
                  <p>{t("Choose the font used throughout the application.")}</p>

                  <div className="fontButtons">
                    {fontOptions.map((font) => (
                      <button
                        key={font.value}
                        type="button"
                        className={
                          selectedFont === font.value
                            ? "fontButton selected"
                            : "fontButton"
                        }
                        onClick={() =>
                          handleFontChange(
                            font.value
                          )
                        }
                        style={{ fontFamily: font.family }}
                      >
                        <div className="fontButtonTop">
                          <span>{t(font.label)}</span>
                          {selectedFont === font.value && (
                            <CheckCircle2 size={14} />
                          )}
                        </div>
                        <small>{t(font.description)}</small>
                        <div className="fontSample">Aa Bb Cc 123</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="settingsCard">
                <div className="settingsCardHeader">
                  <div className="settingsCardIcon">
                    <Settings size={16} />
                  </div>
                  <div>
                    <h3>{t("Application preferences")}</h3>
                    <p>{t("Configure default behavior and preferences.")}</p>
                  </div>
                </div>

                <div className="settingsFieldList">
                  <div className="settingRow">
                    <div>
                      <label>{t("Default repository")}</label>
                    </div>

                    <select
                      value={
                        settingsPreferences.defaultRepository
                      }
                      onChange={(event) =>
                        updatePreference(
                          "defaultRepository",
                          event.target.value
                        )
                      }
                      disabled={
                        settingsLoading ||
                        settingsSaving
                      }
                    >
                      <option value="">
                        {t("No default repository")}
                      </option>

                      {repos
                        .filter(
                          (repository) =>
                            repository?.active !==
                            false
                        )
                        .map(
                          (repository) => (
                            <option
                              key={
                                repository.id
                              }
                              value={String(
                                repository.id
                              )}
                            >
                              {
                                repository.name
                              }
                            </option>
                          )
                        )}
                    </select>
                  </div>

                  <div className="settingRow">
                    <div>
                      <label>{t("Default delivery mode")}</label>
                    </div>

                    <select
                      value={
                        settingsPreferences.defaultDeliveryMode
                      }
                      onChange={(event) =>
                        updatePreference(
                          "defaultDeliveryMode",
                          event.target.value
                        )
                      }
                      disabled={
                        settingsLoading ||
                        settingsSaving
                      }
                    >
                      <option value="Live">{t("Live")}</option>
                      <option value="Dry run">{t("Dry run")}</option>
                      <option value="Preview">{t("Preview")}</option>
                    </select>
                  </div>

                  <div className="settingRow">
                    <div>
                      <label>{t("Items per page")}</label>
                    </div>

                    <select
                      value={
                        settingsPreferences.itemsPerPage
                      }
                      onChange={(event) =>
                        updatePreference(
                          "itemsPerPage",
                          Number(
                            event.target.value
                          )
                        )
                      }
                      disabled={
                        settingsLoading ||
                        settingsSaving
                      }
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <div className="settingRow toggleRow">
                    <div>
                      <label>{t("Confirm before delivery")}</label>
                      <small>{t("Show confirmation before running delivery.")}</small>
                    </div>

                    <button
                      type="button"
                      className={
                        settingsPreferences.confirmBeforeDelivery
                          ? "switchButton on"
                          : "switchButton"
                      }
                      onClick={() =>
                        updatePreference(
                          "confirmBeforeDelivery",
                          !settingsPreferences.confirmBeforeDelivery
                        )
                      }
                      disabled={
                        settingsLoading ||
                        settingsSaving
                      }
                    >
                      <span />
                    </button>
                  </div>

                  <div className="settingRow toggleRow">
                    <div>
                      <label>{t("Auto-refresh dashboard")}</label>
                      <small>{t("Automatically refresh dashboard data.")}</small>
                    </div>

                    <button
                      type="button"
                      className={
                        settingsPreferences.autoRefreshDashboard
                          ? "switchButton on"
                          : "switchButton"
                      }
                      onClick={() =>
                        updatePreference(
                          "autoRefreshDashboard",
                          !settingsPreferences.autoRefreshDashboard
                        )
                      }
                      disabled={
                        settingsLoading ||
                        settingsSaving
                      }
                    >
                      <span />
                    </button>
                  </div>

                  <div className="settingRow">
                    <div>
                      <label>{t("Auto-refresh interval")}</label>
                    </div>

                    <select
                      value={
                        settingsPreferences.autoRefreshInterval
                      }
                      onChange={(event) =>
                        updatePreference(
                          "autoRefreshInterval",
                          Number(
                            event.target.value
                          )
                        )
                      }
                      disabled={
                        settingsLoading ||
                        settingsSaving
                      }
                    >
                      <option value={5}>{t("5 minutes")}</option>
                      <option value={10}>{t("10 minutes")}</option>
                      <option value={30}>{t("30 minutes")}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="settingsGridTwo">
              <div className="settingsCard">
                <div className="settingsCardHeader">
                  <div className="settingsCardIcon">
                    <Bell size={16} />
                  </div>

                  <div>
                    <h3>{t("Notifications")}</h3>
                    <p>{t("Manage notifications and alert preferences.")}</p>
                  </div>
                </div>

                <div className="settingsFieldList">
                  {[
                    [
                      "successfulDeliveries",
                      "Successful deliveries",
                      "Receive notifications for successful deliveries.",
                    ],
                    [
                      "failedDeliveries",
                      "Failed deliveries",
                      "Receive notifications for failed deliveries.",
                    ],
                    [
                      "dryRunCompletions",
                      "Dry-run completions",
                      "Receive notifications for dry-run completions.",
                    ],
                    [
                      "repositoryConnectionFailures",
                      "Repository connection failures",
                      "Receive notifications for repository connection failures.",
                    ],
                  ].map(([key, label, description]) => (
                    <div
                      className="settingRow toggleRow"
                      key={key}
                    >
                      <div>
                        <label>{t(label)}</label>

                        <small>
                          {t(description)}
                        </small>
                      </div>

                      <button
                        type="button"
                        className={
                          settingsPreferences.notifications[key]
                            ? "switchButton on"
                            : "switchButton"
                        }
                        onClick={() =>
                          updateNotificationPreference(
                            key,
                            !settingsPreferences.notifications[key]
                          )
                        }
                        disabled={
                          settingsLoading ||
                          settingsSaving
                        }
                      >
                        <span />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="settingsFieldBlock compactBlock">
                  <label>{t("Notification email recipients")}</label>
                  <p>{t("Email addresses separated by commas.")}</p>

                  <input
                    type="text"
                    className="textInput"
                    value={
                      notificationRecipientsInput
                    }
                    onChange={(event) =>
                      setNotificationRecipientsInput(
                        event.target.value
                      )
                    }
                    placeholder={t("admin@example.com, ops@example.com")}
                    disabled={
                      settingsLoading ||
                      settingsSaving
                    }
                    aria-label={t("Notification email recipients")}
                  />
                </div>
              </div>

              <div className="settingsCard">
                <div className="settingsCardHeader">
                  <div className="settingsCardIcon">
                    <ShieldCheck size={16} />
                  </div>

                  <div>
                    <h3>{t("Security & session")}</h3>
                    <p>{t("Session and security information.")}</p>
                  </div>
                </div>

                <div className="settingsFieldList">
                  <div className="securityRow">
                    <span>{t("Current session")}</span>
                    <strong className="statusBadge active">
                      {t("Active")}
                    </strong>
                  </div>

                  <div className="securityRow">
                    <span>{t("Session timeout")}</span>
                    <strong>{t("30 minutes")}</strong>
                  </div>

                  <div className="securityRow">
                    <span>{t("Last login")}</span>
                    <strong>{t("May 1, 2024 • 10:42 AM")}</strong>
                  </div>

                  <button
                    type="button"
                    className="dangerLinkButton"
                    onClick={
                      signOutAllSessions
                    }
                    disabled={
                      busy ||
                      settingsSaving
                    }
                  >
                    <LogOut size={14} />
                    {t("Sign out all sessions")}
                  </button>
                </div>

                <div className="settingsSystemInfo">
                  <div className="settingsInfoRow">
                    <span>{t("Application version")}</span>
                    <strong>v1.0.0</strong>
                  </div>

                  <div className="settingsInfoRow">
                    <span>{t("API status")}</span>
                    <strong className="statusBadge error">
                      {t("Connected")}
                    </strong>
                  </div>

                  <div className="settingsInfoRow">
                    <span>{t("Database status")}</span>
                    <strong className="statusBadge success">
                      {t("Connected")}
                    </strong>
                  </div>

                  <div className="settingsInfoRow">
                    <span>{t("Last synchronization")}</span>
                    <strong>{t("2 minutes ago")}</strong>
                  </div>

                  <div className="settingsInfoRow">
                    <span>{t("Environment")}</span>
                    <strong>{t("Development")}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="settingsFooter">
              <button
                type="button"
                className="secondaryActionButton"
                onClick={
                  resetSettings
                }
                disabled={
                  settingsSaving ||
                  settingsLoading
                }
              >
                <RefreshCw size={14} />
                {t("Reset to defaults")}
              </button>

              <div className="settingsFooterActions">
                <button
                  type="button"
                  className="secondaryActionButton"
                  onClick={
                    discardSettings
                  }
                  disabled={
                    settingsSaving ||
                    settingsLoading ||
                    !settingsLoaded
                  }
                >
                  {t("Discard changes")}
                </button>

                <button
                  type="button"
                  className="primaryActionButton"
                  onClick={
                    saveSettings
                  }
                  disabled={
                    settingsSaving ||
                    settingsLoading ||
                    !settingsLoaded
                  }
                >
                  <Save size={14} />
                  {settingsSaving
                    ? t("Saving...")
                    : t("Save changes")}
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ======================================================
          USER MANAGEMENT MODAL
      ======================================================= */}

      {userFormOpen &&
        isAdmin && (
          <UserManagementModal
            form={
              userForm
            }
            editing={
              Boolean(
                editingManagedUser
              )
            }
            currentUserId={
              authUser?.id
            }
            busy={busy}
            onChange={
              updateUserField
            }
            onClose={
              closeUserForm
            }
            onSubmit={
              saveManagedUser
            }
          />
        )}

      {/* ======================================================
          MY PROFILE MODAL
      ======================================================= */}

      {profileFormOpen && (
        <ProfileModal
          form={
            profileForm
          }
          busy={busy}
          onChange={
            updateProfileField
          }
          onClose={
            closeProfileEdit
          }
          onSubmit={
            saveMyProfile
          }
        />
      )}

      {/* ======================================================
          REPOSITORY MODAL
      ======================================================= */}

      {showRepositoryForm && (
        <RepositoryModal
          form={
            repositoryForm
          }
          editing={
            Boolean(
              editingRepository
            )
          }
          busy={busy}
          connectionResult={
            connectionResult
          }
          onChange={
            updateRepositoryField
          }
          onClose={
            closeRepositoryForm
          }
          onSubmit={
            saveRepository
          }
          onTestConnection={
            testFormConnection
          }
          branches={
            branches
          }
          branchesLoading={
            branchesLoading
          }
          branchesError={
            branchesError
          }
          onFetchBranches={() =>
            fetchRepositoryBranches(
              editingRepository
            )
          }
          onAddTarget={
            addTarget
          }
          onRemoveTarget={
            removeTarget
          }
          onUpdateTarget={
            updateTarget
          }
          onAddRecipient={
            addRecipient
          }
          onRemoveRecipient={
            removeRecipient
          }
          onUpdateRecipient={
            updateRecipient
          }
        />
      )}

      {/* ======================================================
          DELIVERY HISTORY DETAIL
      ======================================================= */}

      {selectedDeliveryJob && (
        <DeliveryResultModal
          result={
            selectedDeliveryJob
          }
          onClose={() =>
            setSelectedDeliveryJob(
              null
            )
          }
          onHistory={() => {
            setSelectedDeliveryJob(
              null
            );

            setPage(
              "Delivery History"
            );
          }}
        />
      )}

      {/* ======================================================
          AUDIT LOG DETAIL
      ======================================================= */}

      {selectedAuditLog && (
        <AuditLogDetailModal
          log={
            selectedAuditLog
          }
          onClose={() =>
            setSelectedAuditLog(
              null
            )
          }
        />
      )}

      {/* ======================================================
          DELIVERY RESULT
      ======================================================= */}

      {deliveryResult && (
        <DeliveryResultModal
          result={
            deliveryResult
          }
          onClose={() =>
            setDeliveryResult(
              null
            )
          }
          onHistory={() => {
            setDeliveryResult(
              null
            );

            setPage(
              "Delivery History"
            );
          }}
        />
      )}
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
  if (!log) {
    return null;
  }

  const entries = [
    ["ID", log.id],
    [
      "User",
      log.user_name ||
        log.username ||
        log.user ||
        "—",
    ],
    [
      "Action",
      log.action ||
        "—",
    ],
    [
      "Resource",
      log.resource ||
        "—",
    ],
    [
      "IP Address",
      log.ip_address ||
        log.ip ||
        "—",
    ],
    [
      "Timestamp",
      log.created_at
        ? new Date(
            log.created_at
          ).toLocaleString()
        : log.timestamp
        ? new Date(
            log.timestamp
          ).toLocaleString()
        : "—",
    ],
  ];

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("Audit log details")}
    >
      <div className="modal">
        <div className="modalHeader">
          <div>
            <div className="eyebrow">
              {t("SECURITY")}
            </div>

            <h2>
              {t("Audit log details")}
            </h2>

            <span>
              {t("Review the selected security event.")}
            </span>
          </div>

          <button
            type="button"
            className="iconButton"
            onClick={
              onClose
            }
            aria-label={t("Close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings">
          {entries.map(
            ([label, value]) => (
              <SettingField
                key={label}
                label={label}
                value={
                  value == null
                    ? "—"
                    : String(
                        value
                      )
                }
              />
            )
          )}
        </div>

        {(log.details ||
          log.metadata ||
          log.message) && (
          <div
            style={{
              marginTop:
                "18px",
              padding:
                "14px",
              border:
                "1px solid #e2e8f0",
              borderRadius:
                "10px",
              background:
                "#f8fafc",
            }}
          >
            <b>
              {t("Details")}
            </b>

            <pre
              style={{
                marginTop:
                  "10px",
                whiteSpace:
                  "pre-wrap",
                wordBreak:
                  "break-word",
                fontSize:
                  "12px",
                color:
                  "#475569",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              {typeof (
                log.details ||
                log.metadata ||
                log.message
              ) === "string"
                ? log.details ||
                  log.metadata ||
                  log.message
                : JSON.stringify(
                    log.details ||
                      log.metadata ||
                      log.message,
                    null,
                    2
                  )}
            </pre>
          </div>
        )}

        <div className="modalFooter">
          <button
            type="button"
            className="ghost"
            onClick={
              onClose
            }
          >{t("Close")}</button>
        </div>
      </div>
    </div>
  );
}

export default App;