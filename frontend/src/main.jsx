import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
} from "lucide-react";
import "./styles.css";

const API = "http://127.0.0.1:8000/api";

const EMPTY_REPOSITORY = {
  name: "",
  description: "",
  repository_type: "GITHUB",
  repository_url: "",
  local_path: "",
  branch: "main",
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

function App() {
  const [page, setPage] = useState("Dashboard");

  const [data, setData] = useState(null);
  const [repos, setRepos] = useState([]);
  const [jobs, setJobs] = useState([]);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [showRepositoryForm, setShowRepositoryForm] =
    useState(false);

  const [editingRepository, setEditingRepository] =
    useState(null);

  const [repositoryForm, setRepositoryForm] =
    useState(EMPTY_REPOSITORY);

  const [selectedRepositoryId, setSelectedRepositoryId] =
    useState("");

  const [deliveryResult, setDeliveryResult] =
    useState(null);

  const [connectionResult, setConnectionResult] =
    useState(null);

  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState("");

  const selectedRepository = useMemo(() => {
    return (
      repos.find(
        (repo) =>
          String(repo.id) ===
          String(selectedRepositoryId)
      ) || null
    );
  }, [repos, selectedRepositoryId]);

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const load = async () => {
    const [
      dashboardResponse,
      repositoriesResponse,
      jobsResponse,
    ] = await Promise.all([
      fetch(`${API}/dashboard/`),
      fetch(`${API}/repositories/`),
      fetch(`${API}/jobs/`),
    ]);

    if (!dashboardResponse.ok) {
      throw new Error(
        "Failed to load dashboard data."
      );
    }

    if (!repositoriesResponse.ok) {
      throw new Error(
        "Failed to load repositories."
      );
    }

    if (!jobsResponse.ok) {
      throw new Error(
        "Failed to load delivery jobs."
      );
    }

    const dashboard =
      await dashboardResponse.json();

    const repositories =
      await repositoriesResponse.json();

    const deliveryJobs =
      await jobsResponse.json();

    setData(dashboard);
    setRepos(repositories);
    setJobs(deliveryJobs);

    if (
      repositories.length > 0 &&
      !repositories.some(
        (repo) =>
          String(repo.id) ===
          String(selectedRepositoryId)
      )
    ) {
      setSelectedRepositoryId(
        String(repositories[0].id)
      );
    }
  };

  useEffect(() => {
    load().catch((error) => {
      setNotice(
        error.message ||
          "Backend is not running. Start Django on port 8000."
      );
    });
  }, []);

  // ==========================================================
  // REPOSITORY FORM
  // ==========================================================

  const openAddRepository = () => {
    setEditingRepository(null);

    setRepositoryForm({
      ...EMPTY_REPOSITORY,
      extensions: [".log", ".txt"],
      recipients: [],
    });

    setConnectionResult(null);
    setShowRepositoryForm(true);
    setNotice("");
  };

  const openEditRepository = (repository) => {
    setEditingRepository(repository);

    setRepositoryForm({
      name: repository.name || "",
      description: repository.description || "",

      repository_type:
        repository.repository_type ||
        "GITHUB",

      repository_url:
        repository.repository_url || "",

      local_path:
        repository.local_path || "",

      branch:
        repository.branch || "main",

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
        repository.recipients || [],

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
        repository.authentication_configured ?? false,


      active:
        repository.active ?? true,
    });

    setConnectionResult(null);
    setBranches([]);
    setBranchesError("");
    setShowRepositoryForm(true);
    setNotice("");

    if (repository.repository_type !== "LOCAL") {
      fetch(`${API}/repositories/${repository.id}/branches/`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) {
            throw new Error(
              getApiError(result) ||
                result.message ||
                "Unable to fetch repository branches."
            );
          }
          return result;
        })
        .then((result) => {
          const fetchedBranches = Array.isArray(result.branches)
            ? result.branches
            : [];
          setBranches(fetchedBranches);
          if (fetchedBranches.length > 0) {
            const currentBranch =
              result.current_branch ||
              repository.branch ||
              fetchedBranches[0];
            const selectedBranch = fetchedBranches.includes(currentBranch)
              ? currentBranch
              : fetchedBranches[0];
            setRepositoryForm((previous) => ({
              ...previous,
              branch: selectedBranch,
            }));
          }
        })
        .catch((error) => {
          setBranches([]);
          setBranchesError(
            error.message ||
              "Unable to fetch repository branches."
          );
        });
    }
  };

  const closeRepositoryForm = () => {
    if (busy) {
      return;
    }

    setShowRepositoryForm(false);
    setEditingRepository(null);
    setConnectionResult(null);
    setBranches([]);
    setBranchesError("");
    setRepositoryForm(EMPTY_REPOSITORY);
  };

  const updateRepositoryField = (
    field,
    value
  ) => {
    setRepositoryForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // ==========================================================
  // SAVE REPOSITORY
  // ==========================================================

  const saveRepository = async (
    event
  ) => {
    event.preventDefault();

    setBusy(true);
    setNotice("");
    setConnectionResult(null);

    try {
      const extensions =
        Array.isArray(
          repositoryForm.extensions
        )
          ? repositoryForm.extensions
          : repositoryForm.extensions
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean);

      const recipients =
        Array.isArray(
          repositoryForm.recipients
        )
          ? repositoryForm.recipients
          : repositoryForm.recipients
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean);

      const payload = {
        ...repositoryForm,

        target_path:
          repositoryForm.target_path.trim(),

        extensions,

        recipients,
      };

      // ------------------------------------------------------
      // Repository authentication
      // ------------------------------------------------------
      if (repositoryForm.repository_type === "LOCAL") {
        payload.auth_type = "NONE";
        payload.username = "";
        delete payload.token;
        delete payload.access_token;
      } else if (repositoryForm.auth_type === "PAT") {
        const username = String(
          repositoryForm.username || ""
        ).trim();

        const token = String(
          repositoryForm.token || ""
        ).trim();

        if (!username) {
          throw new Error(
            "Git username is required for private repository authentication."
          );
        }

        if (!editingRepository && !token) {
          throw new Error(
            "Personal Access Token is required for a private repository."
          );
        }

        payload.auth_type = "PAT";
        payload.username = username;
        delete payload.token;

        // IMPORTANT: Django expects `access_token`, not `token`.
        // When editing, omit access_token if the PAT field is blank so
        // the backend keeps the existing encrypted credential.
        if (token) {
          payload.access_token = token;
        } else {
          delete payload.access_token;
        }
      } else {
        payload.auth_type = "NONE";
        payload.username = "";
        delete payload.token;
        delete payload.access_token;
      }

      const url = editingRepository
        ? `${API}/repositories/${editingRepository.id}/`
        : `${API}/repositories/`;

      const method = editingRepository
        ? "PATCH"
        : "POST";

      const response = await fetch(
        url,
        {
          method,
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
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
        editingRepository
          ? "Repository updated successfully."
          : "Repository added successfully."
      );

      setShowRepositoryForm(false);
      setEditingRepository(null);
      setRepositoryForm(
        EMPTY_REPOSITORY
      );

      await load();

      if (result.id) {
        setSelectedRepositoryId(
          String(result.id)
        );
      }
    } catch (error) {
      setNotice(
        error.message ||
          "Unable to save repository."
      );
    } finally {
      setBusy(false);
    }
  };

  // ==========================================================
  // FETCH REPOSITORY BRANCHES
  // ==========================================================

  const fetchRepositoryBranches = async (repository) => {
    if (!repository?.id) {
      return;
    }

    if (repository.repository_type === "LOCAL") {
      setBranches([]);
      setBranchesError("");
      return;
    }

    setBranchesLoading(true);
    setBranchesError("");

    try {
      const response = await fetch(
        `${API}/repositories/${repository.id}/branches/`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          getApiError(result) ||
            result.message ||
            "Unable to fetch repository branches."
        );
      }

      const fetchedBranches = Array.isArray(result.branches)
        ? result.branches
        : [];

      setBranches(fetchedBranches);

      if (fetchedBranches.length > 0) {
        const currentBranch =
          result.current_branch ||
          repository.branch ||
          fetchedBranches[0];

        const selectedBranch = fetchedBranches.includes(currentBranch)
          ? currentBranch
          : fetchedBranches[0];

        updateRepositoryField("branch", selectedBranch);
      }
    } catch (error) {
      setBranches([]);
      setBranchesError(
        error.message ||
          "Unable to fetch repository branches."
      );
    } finally {
      setBranchesLoading(false);
    }
  };

  // ==========================================================
  // TEST CONNECTION
  // ==========================================================

  const testConnection = async (
    repository
  ) => {
    if (!repository?.id) {
      return;
    }

    setBusy(true);
    setNotice("");
    setConnectionResult(null);

    try {
      const response =
        await fetch(
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
            "Repository connection failed."
        );
      }

      setConnectionResult({
        success: true,
        message:
          result.message ||
          "Repository connection successful.",
        details:
          result.details || null,
      });

      setNotice(
        `Repository connected successfully: ${repository.name}`
      );

      await load();
    } catch (error) {
      setConnectionResult({
        success: false,
        message:
          error.message ||
          "Repository connection failed.",
      });

      setNotice(
        error.message ||
          "Repository connection failed."
      );
    } finally {
      setBusy(false);
    }
  };

  // ==========================================================
  // TEST CONNECTION FROM FORM
  // ==========================================================

  const testFormConnection = async () => {
    if (!editingRepository) {
      setNotice(
        "Save the repository first, then test its connection."
      );
      return;
    }

    await testConnection(
      editingRepository
    );
  };

  // ==========================================================
  // DELETE / DEACTIVATE
  // ==========================================================

  const deleteRepository = async (
    repository
  ) => {
    const confirmed =
      window.confirm(
        `Deactivate "${repository.name}"?`
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const response =
        await fetch(
          `${API}/repositories/${repository.id}/`,
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

      setNotice(
        "Repository deactivated successfully."
      );

      if (
        String(
          selectedRepositoryId
        ) === String(repository.id)
      ) {
        setSelectedRepositoryId("");
      }

      await load();
    } catch (error) {
      setNotice(
        error.message ||
          "Unable to deactivate repository."
      );
    } finally {
      setBusy(false);
    }
  };

  // ==========================================================
  // DELIVERY
  // ==========================================================

  const runDelivery = async (
    dryRun = false
  ) => {
    if (!selectedRepositoryId) {
      setNotice(
        "Select a repository before starting delivery."
      );
      return;
    }

    setBusy(true);
    setNotice("");
    setDeliveryResult(null);

    try {
      const response =
        await fetch(
          `${API}/jobs/`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              repository_id:
                Number(
                  selectedRepositoryId
                ),

              dry_run: dryRun,
            }),
          }
        );

      const result =
        await response.json();

      setDeliveryResult({
        ...result,
        _success: response.ok,
        _dryRun: dryRun,
      });

      if (!response.ok) {
        throw new Error(
          getApiError(result)
        );
      }

      setNotice(
        dryRun
          ? "Dry run completed successfully."
          : "Delivery completed successfully."
      );

      await load();
    } catch (error) {
      setNotice(
        error.message ||
          "Delivery failed."
      );

      setDeliveryResult((previous) => {
        if (previous) {
          return previous;
        }

        return {
          _success: false,
          _dryRun: dryRun,
          error:
            error.message ||
            "Delivery failed.",
        };
      });
    } finally {
      setBusy(false);
    }
  };

  const stats = data?.stats || {
    total: 0,
    success: 0,
    failed: 0,
    dry_run: 0,
  };

  return (
    <div className="app">

      {/* ======================================================
          SIDEBAR
      ======================================================= */}

      <aside>
        <div className="logo">
          <div className="logoMark">
            LD
          </div>

          <div>
            <b>Log Delivery</b>
            <span>
              Management
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
            [
              "Settings",
              Settings,
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
                {name}
              </button>
            )
          )}
        </nav>

        <div className="sideBottom">
          <ShieldCheck size={18} />

          <div>
            <b>
              Secure mode
            </b>

            <span>
              Controlled delivery
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
              OPERATIONS CENTER
            </div>

            <h1>
              {page}
            </h1>

            <p>
              Collect application files from
              configured repositories and
              deliver them securely.
            </p>
          </div>

          <div className="actions">

            <button
              className="ghost"
              disabled={busy}
              onClick={() =>
                load().catch(
                  (error) =>
                    setNotice(
                      error.message
                    )
                )
              }
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              className="primary"
              disabled={
                busy ||
                !selectedRepositoryId
              }
              onClick={() =>
                runDelivery(false)
              }
            >
              <Send size={16} />

              {busy
                ? "Processing..."
                : "Run delivery"}
            </button>

          </div>
        </header>

        {notice && (
          <div className="notice">
            {notice}
          </div>
        )}

        {/* ======================================================
            DASHBOARD
        ======================================================= */}

        {page === "Dashboard" && (
          <>
            <section className="cards">

              <Card
                icon={Archive}
                label="Total jobs"
                value={stats.total}
              />

              <Card
                icon={CheckCircle2}
                label="Successful"
                value={stats.success}
                ok
              />

              <Card
                icon={XCircle}
                label="Failed"
                value={stats.failed}
                bad
              />

              <Card
                icon={Clock3}
                label="Dry runs"
                value={stats.dry_run}
              />

            </section>

            <section className="grid">

              <div className="panel wide">

                <div className="panelHead">

                  <div>
                    <h2>
                      Recent deliveries
                    </h2>

                    <span>
                      Latest execution activity
                    </span>
                  </div>

                  <button
                    className="link"
                    onClick={() =>
                      setPage(
                        "Delivery History"
                      )
                    }
                  >
                    View history
                  </button>

                </div>

                <JobTable
                  jobs={
                    data?.recent || []
                  }
                />

              </div>

              <div className="panel">

                <div className="panelHead">

                  <div>
                    <h2>
                      Active repository
                    </h2>

                    <span>
                      Current delivery source
                    </span>
                  </div>

                  <button
                    className="link"
                    onClick={() =>
                      setPage(
                        "Repositories"
                      )
                    }
                  >
                    Manage
                  </button>

                </div>

                {selectedRepository ? (
                  <RepositorySummary
                    repository={
                      selectedRepository
                    }
                  />
                ) : (
                  <div className="empty">
                    No repository configured.
                  </div>
                )}

              </div>

            </section>
          </>
        )}

        {/* ======================================================
            DELIVERY HISTORY
        ======================================================= */}

        {page === "Delivery History" && (
          <section className="panel full">

            <div className="panelHead">

              <div>
                <h2>
                  Delivery history
                </h2>

                <span>
                  Auditable record of every
                  execution
                </span>
              </div>

              <button
                className="primary small"
                disabled={
                  busy ||
                  !selectedRepositoryId
                }
                onClick={() =>
                  runDelivery(true)
                }
              >
                <Clock3 size={15} />
                Dry run
              </button>

            </div>

            <JobTable
              jobs={jobs}
            />

          </section>
        )}

        {/* ======================================================
            REPOSITORIES
        ======================================================= */}

        {page === "Repositories" && (
          <section className="panel full">

            <div className="panelHead">

              <div>
                <div className="eyebrow">
                  SOURCE MANAGEMENT
                </div>

                <h2>
                  Repositories
                </h2>

                <span>
                  Configure Git repositories,
                  targets and delivery
                  recipients.
                </span>
              </div>

              <button
                className="primary small"
                onClick={
                  openAddRepository
                }
                disabled={busy}
              >
                <Plus size={16} />
                Add repository
              </button>

            </div>

            {repos.length > 0 && (
              <div className="deliverySelector">

                <div>
                  <b>
                    Delivery target
                  </b>

                  <span>
                    Choose the repository
                    you want to process.
                  </span>
                </div>

                <select
                  value={
                    selectedRepositoryId
                  }
                  onChange={(event) =>
                    setSelectedRepositoryId(
                      event.target.value
                    )
                  }
                >
                  {repos.map(
                    (repo) => (
                      <option
                        key={repo.id}
                        value={repo.id}
                      >
                        {repo.name}
                      </option>
                    )
                  )}
                </select>

              </div>
            )}

            {repos.length === 0 ? (
              <div className="empty">

                <GitBranch
                  size={38}
                />

                <b>
                  No repositories configured
                </b>

                <span>
                  Add your first repository
                  to begin collecting files.
                </span>

                <button
                  className="primary small"
                  onClick={
                    openAddRepository
                  }
                >
                  <Plus size={15} />
                  Add repository
                </button>

              </div>
            ) : (
              <div className="repositoryList">

                {repos.map(
                  (repository) => (
                    <RepositoryCard
                      key={repository.id}
                      repository={
                        repository
                      }
                      busy={busy}
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
                    />
                  )
                )}

              </div>
            )}

          </section>
        )}

        {/* ======================================================
            SETTINGS
        ======================================================= */}

        {page === "Settings" && (
          <section className="panel full">

            <div className="panelHead">

              <div>
                <h2>
                  System settings
                </h2>

                <span>
                  Current application configuration
                </span>
              </div>

            </div>

            <div className="settings">

              <SettingField
                label="Application"
                value="Log Delivery Management"
              />

              <SettingField
                label="Backend"
                value="Django REST API"
              />

              <SettingField
                label="Repositories"
                value={String(
                  repos.length
                )}
              />

              <SettingField
                label="Email mode"
                value={
                  selectedRepository
                    ?.email_mode ||
                  "SMTP"
                }
              />

              <SettingField
                label="Target"
                value={
                  selectedRepository
                    ?.target_path ||
                  "Not configured"
                }
              />

              <SettingField
                label="Security"
                value="Sensitive-file filtering enabled"
              />

            </div>

          </section>
        )}

      </main>

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
          branches={branches}
          branchesLoading={branchesLoading}
          branchesError={branchesError}
          onFetchBranches={() =>
            fetchRepositoryBranches(editingRepository)
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
            setDeliveryResult(null)
          }
          onHistory={() => {
            setDeliveryResult(null);
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
}) {
  const isLocal =
    form.repository_type ===
    "LOCAL";

  return (
    <div className="modalOverlay">

      <div className="modal">

        <div className="modalHeader">

          <div>
            <div className="eyebrow">
              REPOSITORY CONFIGURATION
            </div>

            <h2>
              {editing
                ? "Edit repository"
                : "Add repository"}
            </h2>

            <span>
              Configure the source, target
              and delivery destination.
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
            <GitBranch size={16} />
            Repository source
          </div>

          <div className="formGrid">

            <FormInput
              label="Repository name"
              value={form.name}
              onChange={(value) =>
                onChange(
                  "name",
                  value
                )
              }
              placeholder="SR Finance"
              required
            />

            <FormInput
              label="Description"
              value={
                form.description
              }
              onChange={(value) =>
                onChange(
                  "description",
                  value
                )
              }
              placeholder="Application log delivery source"
            />

            <div className="formField">

              <label>
                Repository type
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
                  GitHub
                </option>

                <option value="GITLAB">
                  GitLab
                </option>

                <option value="AZURE_DEVOPS">
                  Azure DevOps
                </option>

                <option value="INTERNAL_GIT">
                  Internal Git
                </option>

                <option value="LOCAL">
                  Local Git
                </option>
              </select>

            </div>

            {isLocal ? (
              <FormInput
                label="Local repository path"
                value={
                  form.local_path
                }
                onChange={(value) =>
                  onChange(
                    "local_path",
                    value
                  )
                }
                placeholder="C:\Projects\MyApplication"
                required
              />
            ) : (
              <FormInput
                label="Repository URL"
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
                label="Branch"
                value={form.branch}
                onChange={(value) =>
                  onChange("branch", value)
                }
                placeholder="main"
                required
              />
            ) : (
              <div className="formField">
                <label>Branch</label>

                <div style={{ display: "flex", gap: "8px" }}>
                  <select
                    value={form.branch || ""}
                    onChange={(event) =>
                      onChange("branch", event.target.value)
                    }
                    disabled={branchesLoading}
                    style={{ flex: 1 }}
                    required
                  >
                    {branches.length === 0 && (
                      <option value={form.branch || "main"}>
                        {form.branch || "main"}
                      </option>
                    )}

                    {branches.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="ghost small"
                    onClick={onFetchBranches}
                    disabled={
                      busy ||
                      !editing ||
                      branchesLoading
                    }
                    title={
                      !editing
                        ? "Save the repository first."
                        : "Fetch branches from the repository"
                    }
                  >
                    <GitBranch size={14} />
                    {branchesLoading ? "Loading..." : "Fetch"}
                  </button>
                </div>

                {branchesError && (
                  <span style={{ color: "#c0392b", marginTop: "6px" }}>
                    {branchesError}
                  </span>
                )}

                {!branchesLoading &&
                  !branchesError &&
                  branches.length === 0 &&
                  editing && (
                    <span style={{ marginTop: "6px" }}>
                      Click Fetch to load all branches from this repository.
                    </span>
                  )}
              </div>
            )}

          </div>

          {!isLocal && (
            <>
              <div className="formSectionTitle">
                <ShieldCheck size={16} />
                Repository authentication
              </div>

              <div className="formField">
                <label>Authentication</label>
                <select
                  value={form.auth_type || "NONE"}
                  onChange={(event) => {
                    const value = event.target.value;
                    onChange("auth_type", value);
                    if (value === "NONE") {
                      onChange("username", "");
                      onChange("token", "");
                    }
                  }}
                >
                  <option value="NONE">
                    Public repository — No authentication
                  </option>
                  <option value="PAT">
                    Private repository — Personal Access Token
                  </option>
                </select>
              </div>

              {form.auth_type === "PAT" && (
                <div className="formGrid">
                  <FormInput
                    label="Git username"
                    value={form.username || ""}
                    onChange={(value) => onChange("username", value)}
                    placeholder="github-username"
                    required
                  />

                  <div className="formField">
                    <label>Personal Access Token</label>
                    <input
                      type="password"
                      value={form.token || ""}
                      onChange={(event) =>
                        onChange("token", event.target.value)
                      }
                      placeholder={
                        form.authentication_configured
                          ? "Enter a new token only if changing it"
                          : "ghp_xxxxxxxxxxxxxxxxxxxx"
                      }
                      required={!editing}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="smtpNotice">
                    <ShieldCheck size={16} />
                    <span>
                      {form.authentication_configured
                        ? "Authentication is already configured. Leave the token blank to keep the existing credential."
                        : "The token is sent only to Django for secure storage. Never put a PAT in the repository URL."}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="formSectionTitle">
            <Target size={16} />
            Target selection
          </div>

          <div className="targetHint">
            Enter a file or directory relative
            to the repository root.
            Examples: <b>build.sh</b>,
            <b>logs</b>,
            <b>logs/application.log</b>
          </div>

          <div className="formGrid">

            <FormInput
              label="Target file / folder"
              value={
                form.target_path
              }
              onChange={(value) =>
                onChange(
                  "target_path",
                  value
                )
              }
              placeholder="build.sh"
              required
            />

            <FormInput
              label="Allowed extensions"
              value={
                Array.isArray(
                  form.extensions
                )
                  ? form.extensions.join(
                      ", "
                    )
                  : form.extensions
              }
              onChange={(value) =>
                onChange(
                  "extensions",
                  value
                )
              }
              placeholder=".log, .txt, .json"
            />

          </div>

          <div className="formSectionTitle">
            <Mail size={16} />
            Delivery configuration
          </div>

          <div className="formGrid">

            <FormInput
              label="Recipients"
              value={
                Array.isArray(
                  form.recipients
                )
                  ? form.recipients.join(
                      ", "
                    )
                  : form.recipients
              }
              onChange={(value) =>
                onChange(
                  "recipients",
                  value
                )
              }
              placeholder="devops@company.com, support@company.com"
              required
            />

            <div className="formField">

              <label>
                Email mode
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
                  SMTP — Real delivery
                </option>

                <option value="SIMULATION">
                  Simulation — No email
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
                SMTP delivery is enabled.
                The configured archive will
                be sent to the recipients
                after a successful run.
              </span>
            </div>
          )}

          {/* CONNECTION RESULT */}

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

                {connectionResult
                  .details && (
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

          <div className="modalFooter">

            <button
              type="button"
              className="ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>

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
              title={
                !editing
                  ? "Save the repository first."
                  : "Test repository connection"
              }
            >
              <Wifi size={15} />
              Test connection
            </button>

            <button
              type="submit"
              className="primary"
              disabled={busy}
            >
              <Save size={16} />

              {busy
                ? "Saving..."
                : editing
                ? "Save changes"
                : "Save repository"}
            </button>

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
  selected,
  onSelect,
  onEdit,
  onTest,
  onDelete,
}) {
  const status =
    repository.connection_status ||
    "UNKNOWN";

  const statusClass =
    status === "CONNECTED"
      ? "connected"
      : status === "FAILED"
      ? "failed"
      : "unknown";

  const source =
    repository.repository_type ===
    "LOCAL"
      ? repository.local_path
      : repository.repository_url;

  return (
    <div
      className={`repoCard ${
        selected
          ? "selected"
          : ""
      }`}
    >

      <div className="repoCardMain">

        <div className="repoIcon">
          <FolderGit2
            size={22}
          />
        </div>

        <div className="repoInfo">

          <div className="repoTitle">

            <b>
              {repository.name}
            </b>

            {selected && (
              <span className="selectedBadge">
                Selected
              </span>
            )}

          </div>

          {repository.description && (
            <p>
              {
                repository.description
              }
            </p>
          )}

          <span className="repoPath">
            {source || "Source not configured"}
          </span>

        </div>

      </div>

      <div className="repoMeta">

        <span>
          <GitBranch
            size={14}
          />
          {repository.branch}
        </span>

        <span>
          <Target size={14} />
          {repository.target_path ||
            repository.log_directory ||
            "Not configured"}
        </span>

        <span>
          <Server size={14} />
          {
            repository.repository_type
          }
        </span>

        <span>
          <Mail size={14} />
          {
            repository.email_mode
          }
        </span>

        <span>
          <ShieldCheck
            size={14}
          />

          {repository.authentication_configured
            ? "PAT"
            : "PUBLIC"}
        </span>

        <span
          className={`connectionBadge ${statusClass}`}
        >
          {status ===
          "CONNECTED" ? (
            <CheckCircle2
              size={14}
            />
          ) : status ===
            "FAILED" ? (
            <XCircle
              size={14}
            />
          ) : (
            <Clock3
              size={14}
            />
          )}

          {status}
        </span>

      </div>

      <div className="repoActions">

        <button
          className="ghost small"
          disabled={busy}
          onClick={onSelect}
        >
          {selected
            ? "Selected"
            : "Use repository"}
        </button>

        <button
          className="ghost small"
          disabled={busy}
          onClick={() =>
            onTest(repository)
          }
        >
          <Wifi size={14} />
          Test
        </button>

        <button
          className="ghost small"
          disabled={busy}
          onClick={() =>
            onEdit(repository)
          }
        >
          <Pencil size={14} />
          Edit
        </button>

        <button
          className="danger small"
          disabled={busy}
          onClick={() =>
            onDelete(repository)
          }
        >
          <Trash2 size={14} />
          Deactivate
        </button>

      </div>

    </div>
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
          Type
        </span>

        <b>
          {
            repository.repository_type
          }
        </b>
      </div>

      <div className="repoRow">
        <span>
          Branch
        </span>

        <b>
          {repository.branch}
        </b>
      </div>

      <div className="repoRow">
        <span>
          Target
        </span>

        <b>
          {repository.target_path ||
            repository.log_directory ||
            "Not configured"}
        </b>
      </div>

      <div className="repoRow">
        <span>
          Connection
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
          {
            repository.connection_status ||
            "UNKNOWN"
          }
        </b>
      </div>

      <div className="repoRow">
        <span>
          Authentication
        </span>

        <b
          className={
            repository.authentication_configured
              ? "green"
              : ""
          }
        >
          {repository.authentication_configured
            ? `PAT${repository.username ? ` · ${repository.username}` : ""}`
            : "NONE"}
        </b>
      </div>

      <div className="repoRow">
        <span>
          Email
        </span>

        <b className="green">
          {
            repository.email_mode
          }
        </b>
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
  const success =
    result._success === true;

  const dryRun =
    result.is_dry_run ??
    result._dryRun ??
    false;

  const status =
    result.status ||
    (success
      ? "SUCCESS"
      : "FAILED");

  const statusLabel =
    status === "DRY_RUN"
      ? "Dry run completed"
      : success
      ? "Delivery completed"
      : "Delivery failed";

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
              <CheckCircle2
                size={25}
              />
            ) : (
              <XCircle
                size={25}
              />
            )}
          </div>

          <div className="resultHeaderText">

            <div className="eyebrow">
              DELIVERY EXECUTION
            </div>

            <h2>
              {statusLabel}
            </h2>

            <span>
              {dryRun
                ? "Files were validated without creating or sending an archive."
                : success
                ? "Archive created and delivery completed."
                : "The delivery job failed. Review the error below."}
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
              Job reference
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
                  Execution error
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
            label="Repository"
            value={
              result.repository_name ||
              "Repository"
            }
          />

          <ResultItem
            icon={Server}
            label="Repository type"
            value={
              result.repository_type ||
              "LOCAL"
            }
          />

          <ResultItem
            icon={GitCommit}
            label="Commit"
            value={
              result.commit || "—"
            }
            mono
          />

          <ResultItem
            icon={Target}
            label="Target"
            value={
              result.target?.path ||
              "Configured target"
            }
          />

          <ResultItem
            icon={FileText}
            label="Files collected"
            value={
              result.files_count ??
              0
            }
          />

          <ResultItem
            icon={Timer}
            label="Duration"
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
            label="Archive"
            value={
              result.archive_name ||
              "Not created"
            }
          />

          <ResultItem
            icon={Archive}
            label="Archive size"
            value={
              result.archive_size
                ? formatBytes(
                    result.archive_size
                  )
                : dryRun
                ? "0 bytes"
                : "—"
            }
          />

          <ResultItem
            icon={Mail}
            label="Email mode"
            value={
              result.email_mode ||
              (dryRun
                ? "SIMULATION"
                : "SMTP")
            }
          />

        </div>

        {result.recipients?.length >
          0 && (
          <div className="recipientsBlock">

            <div className="recipientTitle">

              <Mail size={15} />

              <b>
                Recipients
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
            Close
          </button>

          <button
            className="primary"
            onClick={onHistory}
          >
            <Eye size={15} />
            View delivery history
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
        No delivery jobs yet.
        Run a delivery to create
        the first record.
      </div>
    );
  }

  return (
    <div className="table">

      <div className="tr th">

        <span>
          Repository
        </span>

        <span>
          Status
        </span>

        <span>
          Files
        </span>

        <span>
          Archive
        </span>

        <span>
          Created
        </span>

      </div>

      {jobs.map(
        (job) => (
          <div
            className="tr"
            key={job.id}
          >

            <span>

              <b>
                {
                  job.repository_name ||
                  "Repository"
                }
              </b>

              <small>
                #
                {
                  job.job_reference ||
                  job.id
                }

                {" · "}

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
              {
                job.files_count
              }
            </span>

            <span>
              {
                job.archive_name ||
                "—"
              }
            </span>

            <span>
              {
                job.created_at
                  ? new Date(
                      job.created_at
                    ).toLocaleString()
                  : "—"
              }
            </span>

          </div>
        )
      )}

    </div>
  );
}


// ============================================================
// STATUS
// ============================================================

function Status({
  s,
}) {
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
      {displayStatus}
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
        {label}
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

      {label}

      <input
        value={value}
        readOnly
      />

    </label>
  );
}


// ============================================================
// BYTE FORMATTER
// ============================================================

function formatBytes(
  bytes
) {
  const value =
    Number(bytes);

  if (!value) {
    return "0 bytes";
  }

  const units = [
    "bytes",
    "KB",
    "MB",
    "GB",
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(value) /
          Math.log(1024)
      ),
      units.length - 1
    );

  return `${(
    value /
    Math.pow(
      1024,
      index
    )
  ).toFixed(
    index === 0
      ? 0
      : 2
  )} ${units[index]}`;
}


// ============================================================
// API ERROR
// ============================================================

function getApiError(
  response
) {
  if (!response) {
    return "An unexpected error occurred.";
  }

  if (
    typeof response ===
    "string"
  ) {
    return response;
  }

  if (response.error) {
    return response.error;
  }

  if (response.detail) {
    return response.detail;
  }

  const firstKey =
    Object.keys(
      response
    )[0];

  if (firstKey) {
    const value =
      response[firstKey];

    if (
      Array.isArray(value)
    ) {
      return `${firstKey}: ${value.join(
        ", "
      )}`;
    }

    if (
      typeof value ===
      "string"
    ) {
      return `${firstKey}: ${value}`;
    }

    if (
      value &&
      typeof value ===
        "object"
    ) {
      return `${firstKey}: ${Object.values(
        value
      )
        .flat()
        .join(", ")}`;
    }
  }

  return "Request failed.";
}


// ============================================================
// APP START
// ============================================================

createRoot(
  document.getElementById(
    "root"
  )
).render(
  <App />
);