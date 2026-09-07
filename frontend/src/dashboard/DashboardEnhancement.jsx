import React, { useMemo } from "react";
import {
  Activity,
  Archive,
  CheckCircle2,
  Clock3,
  FileText,
  GitBranch,
  Mail,
  Server,
  Timer,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { getCurrentLanguageCode, translateLegacy } from "../i18n";
import "./DashboardEnhancement.css";

const t = translateLegacy;
const getLocale = () => getCurrentLanguageCode();

/*
 * DashboardEnhancement
 * ------------------------------------------------------------
 * Presentation-only dashboard layer.
 *
 * Important:
 * - Existing API data is used as-is.
 * - No delivery/repository/auth functionality is changed here.
 * - Existing callbacks (history/repositories) are preserved.
 * - Unknown backend fields gracefully fall back to "—".
 */

const STATUS = Object.freeze({
  SUCCESS: "SUCCESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  FAILURE: "FAILURE",
  PENDING: "PENDING",
  DRY_RUN: "DRY_RUN",
});

const CONNECTED_STATES = new Set([
  "CONNECTED",
  "ACTIVE",
  "HEALTHY",
  "READY",
]);

const OFFLINE_STATES = new Set([
  "FAILED",
  "OFFLINE",
]);

const SUCCESS_STATES = new Set([
  STATUS.SUCCESS,
  STATUS.COMPLETED,
]);

const FAILED_STATES = new Set([
  STATUS.FAILED,
  STATUS.FAILURE,
]);

const WEEKDAY_FORMATTER = { weekday: "short" };
const TIME_FORMATTER = { hour: "2-digit", minute: "2-digit" };
const DATE_FORMATTER = { dateStyle: "medium", timeStyle: "short" };

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

const getStat = (stats, keys, fallback) => {
  for (const key of keys) {
    if (hasValue(stats?.[key])) {
      return toNumber(stats[key], fallback);
    }
  }

  return fallback;
};

const toDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getJobDateValue = (job) =>
  job?.created_at ??
  job?.started_at ??
  job?.completed_at ??
  job?.updated_at ??
  null;

const getJobStatus = (job) => {
  if (job?.success === true) return STATUS.SUCCESS;
  if (job?.success === false) return STATUS.FAILED;

  return String(job?.status ?? STATUS.PENDING).toUpperCase();
};

const isSuccessfulJob = (job) =>
  SUCCESS_STATES.has(getJobStatus(job));

const isFailedJob = (job) =>
  FAILED_STATES.has(getJobStatus(job));

const isDryRun = (job) =>
  job?.is_dry_run === true ||
  job?.dry_run === true ||
  getJobStatus(job) === STATUS.DRY_RUN;

const getRepositoryName = (job) =>
  job?.repository_name ??
  job?.repository?.name ??
  job?.repo_name ??
  (typeof job?.repository === "string" ? job.repository : null) ??
  "Delivery";

const getRepositoryConnectionState = (repository) =>
  String(
    repository?.connection_status ??
      repository?.status ??
      repository?.connection ??
      ""
  ).toUpperCase();

const getJobKey = (job, index) =>
  job?.id ??
  job?.job_id ??
  job?.job_reference ??
  `${getRepositoryName(job)}-${getJobDateValue(job) ?? index}`;

const formatTime = (value) => {
  const date = toDate(value);
  return date
    ? date.toLocaleTimeString(getLocale(), TIME_FORMATTER)
    : "—";
};

const formatDate = (value) => {
  const date = toDate(value);
  return date
    ? date.toLocaleString(getLocale(), DATE_FORMATTER)
    : "—";
};

const formatDuration = (job) => {
  const seconds = toNumber(
    job?.duration_seconds ?? job?.duration,
    NaN
  );

  if (!Number.isFinite(seconds)) return "—";

  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
};

const formatBytes = (value) => {
  const bytes = toNumber(value, NaN);

  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

const getRingStyle = (percentage, variable) => {
  const safePercentage = Math.min(
    100,
    Math.max(0, toNumber(percentage))
  );

  return {
    background: `conic-gradient(
      var(${variable}) 0 ${safePercentage}%,
      #ece8f3 ${safePercentage}% 100%
    )`,
  };
};

const getSevenDays = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    return {
      date,
      label: date.toLocaleDateString(
        getLocale(),
        WEEKDAY_FORMATTER
      ),
      success: 0,
      failed: 0,
    };
  });
};

