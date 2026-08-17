from pathlib import Path
from datetime import datetime

from git import Repo, GitCommandError

from .repository_service import (
    RepositoryService,
    RepositoryServiceError,
)

from .target_service import (
    TargetService,
    TargetServiceError,
)

from .archive_service import (
    ArchiveService,
    ArchiveServiceError,
)


class DeliveryEngineError(Exception):
    """
    Raised when delivery processing fails.
    """

    pass


class DeliveryEngine:
    """
    Main delivery orchestration service.

    Supports:

        LOCAL repositories
        Public remote repositories
        Private remote repositories

    Target support:

        - Single legacy target
        - Multiple files
        - Multiple folders
        - Filename search anywhere
        - Per-target extensions

    Flow:

        Repository
            ↓
        Authentication
            ↓
        Branch
            ↓
        Multiple targets
            ↓
        File collection
            ↓
        Security validation
            ↓
        Archive
            ↓
        Email
    """

    def __init__(self, repo_config):

        self.c = repo_config

        self.repository_service = (
            RepositoryService()
        )

        self.archive_service = (
            ArchiveService()
        )

    # ==========================================================
    # AUTHENTICATION INFORMATION
    # ==========================================================

    def _get_repository_credentials(self):
        """
        Read repository credentials.

        The encrypted token is NOT decrypted here.

        RepositoryService is responsible for
        decrypting it only when required.
        """

        try:

            credential = self.c.credential

        except AttributeError as exc:

            raise DeliveryEngineError(
                "Repository credential relationship "
                "is not configured correctly."
            ) from exc

        if credential is None:

            return {
                "auth_type": "NONE",
                "username": "",
                "encrypted_token": "",
            }

        auth_type = (
            credential.auth_type
            or "NONE"
        )

        username = (
            credential.username
            or ""
        )

        encrypted_token = (
            credential.encrypted_token
            or ""
        )

        auth_type = (
            str(auth_type)
            .strip()
            .upper()
        )

        # ======================================================
        # PAT VALIDATION
        # ======================================================

        if auth_type == "PAT":

            if not encrypted_token:

                raise DeliveryEngineError(
                    "Repository authentication is configured "
                    "as PAT, but no encrypted access token "
                    "is stored."
                )

            if not username:

                raise DeliveryEngineError(
                    "Repository authentication is configured "
                    "as PAT, but the Git username is missing."
                )

        # ======================================================
        # SUPPORTED AUTH TYPES
        # ======================================================

        elif auth_type not in {
            "NONE",
        }:

            raise DeliveryEngineError(
                "Unsupported repository authentication "
                f"type: {auth_type}"
            )

        return {
            "auth_type": auth_type,
            "username": username,
            "encrypted_token": encrypted_token,
        }

    # ==========================================================
    # REPOSITORY VALIDATION
    # ==========================================================

    def validate_repository(self):
        """
        Validate repository configuration without
        collecting files or creating an archive.
        """

        repository_type = (
            str(
                getattr(
                    self.c,
                    "repository_type",
                    "LOCAL",
                )
                or "LOCAL"
            )
            .strip()
            .upper()
        )

        # ======================================================
        # LOCAL REPOSITORY
        # ======================================================

        if repository_type == "LOCAL":

            local_path = getattr(
                self.c,
                "local_path",
                None,
            )

            if not local_path:

                raise DeliveryEngineError(
                    "Local repository path is not configured."
                )

            path = Path(
                local_path
            ).resolve()

            if not path.exists():

                raise DeliveryEngineError(
                    f"Repository does not exist: {path}"
                )

            if not path.is_dir():

                raise DeliveryEngineError(
                    f"Repository path is not a directory: {path}"
                )

            try:

                repo = Repo(path)

            except Exception as exc:

                raise DeliveryEngineError(
                    f"Invalid Git repository: {path}"
                ) from exc

            branch = (
                getattr(
                    self.c,
                    "branch",
                    "main",
                )
                or "main"
            )

            self._checkout_branch(
                repo,
                branch,
            )

            return {
                "repository_type": "LOCAL",

                "repository_path": str(
                    path
                ),

                "branch": branch,

                "commit": (
                    repo.head.commit.hexsha[:12]
                ),
            }

        # ======================================================
        # REMOTE REPOSITORY
        # ======================================================

        repository_url = getattr(
            self.c,
            "repository_url",
            None,
        )

        if not repository_url:

            raise DeliveryEngineError(
                "Repository URL is required "
                "for remote repositories."
            )

        branch = (
            getattr(
                self.c,
                "branch",
                "main",
            )
            or "main"
        )

        credentials = (
            self._get_repository_credentials()
        )

        try:

            result = (
                self.repository_service.test_connection(
                    repository_url=repository_url,
                    branch=branch,
                    auth_type=credentials[
                        "auth_type"
                    ],
                    username=credentials[
                        "username"
                    ],
                    encrypted_token=credentials[
                        "encrypted_token"
                    ],
                )
            )

        except RepositoryServiceError as exc:

            raise DeliveryEngineError(
                str(exc)
            ) from exc

        return {
            "repository_type": "REMOTE",

            "repository_path": result[
                "repository_path"
            ],

            "branch": result[
                "branch"
            ],

            "commit": result[
                "commit"
            ],

            "repository_url": (
                repository_url
            ),
        }

    # ==========================================================
    # MAIN DELIVERY
    # ==========================================================

    def run(
        self,
        dry_run=False,
    ):
        """
        Execute repository collection and archive creation.

        Supports:

            targets[]

        with backward compatibility for:

            target_path
            extensions
        """

        repository_type = (
            str(
                getattr(
                    self.c,
                    "repository_type",
                    "LOCAL",
                )
                or "LOCAL"
            )
            .strip()
            .upper()
        )

        branch = (
            getattr(
                self.c,
                "branch",
                "main",
            )
            or "main"
        )

        # ======================================================
        # PREPARE REPOSITORY
        # ======================================================

        if repository_type == "LOCAL":

            local_path = getattr(
                self.c,
                "local_path",
                None,
            )

            if not local_path:

                raise DeliveryEngineError(
                    "Local repository path is not configured."
                )

            repository_root = Path(
                local_path
            ).resolve()

            if not repository_root.exists():

                raise DeliveryEngineError(
                    f"Repository does not exist: "
                    f"{repository_root}"
                )

            if not repository_root.is_dir():

                raise DeliveryEngineError(
                    f"Repository path is not a directory: "
                    f"{repository_root}"
                )

            try:

                repo = Repo(
                    repository_root
                )

            except Exception as exc:

                raise DeliveryEngineError(
                    "Configured local path is not "
                    "a valid Git repository."
                ) from exc

            self._checkout_branch(
                repo,
                branch,
            )

            # --------------------------------------------------
            # Pull latest changes
            # --------------------------------------------------

            if repo.remotes:

                try:

                    repo.remotes.origin.pull(
                        branch
                    )

                except GitCommandError as exc:

                    raise DeliveryEngineError(
                        f"Git pull failed: {exc}"
                    ) from exc

            commit = (
                repo.head.commit.hexsha[:12]
            )

        # ======================================================
        # REMOTE REPOSITORY
        # ======================================================

        else:

            repository_url = getattr(
                self.c,
                "repository_url",
                None,
            )

            if not repository_url:

                raise DeliveryEngineError(
                    "Repository URL is not configured."
                )

            credentials = (
                self._get_repository_credentials()
            )

            try:

                result = (
                    self.repository_service.prepare(
                        repository_url=repository_url,
                        branch=branch,
                        auth_type=credentials[
                            "auth_type"
                        ],
                        username=credentials[
                            "username"
                        ],
                        encrypted_token=credentials[
                            "encrypted_token"
                        ],
                    )
                )

            except RepositoryServiceError as exc:

                raise DeliveryEngineError(
                    str(exc)
                ) from exc

            repository_root = Path(
                result["path"]
            ).resolve()

            commit = result[
                "commit"
            ]

        # ======================================================
        # TARGET SERVICE
        # ======================================================

        try:

            target_service = (
                TargetService(
                    repository_root
                )
            )

        except TargetServiceError as exc:

            raise DeliveryEngineError(
                str(exc)
            ) from exc

        # ======================================================
        # MULTIPLE TARGETS
        # ======================================================

        configured_targets = getattr(
            self.c,
            "targets",
            None,
        )

        # ======================================================
        # NEW TARGET SYSTEM
        # ======================================================

        if configured_targets:

            if not isinstance(
                configured_targets,
                list,
            ):

                raise DeliveryEngineError(
                    "Repository targets configuration "
                    "must be a list."
                )

            try:

                target_result = (
                    target_service.collect_targets(
                        configured_targets
                    )
                )

            except TargetServiceError as exc:

                raise DeliveryEngineError(
                    str(exc)
                ) from exc

            files = target_result.get(
                "files",
                [],
            )

            target_errors = (
                target_result.get(
                    "errors",
                    [],
                )
            )

            # --------------------------------------------------
            # Report target errors
            # --------------------------------------------------

            if target_errors:

                error_messages = []

                for item in target_errors:

                    error_messages.append(
                        (
                            f"{item.get('target')}: "
                            f"{item.get('error')}"
                        )
                    )

                if not files:

                    raise DeliveryEngineError(
                        "No valid files were found "
                        "for the configured targets.\n"
                        + "\n".join(
                            error_messages
                        )
                    )

            target_path_result = (
                configured_targets
            )

        # ======================================================
        # LEGACY SINGLE TARGET
        # ======================================================

        else:

            target_path = getattr(
                self.c,
                "target_path",
                None,
            )

            # Backward compatibility.

            if not target_path:

                target_path = getattr(
                    self.c,
                    "log_directory",
                    None,
                )

            if not target_path:

                raise DeliveryEngineError(
                    "Target path is not configured."
                )

            extensions = getattr(
                self.c,
                "extensions",
                None,
            )

            try:

                files = (
                    target_service.collect_files(
                        target_path,
                        extensions,
                    )
                )

            except TargetServiceError as exc:

                raise DeliveryEngineError(
                    str(exc)
                ) from exc

            target_path_result = (
                target_path
            )

        # ======================================================
        # NO FILES
        # ======================================================

        if not files:

            raise DeliveryEngineError(
                "No valid files were found "
                "for the configured target(s)."
            )

        # ======================================================
        # DRY RUN
        # ======================================================

        if dry_run:

            return {
                "files": files,

                "archive_name": (
                    self._preview_archive_name()
                ),

                "archive_path": "",

                "archive_size": 0,

                "commit": commit,

                "repository_path": str(
                    repository_root
                ),

                "target_path": (
                    target_path_result
                ),

                "targets": (
                    configured_targets
                    if configured_targets
                    else [
                        {
                            "path": target_path_result,
                            "extensions": (
                                getattr(
                                    self.c,
                                    "extensions",
                                    []
                                )
                                or []
                            ),
                        }
                    ]
                ),
            }

        # ======================================================
        # CREATE ARCHIVE
        # ======================================================

        try:

            archive_result = (
                self.archive_service.create(
                    repository_root=(
                        repository_root
                    ),

                    files=files,

                    prefix="ApplicationLogs",
                )
            )

        except ArchiveServiceError as exc:

            raise DeliveryEngineError(
                str(exc)
            ) from exc

        # ======================================================
        # RETURN RESULT
        # ======================================================

        return {
            "files": files,

            "archive_name": (
                archive_result[
                    "archive_name"
                ]
            ),

            "archive_path": (
                archive_result[
                    "archive_path"
                ]
            ),

            "archive_size": (
                archive_result[
                    "archive_size"
                ]
            ),

            "commit": commit,

            "repository_path": str(
                repository_root
            ),

            "target_path": (
                target_path_result
            ),

            "targets": (
                configured_targets
                if configured_targets
                else [
                    {
                        "path": target_path_result,
                        "extensions": (
                            getattr(
                                self.c,
                                "extensions",
                                []
                            )
                            or []
                        ),
                    }
                ]
            ),
        }

    # ==========================================================
    # BRANCH
    # ==========================================================

    @staticmethod
    def _checkout_branch(
        repo,
        branch,
    ):
        """
        Checkout an existing local or remote branch.
        """

        if not branch:

            branch = "main"

        local_branches = [
            item.name
            for item in repo.branches
        ]

        # ======================================================
        # LOCAL BRANCH
        # ======================================================

        if branch in local_branches:

            try:

                repo.git.checkout(
                    branch
                )

            except GitCommandError as exc:

                raise DeliveryEngineError(
                    f"Unable to checkout branch "
                    f"'{branch}': {exc}"
                ) from exc

            return

        # ======================================================
        # REMOTE BRANCH
        # ======================================================

        remote_branch = (
            f"origin/{branch}"
        )

        try:

            repo.git.checkout(
                "-b",
                branch,
                remote_branch,
            )

        except GitCommandError as exc:

            raise DeliveryEngineError(
                f"Branch '{branch}' does not "
                "exist in the repository."
            ) from exc

    # ==========================================================
    # PREVIEW ARCHIVE NAME
    # ==========================================================

    @staticmethod
    def _preview_archive_name():

        timestamp = (
            datetime.now().strftime(
                "%Y-%m-%d_%H%M%S"
            )
        )

        return (
            f"ApplicationLogs_"
            f"{timestamp}.zip"
        )