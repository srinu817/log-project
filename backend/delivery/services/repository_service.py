from pathlib import Path
from uuid import uuid4
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json

from git import (
    Repo,
    Git,
    GitCommandError,
    InvalidGitRepositoryError,
)

from .security_service import SecurityService


class RepositoryServiceError(Exception):
    """
    Raised when repository operations fail.
    """

    pass


class RepositoryService:
    """
    Handles Git repository operations.

    Supports:

        - Local repositories
        - Public remote repositories
        - Private repositories using PAT
        - Branch discovery
        - Branch checkout
        - Git pull
        - Repository preparation
        - Connection testing
    """

    def __init__(
        self,
        workspace="repository_workspace",
    ):

        self.workspace = Path(
            workspace
        )

        self.workspace.mkdir(
            parents=True,
            exist_ok=True,
        )

    # ==========================================================
    # REPOSITORY URL VALIDATION
    # ==========================================================

    @staticmethod
    def validate_url(
        repository_url,
    ):

        if not repository_url:

            raise RepositoryServiceError(
                "Repository URL is required."
            )

        repository_url = str(
            repository_url
        ).strip()

        supported = (
            repository_url.startswith(
                "https://"
            )
            or repository_url.startswith(
                "http://"
            )
            or repository_url.startswith(
                "git@"
            )
            or repository_url.startswith(
                "ssh://"
            )
        )

        if not supported:

            raise RepositoryServiceError(
                "Unsupported repository URL. "
                "Use an HTTP(S), SSH or Git URL."
            )

        return repository_url

    # ==========================================================
    # REPOSITORY NAME
    # ==========================================================

    @staticmethod
    def repository_name(
        repository_url,
    ):

        value = str(
            repository_url
        ).rstrip("/")

        name = value.split("/")[-1]

        if name.endswith(".git"):

            name = name[:-4]

        if not name:

            name = (
                "repository_"
                + uuid4().hex[:8]
            )

        safe = "".join(
            char
            if (
                char.isalnum()
                or char in (
                    "-",
                    "_",
                )
            )
            else "_"
            for char in name
        )

        return safe

    # ==========================================================
    # AUTHENTICATED URL
    # ==========================================================

    @staticmethod
    def build_authenticated_url(
        repository_url,
        username,
        access_token,
    ):
        """
        Build temporary authenticated HTTP(S) URL.

        IMPORTANT:

        This URL contains the PAT.

        Never log it.
        Never return it through an API.
        """

        if not access_token:

            raise RepositoryServiceError(
                "Access token is required."
            )

        repository_url = (
            RepositoryService.validate_url(
                repository_url
            )
        )

        parsed = urlsplit(
            repository_url
        )

        if parsed.scheme not in (
            "http",
            "https",
        ):

            raise RepositoryServiceError(
                "PAT authentication requires "
                "an HTTP(S) repository URL."
            )

        username = (
            username.strip()
            if username
            else "x-access-token"
        )

        if not parsed.hostname:

            raise RepositoryServiceError(
                "Invalid repository URL."
            )

        authenticated_netloc = (
            f"{username}:{access_token}@"
            f"{parsed.hostname}"
        )

        if parsed.port:

            authenticated_netloc += (
                f":{parsed.port}"
            )

        return urlunsplit(
            (
                parsed.scheme,
                authenticated_netloc,
                parsed.path,
                parsed.query,
                parsed.fragment,
            )
        )

    # ==========================================================
    # PREPARE CLONE URL
    # ==========================================================

    def _prepare_clone_url(
        self,
        repository_url,
        auth_type="NONE",
        username="",
        encrypted_token="",
    ):
        """
        Prepare URL for Git operations.

        NONE:

            Public repository.

        PAT:

            Private repository.
        """

        repository_url = (
            self.validate_url(
                repository_url
            )
        )

        clone_url = repository_url
        access_token = None

        auth_type = (
            str(
                auth_type or "NONE"
            )
            .strip()
            .upper()
        )

        # ======================================================
        # PUBLIC
        # ======================================================

        if auth_type in (
            "NONE",
            "",
        ):

            return (
                clone_url,
                None,
            )

        # ======================================================
        # PAT
        # ======================================================

        if auth_type == "PAT":

            if not encrypted_token:

                raise RepositoryServiceError(
                    "Repository authentication is configured "
                    "as PAT but no credential is stored."
                )

            try:

                access_token = (
                    SecurityService.decrypt_secret(
                        encrypted_token
                    )
                )

            except Exception as exc:

                raise RepositoryServiceError(
                    "Unable to access repository credential."
                ) from exc

            if not access_token:

                raise RepositoryServiceError(
                    "Stored repository credential is empty."
                )

            try:

                clone_url = (
                    self.build_authenticated_url(
                        repository_url,
                        username,
                        access_token,
                    )
                )

            except RepositoryServiceError:

                raise

            except Exception as exc:

                raise RepositoryServiceError(
                    "Unable to prepare repository authentication."
                ) from exc

            return (
                clone_url,
                access_token,
            )

        # ======================================================
        # UNSUPPORTED AUTH
        # ======================================================

        raise RepositoryServiceError(
            "Unsupported repository authentication type: "
            f"{auth_type}"
        )

    # ==========================================================
    # CLONE
    # ==========================================================

    def clone(
        self,
        repository_url,
        branch="main",
        auth_type="NONE",
        username="",
        encrypted_token="",
    ):

        repository_url = (
            self.validate_url(
                repository_url
            )
        )

        branch = (
            str(
                branch or "main"
            ).strip()
            or "main"
        )

        name = self.repository_name(
            repository_url
        )

        target = (
            self.workspace
            / f"{name}_{uuid4().hex[:8]}"
        )

        clone_url = None
        access_token = None
        repo = None

        try:

            (
                clone_url,
                access_token,
            ) = self._prepare_clone_url(
                repository_url=repository_url,
                auth_type=auth_type,
                username=username,
                encrypted_token=encrypted_token,
            )

            repo = Repo.clone_from(
                clone_url,
                target,
                branch=branch,
            )

        except GitCommandError as exc:

            raise RepositoryServiceError(
                "Git clone failed. "
                "Check the repository URL, branch "
                "and authentication credentials."
            ) from exc

        except RepositoryServiceError:

            raise

        except Exception as exc:

            raise RepositoryServiceError(
                "Unable to clone repository."
            ) from exc

        finally:

            clone_url = None
            access_token = None

        if repo is None:

            raise RepositoryServiceError(
                "Repository clone did not complete."
            )

        return {
            "path": str(
                target.resolve()
            ),

            "branch": branch,

            "commit": (
                repo.head.commit.hexsha[:12]
            ),
        }

    # ==========================================================
    # LIST REMOTE BRANCHES
    # ==========================================================

    def _github_repository_path(self, repository_url):
        """Return the GitHub API repository path: owner/repository."""
        parsed = urlsplit(str(repository_url).strip())

        if parsed.hostname.lower() not in {"github.com", "www.github.com"}:
            return None

        parts = [part for part in parsed.path.strip("/").split("/") if part]

        # Supports URLs such as:
        # https://github.com/owner/repo
        # https://github.com/owner/repo.git
        # https://github.com/owner/repo/tree/branch/path
        if len(parts) < 2:
            raise RepositoryServiceError(
                "Invalid GitHub repository URL. Use https://github.com/owner/repository."
            )

        owner = parts[0]
        repository = parts[1]

        if repository.endswith(".git"):
            repository = repository[:-4]

        if not owner or not repository:
            raise RepositoryServiceError(
                "Invalid GitHub repository URL."
            )

        return f"{owner}/{repository}"

    def _list_github_branches(
        self,
        repository_url,
        access_token=None,
    ):
        """Fetch GitHub branches through the GitHub REST API."""
        repository_path = self._github_repository_path(repository_url)
        if not repository_path:
            return None

        branches = []
        page = 1

        while True:
            api_url = (
                f"https://api.github.com/repos/{repository_path}/branches"
                f"?per_page=100&page={page}"
            )

            headers = {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "RepositoryService",
            }

            if access_token:
                headers["Authorization"] = f"Bearer {access_token}"

            request = Request(
                api_url,
                headers=headers,
                method="GET",
            )

            try:
                with urlopen(request, timeout=20) as response:
                    payload = json.loads(
                        response.read().decode("utf-8")
                    )

            except HTTPError as exc:
                status = getattr(exc, "code", None)

                if status in (401, 403, 404):
                    if status == 401:
                        message = (
                            "Unable to access GitHub repository. "
                            "Check the PAT and its permissions."
                        )
                    elif status == 403:
                        message = (
                            "GitHub denied access to the repository. "
                            "Check the PAT permissions or GitHub API access."
                        )
                    else:
                        message = (
                            "GitHub repository was not found or is not accessible. "
                            "Check the repository URL and credentials."
                        )

                    raise RepositoryServiceError(message) from exc

                raise RepositoryServiceError(
                    "GitHub could not return the repository branches."
                ) from exc

            except (URLError, TimeoutError) as exc:
                raise RepositoryServiceError(
                    "Unable to connect to the GitHub API while fetching branches."
                ) from exc

            if not isinstance(payload, list):
                raise RepositoryServiceError(
                    "GitHub returned an unexpected branch response."
                )

            for item in payload:
                if isinstance(item, dict):
                    name = str(item.get("name") or "").strip()
                    if name:
                        branches.append(name)

            if len(payload) < 100:
                break

            page += 1

        return branches

    def list_branches(
        self,
        repository_url,
        auth_type="NONE",
        username="",
        encrypted_token="",
    ):
        """
        Fetch all remote branches without cloning the repository.

        GitHub repositories use the GitHub REST API for branch discovery.
        Other supported Git providers continue to use git ls-remote.
        """

        repository_url = self.validate_url(repository_url)

        clone_url = None
        access_token = None

        try:
            (
                clone_url,
                access_token,
            ) = self._prepare_clone_url(
                repository_url=repository_url,
                auth_type=auth_type,
                username=username,
                encrypted_token=encrypted_token,
            )

            # ======================================================
            # GITHUB BRANCH DISCOVERY
            # ======================================================
            # Use the REST API instead of git ls-remote. This gives us
            # reliable branch discovery for both public and private
            # GitHub repositories and also supports pasted /tree/... URLs.
            github_branches = self._list_github_branches(
                repository_url=repository_url,
                access_token=access_token,
            )

            if github_branches is not None:
                branches = sorted(
                    set(github_branches),
                    key=lambda value: value.lower(),
                )

                if not branches:
                    raise RepositoryServiceError(
                        "No branches were found in the GitHub repository."
                    )

                preferred = [
                    "main",
                    "master",
                    "develop",
                    "development",
                ]

                branches.sort(
                    key=lambda value: (
                        preferred.index(value.lower())
                        if value.lower() in preferred
                        else len(preferred),
                        value.lower(),
                    )
                )

                return branches

            # ======================================================
            # OTHER GIT PROVIDERS
            # ======================================================
            git = Git()

            try:
                output = git.ls_remote(
                    "--heads",
                    clone_url,
                )

            except GitCommandError as exc:
                stderr = ""

                try:
                    stderr = (
                        getattr(exc, "stderr", "")
                        or ""
                    )
                except Exception:
                    stderr = ""

                stderr_lower = str(stderr).strip().lower()

                if (
                    "authentication failed" in stderr_lower
                    or "could not read username" in stderr_lower
                    or "repository not found" in stderr_lower
                    or "access denied" in stderr_lower
                    or "403" in stderr_lower
                    or "401" in stderr_lower
                ):
                    raise RepositoryServiceError(
                        "Unable to access repository. "
                        "For a private repository, check the "
                        "username and PAT permissions."
                    ) from exc

                raise RepositoryServiceError(
                    "Git could not fetch repository branches. "
                    "Check the repository URL and repository access."
                ) from exc

            branches = []

            for line in str(output or "").splitlines():
                line = line.strip()

                if not line:
                    continue

                parts = line.split()

                if len(parts) < 2:
                    continue

                ref = parts[1].strip()
                prefix = "refs/heads/"

                if not ref.startswith(prefix):
                    continue

                branch = ref[len(prefix):].strip()

                if branch:
                    branches.append(branch)

            branches = sorted(
                set(branches),
                key=lambda value: value.lower(),
            )

            if not branches:
                raise RepositoryServiceError(
                    "No branches were found in the repository."
                )

            preferred = [
                "main",
                "master",
                "develop",
                "development",
            ]

            branches.sort(
                key=lambda value: (
                    preferred.index(value.lower())
                    if value.lower() in preferred
                    else len(preferred),
                    value.lower(),
                )
            )

            return branches

        except RepositoryServiceError:
            raise

        except Exception as exc:
            raise RepositoryServiceError(
                "Unable to fetch repository branches. "
                f"Unexpected error: {type(exc).__name__}"
            ) from exc

        finally:
            clone_url = None
            access_token = None

    # ==========================================================
    # GET BRANCHES
    # ==========================================================

    def get_branches(
        self,
        repository_url,
        auth_type="NONE",
        username="",
        encrypted_token="",
    ):
        """
        API-friendly branch response.
        """

        branches = self.list_branches(
            repository_url=repository_url,

            auth_type=auth_type,

            username=username,

            encrypted_token=encrypted_token,
        )

        return {
            "status": "CONNECTED",

            "message": (
                "Repository branches fetched successfully."
            ),

            "branches": branches,
        }

    # ==========================================================
    # OPEN EXISTING REPOSITORY
    # ==========================================================

    def open_repository(
        self,
        local_path,
    ):

        path = Path(
            local_path
        ).resolve()

        if not path.exists():

            raise RepositoryServiceError(
                "Repository path does not exist: "
                f"{path}"
            )

        if not path.is_dir():

            raise RepositoryServiceError(
                "Repository path is not a directory: "
                f"{path}"
            )

        try:

            repo = Repo(path)

        except (
            InvalidGitRepositoryError,
            GitCommandError,
        ) as exc:

            raise RepositoryServiceError(
                "Not a valid Git repository: "
                f"{path}"
            ) from exc

        return repo

    # ==========================================================
    # CHECKOUT BRANCH
    # ==========================================================

    def checkout_branch(
        self,
        repo,
        branch,
    ):

        branch = (
            str(
                branch or "main"
            ).strip()
            or "main"
        )

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

                raise RepositoryServiceError(
                    f"Unable to checkout branch "
                    f"'{branch}'."
                ) from exc

            return branch

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

            return branch

        except GitCommandError as exc:

            raise RepositoryServiceError(
                f"Branch '{branch}' does not "
                "exist in the repository."
            ) from exc

    # ==========================================================
    # PULL LATEST
    # ==========================================================

    def pull_latest(
        self,
        repo,
        branch,
    ):

        if not repo.remotes:

            return {
                "pulled": False,

                "message": (
                    "No Git remote configured."
                ),
            }

        try:

            origin = (
                repo.remotes.origin
            )

        except Exception:

            return {
                "pulled": False,

                "message": (
                    "Origin remote is not configured."
                ),
            }

        try:

            self.checkout_branch(
                repo,
                branch,
            )

            origin.pull(
                branch
            )

        except GitCommandError as exc:

            raise RepositoryServiceError(
                "Git pull failed."
            ) from exc

        return {
            "pulled": True,

            "message": (
                f"Repository updated from "
                f"origin/{branch}."
            ),
        }

    # ==========================================================
    # PREPARE REPOSITORY
    # ==========================================================

    def prepare(
        self,
        repository_url,
        branch="main",
        auth_type="NONE",
        username="",
        encrypted_token="",
    ):

        branch = (
            str(
                branch or "main"
            ).strip()
            or "main"
        )

        clone_result = self.clone(
            repository_url=repository_url,

            branch=branch,

            auth_type=auth_type,

            username=username,

            encrypted_token=encrypted_token,
        )

        path = Path(
            clone_result["path"]
        )

        repo = self.open_repository(
            path
        )

        self.checkout_branch(
            repo,
            branch,
        )

        return {
            "path": str(
                path
            ),

            "branch": branch,

            "commit": (
                repo.head.commit.hexsha[:12]
            ),

            "repository": repo,
        }

    # ==========================================================
    # TEST CONNECTION
    # ==========================================================

    def test_connection(
        self,
        repository_url,
        branch="main",
        auth_type="NONE",
        username="",
        encrypted_token="",
    ):
        """
        Test repository access.
        """

        result = self.prepare(
            repository_url=repository_url,

            branch=branch,

            auth_type=auth_type,

            username=username,

            encrypted_token=encrypted_token,
        )

        return {
            "status": "CONNECTED",

            "message": (
                "Repository connection successful."
            ),

            "repository_path": (
                result["path"]
            ),

            "branch": (
                result["branch"]
            ),

            "commit": (
                result["commit"]
            ),
        }