const getLinePoints = (days, key, maxValue) =>
  days
    .map((day, index) => {
      const x = 12 + (index / 6) * 676;
      const value = Math.max(0, toNumber(day[key]));
      const y = 150 - (value / maxValue) * 105;

      return `${x},${y}`;
    })
    .join(" ");

const calculateHealth = (repositories) => {
  return repositories.reduce(
    (health, repository) => {
      const state = getRepositoryConnectionState(repository);

      if (CONNECTED_STATES.has(state)) {
        health.connected += 1;
      } else if (OFFLINE_STATES.has(state)) {
        health.offline += 1;
      } else {
        health.attention += 1;
      }

      return health;
    },
    {
      total: repositories.length,
      connected: 0,
      attention: 0,
      offline: 0,
    }
  );
};

const getCompletedCount = (jobs) =>
  jobs.reduce(
    (count, job) =>
      count + (isSuccessfulJob(job) || isFailedJob(job) ? 1 : 0),
    0
  );

const getSuccessfulCount = (jobs) =>
  jobs.reduce(
    (count, job) => count + (isSuccessfulJob(job) ? 1 : 0),
    0
  );

const getFailedCount = (jobs) =>
  jobs.reduce(
    (count, job) => count + (isFailedJob(job) ? 1 : 0),
    0
  );

const getDryRunCount = (jobs) =>
  jobs.reduce(
    (count, job) => count + (isDryRun(job) ? 1 : 0),
    0
  );

const KpiCard = ({
  icon: Icon,
  iconTone,
  label,
  value,
  description,
  children,
}) => (
  <article className="dashboard-kpi-card">
    <div className="dashboard-kpi-main">
      <div className={`dashboard-kpi-icon ${iconTone}`}>
        <Icon size={18} strokeWidth={2} />
      </div>

      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>

    {children}
  </article>
);

const MetricRing = ({ percentage, variable, label }) => (
  <div
    className="dashboard-ring"
    style={getRingStyle(percentage, variable)}
    role="img"
    aria-label={`${label}: ${percentage.toFixed(1)} percent`}
  >
    <span>{percentage.toFixed(1)}%</span>
  </div>
);

const MiniBars = () => (
  <div
    className="dashboard-mini-bars"
    aria-hidden="true"
  >
    {[20, 31, 25, 42, 34, 54].map((height, index) => (
      <i
        key={index}
        style={{ height: `${height}px` }}
      />
    ))}
  </div>
);

