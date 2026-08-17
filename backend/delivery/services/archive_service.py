from pathlib import Path
from datetime import datetime
import zipfile


class ArchiveServiceError(Exception):
    """Raised when archive creation fails."""
    pass


class ArchiveService:
    """
    Creates ZIP archives from files selected inside
    a repository.

    Files are stored using paths relative to the
    repository root.
    """

    def __init__(self, output_directory="archives"):
        self.output_directory = Path(
            output_directory
        )

        self.output_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

    # ==========================================================
    # CREATE ARCHIVE
    # ==========================================================

    def create(
        self,
        repository_root,
        files,
        prefix="ApplicationLogs",
    ):
        """
        Create a ZIP archive containing the supplied files.

        Parameters:

            repository_root:
                Root directory of cloned repository.

            files:
                List of Path objects returned by
                TargetService.

            prefix:
                Name prefix for generated archive.
        """

        repository_root = Path(
            repository_root
        ).resolve()

        if not repository_root.exists():
            raise ArchiveServiceError(
                f"Repository root does not exist: "
                f"{repository_root}"
            )

        if not files:
            raise ArchiveServiceError(
                "No files were provided for archiving."
            )

        # ======================================================
        # VALIDATE FILES
        # ======================================================

        validated_files = []

        for file_path in files:

            file_path = Path(
                file_path
            ).resolve()

            if not file_path.exists():
                raise ArchiveServiceError(
                    f"File does not exist: "
                    f"{file_path}"
                )

            if not file_path.is_file():
                raise ArchiveServiceError(
                    f"Target is not a file: "
                    f"{file_path}"
                )

            # Security check:
            # file must remain inside repository.
            try:

                file_path.relative_to(
                    repository_root
                )

            except ValueError:

                raise ArchiveServiceError(
                    "Security violation: "
                    f"file is outside repository: "
                    f"{file_path}"
                )

            validated_files.append(
                file_path
            )

        # ======================================================
        # ARCHIVE NAME
        # ======================================================

        timestamp = datetime.now().strftime(
            "%Y-%m-%d_%H%M%S"
        )

        archive_name = (
            f"{prefix}_{timestamp}.zip"
        )

        archive_path = (
            self.output_directory
            / archive_name
        )

        # ======================================================
        # CREATE ZIP
        # ======================================================

        try:

            with zipfile.ZipFile(
                archive_path,
                mode="w",
                compression=zipfile.ZIP_DEFLATED,
            ) as archive:

                for file_path in validated_files:

                    relative_path = (
                        file_path.relative_to(
                            repository_root
                        )
                    )

                    archive.write(
                        file_path,
                        relative_path.as_posix(),
                    )

        except Exception as exc:

            # Remove partially-created archive.
            if archive_path.exists():

                try:
                    archive_path.unlink()
                except OSError:
                    pass

            raise ArchiveServiceError(
                f"Failed to create archive: "
                f"{exc}"
            ) from exc

        # ======================================================
        # ARCHIVE INFORMATION
        # ======================================================

        if not archive_path.exists():
            raise ArchiveServiceError(
                "Archive creation completed "
                "but the archive file was not found."
            )

        archive_size = (
            archive_path.stat().st_size
        )

        return {
            "archive_name": archive_name,
            "archive_path": str(
                archive_path.resolve()
            ),
            "archive_size": archive_size,
            "files_count": len(
                validated_files
            ),
            "files": [
                str(
                    file.relative_to(
                        repository_root
                    )
                )
                for file in validated_files
            ],
        }

    # ==========================================================
    # VERIFY ARCHIVE
    # ==========================================================

    def verify(
        self,
        archive_path,
    ):
        """
        Verify that the generated ZIP is valid.
        """

        archive_path = Path(
            archive_path
        ).resolve()

        if not archive_path.exists():
            raise ArchiveServiceError(
                f"Archive does not exist: "
                f"{archive_path}"
            )

        if not zipfile.is_zipfile(
            archive_path
        ):
            raise ArchiveServiceError(
                "Generated file is not a valid ZIP archive."
            )

        try:

            with zipfile.ZipFile(
                archive_path,
                "r",
            ) as archive:

                corrupt_file = (
                    archive.testzip()
                )

                if corrupt_file:
                    raise ArchiveServiceError(
                        "Archive contains a corrupt file: "
                        f"{corrupt_file}"
                    )

                names = archive.namelist()

        except zipfile.BadZipFile as exc:

            raise ArchiveServiceError(
                "Invalid ZIP archive."
            ) from exc

        return {
            "valid": True,
            "archive_path": str(
                archive_path
            ),
            "files_count": len(
                names
            ),
            "files": names,
            "size": archive_path.stat().st_size,
        }