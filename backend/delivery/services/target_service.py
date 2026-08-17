from pathlib import Path


class TargetServiceError(Exception):
    """
    Raised when a target path is invalid
    or cannot be resolved.
    """

    pass


class TargetService:
    """
    Resolves and collects files from inside
    a repository.

    Supports:

        1. Exact file:
            backend/requirements.txt

        2. Exact directory:
            backend/

        3. Filename anywhere:
            build.sh

            This searches the entire repository
            for matching files.

        4. Multiple targets:

            [
                {
                    "path": "backend/requirements.txt",
                    "extensions": [".txt"]
                },
                {
                    "path": "build.sh",
                    "extensions": [".sh"]
                }
            ]

    Security:

        - Target cannot escape repository root.
        - Absolute paths are rejected.
        - '..' traversal is rejected.
        - Symlinks outside repository are rejected.
        - .git directory is ignored.
        - Duplicate files are removed.
    """

    # ==========================================================
    # INITIALIZATION
    # ==========================================================

    def __init__(
        self,
        repository_root,
    ):

        self.repository_root = (
            Path(
                repository_root
            ).resolve()
        )

        if not self.repository_root.exists():

            raise TargetServiceError(
                "Repository root does not exist: "
                f"{self.repository_root}"
            )

        if not self.repository_root.is_dir():

            raise TargetServiceError(
                "Repository root is not a directory: "
                f"{self.repository_root}"
            )

    # ==========================================================
    # PATH SAFETY
    # ==========================================================

    def _ensure_inside_repository(
        self,
        path,
    ):
        """
        Make sure a resolved path remains
        inside the repository.
        """

        path = Path(
            path
        ).resolve()

        try:

            path.relative_to(
                self.repository_root
            )

        except ValueError:

            raise TargetServiceError(
                "Invalid target path. "
                "Target must remain inside "
                "the repository."
            )

        return path

    # ==========================================================
    # NORMALIZE TARGET
    # ==========================================================

    @staticmethod
    def normalize_target_path(
        target_path,
    ):
        """
        Normalize a configured target path.

        Examples:

            ./backend/app.log
            backend\\app.log
            /backend/app.log

        become safe repository-relative
        representations.
        """

        if target_path is None:

            raise TargetServiceError(
                "Target path is required."
            )

        target_path = str(
            target_path
        ).strip()

        if not target_path:

            raise TargetServiceError(
                "Target path is required."
            )

        # Windows -> platform independent.
        target_path = target_path.replace(
            "\\",
            "/",
        )

        # Remove accidental ./ prefixes.
        while target_path.startswith(
            "./"
        ):
            target_path = (
                target_path[2:]
            )

        # ------------------------------------------------------
        # Reject absolute paths
        # ------------------------------------------------------

        if target_path.startswith(
            "/"
        ):

            raise TargetServiceError(
                "Target path must be relative "
                "to the repository."
            )

        # Windows drive path:
        #
        # C:/something
        #
        if (
            len(target_path) >= 2
            and target_path[1] == ":"
        ):

            raise TargetServiceError(
                "Absolute Windows paths are "
                "not allowed."
            )

        # ------------------------------------------------------
        # Reject traversal
        # ------------------------------------------------------

        parts = [
            part
            for part in target_path.split("/")
            if part
        ]

        if ".." in parts:

            raise TargetServiceError(
                "Target path cannot contain '..'."
            )

        return "/".join(
            parts
        )

    # ==========================================================
    # EXTENSION NORMALIZATION
    # ==========================================================

    @staticmethod
    def normalize_extensions(
        extensions,
    ):
        """
        Normalize target extensions.

        Example:

            ["log", ".TXT"]

        becomes:

            {".log", ".txt"}

        Empty extensions means:

            allow all extensions
        """

        if extensions is None:
            return set()

        if not isinstance(
            extensions,
            list,
        ):

            raise TargetServiceError(
                "Target extensions must be a list."
            )

        normalized = set()

        for extension in extensions:

            extension = str(
                extension
            ).strip().lower()

            if not extension:
                continue

            if not extension.startswith(
                "."
            ):

                extension = (
                    "."
                    + extension
                )

            normalized.add(
                extension
            )

        return normalized

    # ==========================================================
    # CHECK EXTENSION
    # ==========================================================

    @staticmethod
    def matches_extension(
        path,
        extensions,
    ):
        """
        Return True when a file matches
        the configured extensions.

        Empty extensions means:

            all files allowed.
        """

        if not extensions:

            return True

        return (
            path.suffix.lower()
            in extensions
        )

    # ==========================================================
    # EXCLUDED PATH
    # ==========================================================

    def is_excluded(
        self,
        path,
    ):
        """
        Determine whether a path should be
        ignored during repository scanning.

        .git is always excluded.
        """

        try:

            relative = path.resolve().relative_to(
                self.repository_root
            )

        except ValueError:

            return True

        parts = relative.parts

        if ".git" in parts:

            return True

        return False

    # ==========================================================
    # RESOLVE EXACT TARGET
    # ==========================================================

    def resolve_target(
        self,
        target_path,
    ):
        """
        Resolve an exact target path.

        This is used when the configured
        path exists exactly.

        Examples:

            backend/build.sh
            backend/
            README.md
        """

        target_path = (
            self.normalize_target_path(
                target_path
            )
        )

        candidate = (
            self.repository_root
            / target_path
        )

        candidate = (
            self._ensure_inside_repository(
                candidate
            )
        )

        if not candidate.exists():

            raise TargetServiceError(
                f"Target does not exist: "
                f"{target_path}"
            )

        if self.is_excluded(
            candidate
        ):

            raise TargetServiceError(
                "Target is inside an excluded "
                "repository path."
            )

        return candidate

    # ==========================================================
    # FIND TARGET ANYWHERE
    # ==========================================================

    def find_target_anywhere(
        self,
        target_path,
    ):
        """
        Search the entire repository for
        a target when an exact path does
        not exist.

        Example:

            target_path = "build.sh"

        Repository:

            backend/
                build.sh

            frontend/
                build.sh

        Result:

            both build.sh files.

        If target_path contains directories,
        exact path resolution is preferred.
        """

        target_path = (
            self.normalize_target_path(
                target_path
            )
        )

        # ------------------------------------------------------
        # Search name only
        # ------------------------------------------------------

        target_name = Path(
            target_path
        ).name

        if not target_name:

            raise TargetServiceError(
                "Invalid target filename."
            )

        matches = []

        for path in self.repository_root.rglob(
            target_name
        ):

            if not path.is_file():
                continue

            if self.is_excluded(
                path
            ):
                continue

            try:

                resolved = (
                    self._ensure_inside_repository(
                        path
                    )
                )

            except TargetServiceError:

                continue

            if (
                resolved.name.lower()
                == target_name.lower()
            ):

                matches.append(
                    resolved
                )

        # ------------------------------------------------------
        # Remove duplicates
        # ------------------------------------------------------

        unique = {}

        for path in matches:

            key = str(
                path
            ).lower()

            unique[key] = path

        return sorted(
            unique.values(),
            key=lambda item: str(item).lower(),
        )

    # ==========================================================
    # TARGET TYPE
    # ==========================================================

    def get_target_type(
        self,
        target,
    ):
        """
        Return:

            FILE
            DIRECTORY
        """

        if target.is_file():

            return "FILE"

        if target.is_dir():

            return "DIRECTORY"

        raise TargetServiceError(
            f"Unsupported target: {target}"
        )

    # ==========================================================
    # COLLECT EXACT TARGET
    # ==========================================================

    def collect_exact_target(
        self,
        target,
        extensions=None,
    ):
        """
        Collect files from an exact target.
        """

        target_type = (
            self.get_target_type(
                target
            )
        )

        allowed_extensions = (
            self.normalize_extensions(
                extensions
            )
        )

        files = []

        # ======================================================
        # SINGLE FILE
        # ======================================================

        if target_type == "FILE":

            if self.is_excluded(
                target
            ):

                return []

            if self.matches_extension(
                target,
                allowed_extensions,
            ):

                files.append(
                    target
                )

            return files

        # ======================================================
        # DIRECTORY
        # ======================================================

        for path in target.rglob("*"):

            if not path.is_file():
                continue

            if self.is_excluded(
                path
            ):
                continue

            try:

                resolved = (
                    self._ensure_inside_repository(
                        path
                    )
                )

            except TargetServiceError:

                continue

            if not self.matches_extension(
                resolved,
                allowed_extensions,
            ):

                continue

            files.append(
                resolved
            )

        return files

    # ==========================================================
    # COLLECT ONE TARGET
    # ==========================================================

    def collect_target(
        self,
        target_path,
        extensions=None,
    ):
        """
        Collect files for one target.

        Behavior:

            Exact path exists
                ↓
            use exact target

            Exact path does not exist
                ↓
            search filename anywhere
        """

        normalized_target = (
            self.normalize_target_path(
                target_path
            )
        )

        # ======================================================
        # TRY EXACT PATH FIRST
        # ======================================================

        exact_candidate = (
            self.repository_root
            / normalized_target
        )

        try:

            exact_candidate = (
                self._ensure_inside_repository(
                    exact_candidate
                )
            )

        except TargetServiceError:

            raise

        if exact_candidate.exists():

            return self.collect_exact_target(
                exact_candidate,
                extensions,
            )

        # ======================================================
        # SEARCH ANYWHERE
        # ======================================================

        matches = (
            self.find_target_anywhere(
                normalized_target
            )
        )

        if not matches:

            raise TargetServiceError(
                "Target does not exist anywhere "
                f"in the repository: "
                f"{normalized_target}"
            )

        allowed_extensions = (
            self.normalize_extensions(
                extensions
            )
        )

        files = []

        for path in matches:

            if not self.matches_extension(
                path,
                allowed_extensions,
            ):

                continue

            files.append(
                path
            )

        return files

    # ==========================================================
    # COLLECT MULTIPLE TARGETS
    # ==========================================================

    def collect_targets(
        self,
        targets,
    ):
        """
        Collect files from multiple target
        configurations.

        Expected input:

            [
                {
                    "path": "backend/requirements.txt",
                    "extensions": [".txt"]
                },
                {
                    "path": "build.sh",
                    "extensions": [".sh"]
                },
                {
                    "path": "frontend/",
                    "extensions": []
                }
            ]

        Returns:

            {
                "files": [...],
                "targets": [...],
                "errors": [...]
            }
        """

        if targets is None:

            targets = []

        if not isinstance(
            targets,
            list,
        ):

            raise TargetServiceError(
                "Targets must be provided as a list."
            )

        collected_files = []

        processed_targets = []

        errors = []

        # Used to prevent duplicate files.
        seen_files = set()

        for index, target in enumerate(
            targets
        ):

            # ==================================================
            # TARGET FORMAT
            # ==================================================

            if isinstance(
                target,
                str,
            ):

                target_path = target

                extensions = []

            elif isinstance(
                target,
                dict,
            ):

                target_path = target.get(
                    "path",
                    "",
                )

                extensions = target.get(
                    "extensions",
                    [],
                )

            else:

                errors.append(
                    {
                        "target": (
                            f"Target #{index + 1}"
                        ),

                        "error": (
                            "Target must be a "
                            "string or object."
                        ),
                    }
                )

                continue

            # ==================================================
            # COLLECT
            # ==================================================

            try:

                files = self.collect_target(
                    target_path=target_path,
                    extensions=extensions,
                )

            except TargetServiceError as exc:

                errors.append(
                    {
                        "target": str(
                            target_path
                        ),

                        "error": str(
                            exc
                        ),
                    }
                )

                continue

            # ==================================================
            # DEDUPLICATE
            # ==================================================

            unique_target_files = []

            for file_path in files:

                try:

                    resolved = (
                        self._ensure_inside_repository(
                            file_path
                        )
                    )

                except TargetServiceError:

                    continue

                key = str(
                    resolved
                ).lower()

                if key in seen_files:
                    continue

                seen_files.add(
                    key
                )

                collected_files.append(
                    resolved
                )

                unique_target_files.append(
                    resolved
                )

            processed_targets.append(
                {
                    "path": str(
                        target_path
                    ),

                    "extensions": (
                        list(
                            self.normalize_extensions(
                                extensions
                            )
                        )
                    ),

                    "files_count": len(
                        unique_target_files
                    ),

                    "files": [
                        str(path)
                        for path
                        in unique_target_files
                    ],
                }
            )

        # ======================================================
        # RESULT
        # ======================================================

        return {
            "files": collected_files,

            "targets": processed_targets,

            "errors": errors,
        }

    # ==========================================================
    # BACKWARD COMPATIBILITY
    # ==========================================================

    def collect_files(
        self,
        target_path,
        extensions=None,
    ):
        """
        Existing single-target API.

        This method is intentionally preserved
        so existing DeliveryEngine code does
        not immediately break.

        New code should use collect_targets().
        """

        result = self.collect_target(
            target_path=target_path,
            extensions=extensions,
        )

        return result

    # ==========================================================
    # PREVIEW SINGLE TARGET
    # ==========================================================

    def preview(
        self,
        target_path,
        extensions=None,
    ):
        """
        Preview one target without creating
        an archive.
        """

        files = self.collect_files(
            target_path,
            extensions,
        )

        normalized_target = (
            self.normalize_target_path(
                target_path
            )
        )

        exact_target = (
            self.repository_root
            / normalized_target
        )

        if exact_target.exists():

            target = (
                self._ensure_inside_repository(
                    exact_target
                )
            )

            target_type = (
                self.get_target_type(
                    target
                )
            )

            relative_target = str(
                target.relative_to(
                    self.repository_root
                )
            )

        else:

            target = None

            target_type = (
                "SEARCH"
            )

            relative_target = (
                normalized_target
            )

        total_size = 0

        file_data = []

        for file_path in files:

            try:

                size = (
                    file_path.stat().st_size
                )

            except OSError:

                size = 0

            total_size += size

            file_data.append(
                {
                    "name": file_path.name,

                    "path": str(
                        file_path.relative_to(
                            self.repository_root
                        )
                    ),

                    "size": size,
                }
            )

        return {
            "target": (
                str(target)
                if target
                else normalized_target
            ),

            "target_type": target_type,

            "relative_target": (
                relative_target
            ),

            "files_count": len(
                files
            ),

            "total_size": total_size,

            "files": file_data,
        }

    # ==========================================================
    # PREVIEW MULTIPLE TARGETS
    # ==========================================================

    def preview_targets(
        self,
        targets,
    ):
        """
        Preview multiple targets.
        """

        result = self.collect_targets(
            targets
        )

        total_size = 0

        files = []

        for file_path in result[
            "files"
        ]:

            try:

                size = (
                    file_path.stat().st_size
                )

            except OSError:

                size = 0

            total_size += size

            files.append(
                {
                    "name": file_path.name,

                    "path": str(
                        file_path.relative_to(
                            self.repository_root
                        )
                    ),

                    "size": size,
                }
            )

        return {
            "targets": result[
                "targets"
            ],

            "files": files,

            "files_count": len(
                files
            ),

            "total_size": total_size,

            "errors": result[
                "errors"
            ],
        }