const TrendCard = ({
  title,
  summary,
  summaryLabel,
  icon: Icon,
  lineKey,
  days,
  maxValue,
  failure = false,
}) => {
  const points = getLinePoints(days, lineKey, maxValue);
  const areaPoints = `12,162 ${points} 688,162`;

  return (
    <article className="dashboard-panel dashboard-trend-panel">
      <div className="dashboard-panel-head">
        <div>
          <span className="dashboard-label">{t("RELIABILITY")}</span>
          <h2>{title}</h2>
          <p>{t("Last 7 days")}</p>
        </div>

        <Icon size={18} aria-hidden="true" />
      </div>

      <div className="dashboard-chart-summary">
        <strong>{summary}</strong>
        <span>{summaryLabel}</span>
      </div>

      <div className="dashboard-line-chart">
        <div className="dashboard-chart-y-labels" aria-hidden="true">
          <span>{maxValue}</span>
          <span>{Math.ceil(maxValue / 2)}</span>
          <span>0</span>
        </div>

        <div className="dashboard-chart-grid-line top" />
        <div className="dashboard-chart-grid-line middle" />
        <div className="dashboard-chart-grid-line bottom" />

        <svg
          className={`dashboard-line-svg${
            failure ? " failure" : ""
          }`}
          viewBox="0 0 700 180"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title} over the last seven days`}
        >
          <polygon
            className="dashboard-chart-area"
            points={areaPoints}
          />
          <polyline points={points} />
          {days.map((day, index) => {
            const x = 12 + (index / 6) * 676;
            const value = Math.max(
              0,
              toNumber(day[lineKey])
            );
            const y =
              150 - (value / maxValue) * 105;

            return (
              <circle
                key={day.date.getTime()}
                className="dashboard-chart-point"
                cx={x}
                cy={y}
                r="3.5"
              />
            );
          })}
        </svg>
      </div>

      <div className="dashboard-chart-axis">
        {days.map((day) => (
          <span key={day.date.getTime()}>
            {day.label}
          </span>
        ))}
      </div>
    </article>
  );
};

const ActivityItem = ({ job }) => {
  const successful = isSuccessfulJob(job);
  const failed = isFailedJob(job);

  const tone = successful
    ? "success"
    : failed
      ? "failed"
      : "dry";

  const Icon = successful
    ? CheckCircle2
    : failed
      ? XCircle
      : Clock3;

  const title = successful
    ? t("Delivery successful")
    : failed
      ? t("Delivery failed")
      : t("Dry run completed");

  const fileCount = hasValue(job?.files_count)
    ? ` · ${job.files_count} ${t("Files").toLowerCase()}`
    : "";

  return (
    <div className="dashboard-activity-item">
      <span className="dashboard-activity-time">
        {formatTime(getJobDateValue(job))}
      </span>

      <div
        className={`dashboard-activity-marker ${tone}`}
        aria-hidden="true"
      >
        <Icon size={14} />
      </div>

      <div className="dashboard-activity-copy">
        <strong>{title}</strong>
        <span>
          {getRepositoryName(job)}
          {fileCount}
        </span>
      </div>
    </div>
  );
};

const StatusBadge = ({ job }) => {
  const successful = isSuccessfulJob(job);
  const failed = isFailedJob(job);

  if (successful) {
    return (
      <span className="dashboard-status success">
        <CheckCircle2 size={11} />
        {t("SUCCESS")}
      </span>
    );
  }

  if (failed) {
    return (
      <span className="dashboard-status failed">
        <XCircle size={11} />
        {t("FAILED")}
      </span>
    );
  }

  return (
    <span className="dashboard-status dry">
      <Clock3 size={11} />
      {t(getJobStatus(job).replace(/_/g, " "))}
    </span>
  );
};

const DeliveryModeBadge = ({ dry }) => (
  <span
    className={`dashboard-mode ${dry ? "dry" : "live"}`}
  >
    {dry ? t("DRY RUN") : t("LIVE")}
  </span>
);

const RecentDeliveryRow = ({ job }) => (
  <div className="dashboard-recent-row">
    <span
      className="dashboard-job-id"
      title={
        job?.job_reference ??
        job?.job_id ??
        job?.id ??
        ""
      }
    >
      {job?.job_reference ??
        job?.job_id ??
        job?.id ??
        "—"}
    </span>

    <strong
      title={getRepositoryName(job)}
    >
      {getRepositoryName(job)}
    </strong>

    <DeliveryModeBadge dry={isDryRun(job)} />

    <StatusBadge job={job} />

    <span>{job?.files_count ?? "—"}</span>

    <span>{formatDuration(job)}</span>

    <span>{formatTime(getJobDateValue(job))}</span>
  </div>
);

const EmptyState = ({ children }) => (
  <div className="dashboard-empty">{children}</div>
);

const DashboardEnhancement = ({
  jobs = [],
  repos = [],
  stats = {},
  onHistory,
  onRepositories,
}) => {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeRepos = Array.isArray(repos) ? repos : [];

  const jobDerivedCounts = useMemo(
    () => ({
      total: safeJobs.length,
      successful: getSuccessfulCount(safeJobs),
      failed: getFailedCount(safeJobs),
      dryRuns: getDryRunCount(safeJobs),
    }),
    [safeJobs]
  );

  const metrics = useMemo(() => {
    const total = getStat(
      stats,
      ["total", "total_jobs", "totalJobs"],
      jobDerivedCounts.total
    );

    const successful = getStat(
      stats,
      ["success", "successful", "successful_jobs"],
      jobDerivedCounts.successful
    );

    const failed = getStat(
      stats,
      ["failed", "failures", "failed_jobs"],
      jobDerivedCounts.failed
    );

    const dryRuns = getStat(
      stats,
      ["dry_run", "dry_runs", "dryRuns"],
      jobDerivedCounts.dryRuns
    );

    const completed = successful + failed;

    return {
      total,
      successful,
      failed,
      dryRuns,
      successRate:
        completed > 0
          ? (successful / completed) * 100
          : 0,
      failureRate:
        completed > 0
          ? (failed / completed) * 100
          : 0,
      dryRunRate:
        total > 0
          ? (dryRuns / total) * 100
          : 0,
    };
  }, [stats, jobDerivedCounts]);

  const sortedJobs = useMemo(
    () =>
      [...safeJobs].sort(
        (a, b) =>
          (toDate(getJobDateValue(b))?.getTime() ?? 0) -
          (toDate(getJobDateValue(a))?.getTime() ?? 0)
      ),
    [safeJobs]
  );

  const recentJobs = sortedJobs.slice(0, 5);
  const lastSuccessfulJob =
    sortedJobs.find(isSuccessfulJob) ?? null;

  const days = useMemo(() => {
    const result = getSevenDays();

    safeJobs.forEach((job) => {
      if (isDryRun(job)) return;

      const date = toDate(getJobDateValue(job));
      if (!date) return;

      date.setHours(0, 0, 0, 0);

      const day = result.find(
        (item) =>
          item.date.getTime() === date.getTime()
      );

      if (!day) return;

      if (isSuccessfulJob(job)) {
        day.success += 1;
      } else if (isFailedJob(job)) {
        day.failed += 1;
      }
    });

    return result;
  }, [safeJobs]);

  const chartMax = Math.max(
    1,
    ...days.map((day) =>
      Math.max(day.success, day.failed)
    )
  );

  const weekly = useMemo(() => {
    const successful = days.reduce(
      (sum, day) => sum + day.success,
      0
    );

    const failed = days.reduce(
      (sum, day) => sum + day.failed,
      0
    );

    const completed = successful + failed;

    return {
      successful,
      failed,
      successRate:
        completed > 0
          ? (successful / completed) * 100
          : metrics.successRate,
    };
  }, [days, metrics.successRate]);

  const health = useMemo(
    () => calculateHealth(safeRepos),
    [safeRepos]
  );

  return (
    <section
      className="dashboard-redesign"
      aria-label={t("Dashboard insights")}
    >
      <div className="dashboard-kpi-grid">
        <KpiCard
          icon={Archive}
          iconTone="purple"
          label={t("Total jobs")}
          value={metrics.total}
          description={t("All executions")}
        >
          <MiniBars />
        </KpiCard>

        <KpiCard
          icon={CheckCircle2}
          iconTone="green"
          label={t("Successful")}
          value={metrics.successful}
          description={`${metrics.successRate.toFixed(
            1
          )}% ${t("success rate")}`}
        >
          <MetricRing
            percentage={metrics.successRate}
            variable="--dashboard-success"
            label={t("Success rate")}
          />
        </KpiCard>

        <KpiCard
          icon={XCircle}
          iconTone="red"
          label={t("Failed")}
          value={metrics.failed}
          description={`${metrics.failureRate.toFixed(
            1
          )}% ${t("failure rate")}`}
        >
          <MetricRing
            percentage={metrics.failureRate}
            variable="--dashboard-failed"
            label={t("Failure rate")}
          />
        </KpiCard>

        <KpiCard
          icon={Clock3}
          iconTone="purple"
          label={t("Dry runs")}
          value={metrics.dryRuns}
          description={`${metrics.dryRunRate.toFixed(
            1
          )}% ${t("of total")}`}
        >
          <MetricRing
            percentage={metrics.dryRunRate}
            variable="--dashboard-dry"
            label={t("Dry run rate")}
          />
        </KpiCard>
      </div>

      <div className="dashboard-insight-grid">
        <TrendCard
          title={t("Success rate")}
          summary={`${weekly.successRate.toFixed(1)}%`}
          summaryLabel={`${weekly.successful} ${t("successful deliveries")}`}
          icon={TrendingUp}
          lineKey="success"
          days={days}
          maxValue={chartMax}
        />

        <TrendCard
          title={t("Failures")}
          summary={weekly.failed}
          summaryLabel={t("failed deliveries")}
          icon={XCircle}
          lineKey="failed"
          days={days}
          maxValue={chartMax}
          failure
        />

        <article className="dashboard-panel dashboard-repository-health">
          <div className="dashboard-panel-head">
            <div>
              <span className="dashboard-label">
                {t("INFRASTRUCTURE")}
              </span>
              <h2>{t("Repositories")}</h2>
              <p>{t("Current connection health")}</p>
            </div>

            <button
              type="button"
              className="dashboard-text-button"
              onClick={onRepositories}
            >
              {t("Manage all")}
            </button>
          </div>

          <div className="dashboard-health-row">
            <div className="dashboard-health-stat connected">
              <i aria-hidden="true" />
              <strong>{health.connected}</strong>
              <span>{t("Connected")}</span>
            </div>

            <div className="dashboard-health-stat attention">
              <i aria-hidden="true" />
              <strong>{health.attention}</strong>
              <span>{t("Needs attention")}</span>
            </div>

            <div className="dashboard-health-stat offline">
              <i aria-hidden="true" />
              <strong>{health.offline}</strong>
              <span>{t("Offline")}</span>
            </div>
          </div>

          <div className="dashboard-health-total">
            {health.total} {t("configured repositories")}
          </div>
        </article>
      </div>

      <div className="dashboard-operations-grid">
        <article className="dashboard-panel dashboard-activity-panel">
          <div className="dashboard-panel-head">
            <div>
              <span className="dashboard-label">
                {t("OPERATIONS")}
              </span>
              <h2>
                {t("Delivery activity")}{" "}
                <em>({t("Latest")})</em>
              </h2>
            </div>

            <button
              type="button"
              className="dashboard-text-button"
              onClick={onHistory}
            >
              {t("View all activity")}
            </button>
          </div>

          {recentJobs.length > 0 ? (
            <div className="dashboard-activity-list">
              {recentJobs.map((job, index) => (
                <ActivityItem
                  key={getJobKey(job, index)}
                  job={job}
                />
              ))}
            </div>
          ) : (
            <EmptyState>
              {t("No delivery activity yet.")}
            </EmptyState>
          )}

          <button
            type="button"
            className="dashboard-outline-button"
            onClick={onHistory}
          >
            <Activity size={14} />
            {t("View all operations")}
          </button>
        </article>

        <article className="dashboard-panel dashboard-recent-panel">
          <div className="dashboard-panel-head">
            <div>
              <span className="dashboard-label">
                {t("DELIVERY HISTORY")}
              </span>
              <h2>{t("Recent deliveries")}</h2>
            </div>

            <button
              type="button"
              className="dashboard-text-button"
              onClick={onHistory}
            >
              {t("View all history")}
            </button>
          </div>

          {recentJobs.length > 0 ? (
            <div className="dashboard-recent-table">
              <div className="dashboard-recent-head">
                <span>{t("JOB ID")}</span>
                <span>{t("REPOSITORY")}</span>
                <span>{t("MODE")}</span>
                <span>{t("STATUS")}</span>
                <span>{t("FILES")}</span>
                <span>{t("DURATION")}</span>
                <span>{t("CREATED")}</span>
              </div>

              {recentJobs.map((job, index) => (
                <RecentDeliveryRow
                  key={getJobKey(job, index)}
                  job={job}
                />
              ))}
            </div>
          ) : (
            <EmptyState>
              {t("No delivery jobs yet.")}
            </EmptyState>
          )}

          <button
            type="button"
            className="dashboard-outline-button"
            onClick={onHistory}
          >
            <Archive size={14} />
            {t("View all delivery history")}
          </button>
        </article>

        <article className="dashboard-panel dashboard-last-panel">
          <div className="dashboard-panel-head">
            <div>
              <span className="dashboard-label">
                {t("LATEST DELIVERY")}
              </span>
              <h2>{t("Last successful delivery")}</h2>
            </div>

            {lastSuccessfulJob && (
              <span className="dashboard-success-pill">
                {t("SUCCESS")}
              </span>
            )}
          </div>

          {lastSuccessfulJob ? (
            <div className="dashboard-last-content">
              <div className="dashboard-last-repo">
                <div
                  className="dashboard-last-icon"
                  aria-hidden="true"
                >
                  <GitBranch size={18} />
                </div>

                <div>
                  <strong>
                    {getRepositoryName(lastSuccessfulJob)}
                  </strong>

                  <span>
                    {formatDate(
                      getJobDateValue(lastSuccessfulJob)
                    )}
                  </span>
                </div>
              </div>

              <div className="dashboard-detail-list">
                <div>
                  <FileText size={14} />
                  <span>{t("Files")}</span>
                  <strong>
                    {lastSuccessfulJob.files_count ?? "—"}
                  </strong>
                </div>

                <div>
                  <Archive size={14} />
                  <span>{t("Archive")}</span>
                  <strong
                    title={
                      lastSuccessfulJob.archive_name ?? ""
                    }
                  >
                    {lastSuccessfulJob.archive_name ?? "—"}
                  </strong>
                </div>

                <div>
                  <Server size={14} />
                  <span>{t("Archive size")}</span>
                  <strong>
                    {formatBytes(
                      lastSuccessfulJob.archive_size
                    )}
                  </strong>
                </div>

                <div>
                  <Timer size={14} />
                  <span>{t("Duration")}</span>
                  <strong>
                    {formatDuration(lastSuccessfulJob)}
                  </strong>
                </div>

                <div>
                  <Mail size={14} />
                  <span>{t("Mode")}</span>
                  <strong>
                    {lastSuccessfulJob.email_mode ?? "SMTP"}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="dashboard-detail-link"
                onClick={onHistory}
              >
                {t("View delivery details")}
                <span aria-hidden="true">›</span>
              </button>
            </div>
          ) : (
            <EmptyState>
              {t("No successful delivery has been recorded yet.")}
            </EmptyState>
          )}
        </article>
      </div>
    </section>
  );
};

export default DashboardEnhancement;
