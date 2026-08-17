from pathlib import Path
from urllib import request
from uuid import uuid4

from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)

from .models import (
    RepositoryConfig,
    RepositoryCredential,
    DeliveryJob,
)

from .serializers import (
    RepositorySerializer,
    JobSerializer,
)

from .services.engine import DeliveryEngine

from .services.repository_service import (
    RepositoryService,
    RepositoryServiceError,
)

from .services.email_service import (
    EmailService,
    EmailDeliveryError,
)

from .services.security_service import (
    SecurityService,
    SecurityViolation,
)


# ==========================================================
# DASHBOARD
# ==========================================================

class DashboardView(APIView):
    """
    Da
    shboard summary and recent delivery activity.
    """
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        jobs = DeliveryJob.objects.select_related(
            "repository"
        )

        stats = {
            "total": jobs.count(),

            "success": jobs.filter(
                status=DeliveryJob.Status.SUCCESS
            ).count(),

            "failed": jobs.filter(
                status=DeliveryJob.Status.FAILED
            ).count(),

            "dry_run": jobs.filter(
                status=DeliveryJob.Status.DRY_RUN
            ).count(),
        }

        recent_jobs = (
            jobs
            .order_by("-created_at")[:8]
        )

        return Response(
            {
                "stats": stats,

                "recent": JobSerializer(
                    recent_jobs,
                    many=True,
                ).data,
            }
        )


# ==========================================================
# REPOSITORIES
# ==========================================================
from rest_framework.permissions import (
    IsAuthenticated,
)

from authentication.permissions import (
    IsAdmin,
    IsManagerOrAdmin,
)
class RepositoryListView(APIView):

    def get_permissions(self):
        if self.request.method == "GET":
            return [
                IsAuthenticated()
            ]

        return [
            IsManagerOrAdmin()
        ]

    def get(self, request):

        repositories = (
            RepositoryConfig.objects
            .filter(active=True)
            .prefetch_related("credential")
            .order_by("name")
        )

        serializer = RepositorySerializer(
            repositories,
            many=True,
        )

        return Response(
            serializer.data
        )

    def post(self, request):

        serializer = RepositorySerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        repository = serializer.save()

        return Response(
            RepositorySerializer(
                repository
            ).data,
            status=status.HTTP_201_CREATED,
        )


# ==========================================================
# REPOSITORY DETAIL
# ==========================================================

class RepositoryDetailView(APIView):

    def get_permissions(self):

        if self.request.method == "GET":
            return [
                IsAuthenticated()
            ]

        if self.request.method in {
            "PUT",
            "PATCH",
        }:
            return [
                IsManagerOrAdmin()
            ]

        if self.request.method == "DELETE":
            return [
                IsAdmin()
            ]

        return [
            IsAuthenticated()
        ]

    def get_repository(self, pk):

        return get_object_or_404(
            RepositoryConfig.objects
            .prefetch_related("credential"),
            pk=pk,
        )

    # ------------------------------------------------------
    # GET
    # ------------------------------------------------------

    def get(self, request, pk):

        repository = self.get_repository(pk)

        return Response(
            RepositorySerializer(
                repository
            ).data
        )

    # ------------------------------------------------------
    # PUT
    # ------------------------------------------------------

    def put(self, request, pk):

        repository = self.get_repository(pk)

        serializer = RepositorySerializer(
            repository,
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True
        )

        repository = serializer.save()

        return Response(
            RepositorySerializer(
                repository
            ).data
        )

    # ------------------------------------------------------
    # PATCH
    # ------------------------------------------------------

    def patch(self, request, pk):

        repository = self.get_repository(pk)

        serializer = RepositorySerializer(
            repository,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        repository = serializer.save()

        return Response(
            RepositorySerializer(
                repository
            ).data
        )

    # ------------------------------------------------------
    # DELETE
    # ------------------------------------------------------

    def delete(self, request, pk):

        repository = self.get_repository(pk)

        repository.active = False

        repository.save(
            update_fields=[
                "active",
                "updated_at",
            ]
        )

        return Response(
            {
                "message": (
                    "Repository deactivated successfully."
                )
            }
        )


# ==========================================================
# TEST REPOSITORY CONNECTION
# ==========================================================
class RepositoryTestConnectionView(APIView):

    permission_classes = [
        IsManagerOrAdmin
    ]

    def post(self, request, pk):

        repository = get_object_or_404(
            RepositoryConfig,
            pk=pk,
            active=True,
        )

        try:

            credential = (
                RepositoryCredential.objects
                .filter(
                    repository=repository
                )
                .first()
            )

            if credential:

                auth_type = (
                    credential.auth_type
                )

                username = (
                    credential.username
                )

                encrypted_token = (
                    credential.encrypted_token
                )

            else:

                auth_type = (
                    RepositoryCredential.AuthType.NONE
                )

                username = ""

                encrypted_token = ""

            # ==================================================
            # LOCAL
            # ==================================================

            if (
                repository.repository_type
                == RepositoryConfig.RepositoryType.LOCAL
            ):

                engine = DeliveryEngine(
                    repository
                )

                result = (
                    engine.validate_repository()
                )

            # ==================================================
            # REMOTE
            # ==================================================

            else:

                service = RepositoryService()

                result = service.test_connection(
                    repository_url=(
                        repository.repository_url
                    ),

                    branch=(
                        repository.branch
                    ),

                    auth_type=auth_type,

                    username=username,

                    encrypted_token=(
                        encrypted_token
                    ),
                )

            repository.connection_status = (
                "CONNECTED"
            )

            repository.last_connection_check = (
                timezone.now()
            )

            repository.save(
                update_fields=[
                    "connection_status",
                    "last_connection_check",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "status": "CONNECTED",

                    "message": (
                        "Repository connection successful."
                    ),

                    "details": result,

                    "repository": {
                        "id": repository.id,

                        "name": repository.name,

                        "repository_type": (
                            repository.repository_type
                        ),

                        "repository_url": (
                            repository.repository_url
                        ),

                        "branch": (
                            repository.branch
                        ),

                        "target_path": (
                            repository.target_path
                        ),

                        "targets": (
                            repository.targets or []
                        ),
                    },
                }
            )

        except RepositoryServiceError as exc:

            repository.connection_status = (
                "FAILED"
            )

            repository.last_connection_check = (
                timezone.now()
            )

            repository.save(
                update_fields=[
                    "connection_status",
                    "last_connection_check",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "status": "FAILED",

                    "message": (
                        "Repository connection failed."
                    ),

                    "error": str(exc),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:

            repository.connection_status = (
                "FAILED"
            )

            repository.last_connection_check = (
                timezone.now()
            )

            repository.save(
                update_fields=[
                    "connection_status",
                    "last_connection_check",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "status": "FAILED",

                    "message": (
                        "Repository connection failed."
                    ),

                    "error": str(exc),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )


# ==========================================================
# REPOSITORY BRANCHES
# ==========================================================
class RepositoryBranchesView(APIView):

    permission_classes = [
        IsManagerOrAdmin
    ]

    def get(self, request, pk):

        repository = get_object_or_404(
            RepositoryConfig,
            pk=pk,
            active=True,
        )

        try:

            # ==================================================
            # LOCAL REPOSITORY
            # ==================================================

            if (
                repository.repository_type
                == RepositoryConfig.RepositoryType.LOCAL
            ):

                engine = DeliveryEngine(
                    repository
                )

                validation = (
                    engine.validate_repository()
                )

                repository_path = Path(
                    validation["repository_path"]
                )

                from git import Repo

                repo = Repo(
                    repository_path
                )

                branches = sorted(
                    {
                        branch.name
                        for branch in repo.branches
                    },
                    key=lambda value: value.lower(),
                )

            # ==================================================
            # REMOTE REPOSITORY
            # ==================================================

            else:

                credential = (
                    RepositoryCredential.objects
                    .filter(
                        repository=repository
                    )
                    .first()
                )

                if credential:

                    auth_type = (
                        credential.auth_type
                    )

                    username = (
                        credential.username
                    )

                    encrypted_token = (
                        credential.encrypted_token
                    )

                else:

                    auth_type = (
                        RepositoryCredential.AuthType.NONE
                    )

                    username = ""

                    encrypted_token = ""

                service = RepositoryService()

                branch_result = service.get_branches(
                    repository_url=(
                        repository.repository_url
                    ),

                    auth_type=auth_type,

                    username=username,

                    encrypted_token=encrypted_token,
                )

                # ==================================================
                # IMPORTANT
                # ==================================================
                # get_branches() returns a dictionary:
                #
                # {
                #     "status": "...",
                #     "message": "...",
                #     "branches": [...]
                # }
                #
                # Extract only the actual branch list.
                # ==================================================

                if isinstance(
                    branch_result,
                    dict,
                ):

                    branches = branch_result.get(
                        "branches",
                        [],
                    )

                else:

                    branches = branch_result

                if not isinstance(
                    branches,
                    list,
                ):

                    branches = list(
                        branches
                    )

            # ==================================================
            # CURRENT BRANCH
            # ==================================================

            current_branch = ""

            if repository.branch in branches:

                current_branch = (
                    repository.branch
                )

            elif "main" in branches:

                current_branch = "main"

            elif "master" in branches:

                current_branch = "master"

            elif branches:

                current_branch = branches[0]

            return Response(
                {
                    "status": "CONNECTED",

                    "message": (
                        "Repository branches "
                        "fetched successfully."
                    ),

                    "repository": {
                        "id": repository.id,

                        "name": repository.name,

                        "repository_type": (
                            repository.repository_type
                        ),

                        "repository_url": (
                            repository.repository_url
                        ),
                    },

                    "current_branch": (
                        current_branch
                    ),

                    "branches": branches,
                }
            )

        except RepositoryServiceError as exc:

            return Response(
                {
                    "status": "FAILED",

                    "message": (
                        "Unable to fetch "
                        "repository branches."
                    ),

                    "error": str(exc),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:

            return Response(
                {
                    "status": "FAILED",

                    "message": (
                        "Unable to fetch "
                        "repository branches."
                    ),

                    "error": str(exc),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )


# ==========================================================
# NEW REPOSITORY BRANCH PREVIEW
# ==========================================================

class RepositoryBranchesPreviewView(APIView):
    """
    Fetch repository branches BEFORE the repository
    is saved in the database.

    Public repository:
        auth_type = NONE

    Private repository:
        auth_type = PAT

    The PAT is used only for this request.
    It is NOT stored in the database.
    """

    def post(self, request):

        # ==================================================
        # REPOSITORY URL
        # ==================================================

        repository_url = str(
            request.data.get(
                "repository_url",
                "",
            )
            or ""
        ).strip()

        if not repository_url:

            return Response(
                {
                    "status": "FAILED",

                    "message": (
                        "Repository URL is required."
                    ),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        # ==================================================
        # AUTH TYPE
        # ==================================================

        auth_type = str(
            request.data.get(
                "auth_type",
                "NONE",
            )
            or "NONE"
        ).strip().upper()

        allowed_auth_types = {
            RepositoryCredential.AuthType.NONE,
            RepositoryCredential.AuthType.PAT,
        }

        if auth_type not in allowed_auth_types:

            return Response(
                {
                    "status": "FAILED",

                    "message": (
                        "Unsupported authentication type."
                    ),

                    "error": (
                        "Use NONE for public repositories "
                        "or PAT for private repositories."
                    ),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        # ==================================================
        # USERNAME
        # ==================================================

        username = str(
            request.data.get(
                "username",
                "",
            )
            or ""
        ).strip()

        # ==================================================
        # ACCESS TOKEN
        # ==================================================

        access_token = str(
            request.data.get(
                "access_token",
                "",
            )
            or ""
        ).strip()

        # Support alternate frontend names.

        if not access_token:

            access_token = str(
                request.data.get(
                    "token",
                    "",
                )
                or ""
            ).strip()

        if not access_token:

            access_token = str(
                request.data.get(
                    "pat",
                    "",
                )
                or ""
            ).strip()

        # ==================================================
        # PUBLIC REPOSITORY
        # ==================================================

        if (
            auth_type
            == RepositoryCredential.AuthType.NONE
        ):

            username = ""

            encrypted_token = ""

        # ==================================================
        # PRIVATE REPOSITORY
        # ==================================================

        else:

            if not access_token:

                return Response(
                    {
                        "status": "FAILED",

                        "message": (
                            "Personal Access Token "
                            "is required for a private "
                            "repository."
                        ),
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:

                encrypted_token = (
                    SecurityService.encrypt_secret(
                        access_token
                    )
                )

            except SecurityViolation as exc:

                return Response(
                    {
                        "status": "FAILED",

                        "message": (
                            "Unable to process "
                            "repository credential."
                        ),

                        "error": str(exc),
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ==================================================
        # FETCH BRANCHES
        # ==================================================

        try:

            service = RepositoryService()

            branch_result = service.get_branches(
                repository_url=(
                    repository_url
                ),

                auth_type=(
                    auth_type
                ),

                username=(
                    username
                ),

                encrypted_token=(
                    encrypted_token
                ),
            )

            # ==================================================
            # IMPORTANT FIX
            # ==================================================
            #
            # RepositoryService.get_branches()
            # returns:
            #
            # {
            #     "status": "CONNECTED",
            #     "message": "...",
            #     "branches": [...]
            # }
            #
            # Extract the actual list.
            # ==================================================

            if isinstance(
                branch_result,
                dict,
            ):

                branches = branch_result.get(
                    "branches",
                    [],
                )

            else:

                branches = branch_result

            if not isinstance(
                branches,
                list,
            ):

                branches = list(
                    branches
                )

            # ==================================================
            # VALIDATE RESULT
            # ==================================================

            if not branches:

                raise RepositoryServiceError(
                    "No branches were found "
                    "in the repository."
                )

            # ==================================================
            # CURRENT BRANCH
            # ==================================================

            if "main" in branches:

                current_branch = "main"

            elif "master" in branches:

                current_branch = "master"

            else:

                current_branch = branches[0]

            # ==================================================
            # REPOSITORY TYPE
            # ==================================================

            if "github.com" in repository_url.lower():

                repository_type = (
                    RepositoryConfig.RepositoryType.GITHUB
                )

            else:

                repository_type = "REMOTE"

            # ==================================================
            # RESPONSE
            # ==================================================

            return Response(
                {
                    "status": "CONNECTED",

                    "message": (
                        "Repository branches "
                        "fetched successfully."
                    ),

                    "repository": {
                        "repository_type": (
                            repository_type
                        ),

                        "repository_url": (
                            repository_url
                        ),
                    },

                    "current_branch": (
                        current_branch
                    ),

                    "branches": (
                        branches
                    ),
                },

                status=status.HTTP_200_OK,
            )

        except RepositoryServiceError as exc:

            return Response(
                {
                    "status": "FAILED",

                    "message": (
                        "Unable to fetch "
                        "repository branches."
                    ),

                    "error": str(exc),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        except SecurityViolation as exc:

            return Response(
                {
                    "status": "FAILED",

                    "message": (
                        "Unable to process "
                        "repository credential."
                    ),

                    "error": str(exc),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:

            return Response(
                {
                    "status": "FAILED",

                    "message": (
                        "Unable to fetch "
                        "repository branches."
                    ),

                    "error": (
                        f"{type(exc).__name__}: {exc}"
                    ),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )


# ==========================================================
# DELIVERY JOBS
# ==========================================================

class JobListView(APIView):
    """
    List delivery jobs and execute new jobs.

    Multiple targets are supported.
    """

    permission_classes = [
        IsAuthenticated
    ]

    # ------------------------------------------------------
    # GET JOBS
    # ------------------------------------------------------

    def get(self, request):

        jobs = (
            DeliveryJob.objects
            .select_related("repository")
            .order_by("-created_at")[:100]
        )

        return Response(
            JobSerializer(
                jobs,
                many=True,
            ).data
        )

    # ------------------------------------------------------
    # CREATE JOB
    # ------------------------------------------------------

    def post(self, request):

        # ==================================================
        # REPOSITORY
        # ==================================================

        repository_id = request.data.get(
            "repository_id"
        )

        if not repository_id:

            return Response(
                {
                    "error": (
                        "repository_id is required."
                    )
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        repository = get_object_or_404(
            RepositoryConfig,
            pk=repository_id,
            active=True,
        )

        # ==================================================
        # DRY RUN
        # ==================================================

        dry = self.parse_boolean(
            request.data.get(
                "dry_run",
                False,
            )
        )

        # ==================================================
        # TARGETS
        # ==================================================

        request_targets = request.data.get(
            "targets",
            None,
        )

        if request_targets is not None:

            if not isinstance(
                request_targets,
                list,
            ):

                return Response(
                    {
                        "error": (
                            "targets must be a list."
                        )
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

            targets = request_targets

        else:

            targets = (
                repository.targets or []
            )

        # ==================================================
        # BACKWARD COMPATIBILITY
        # ==================================================

        if not targets:

            legacy_target = (
                repository.target_path
            )

            if legacy_target:

                targets = [
                    {
                        "path": legacy_target,

                        "extensions": (
                            repository.extensions
                            or []
                        ),
                    }
                ]

        # ==================================================
        # TARGET VALIDATION
        # ==================================================

        if not targets:

            return Response(
                {
                    "error": (
                        "At least one target file "
                        "or folder is required."
                    )
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        cleaned_targets = []

        seen = set()

        for index, target in enumerate(
            targets
        ):

            if not isinstance(
                target,
                dict,
            ):

                return Response(
                    {
                        "error": (
                            f"Target #{index + 1} "
                            "must be an object."
                        )
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

            target_path = str(
                target.get(
                    "path",
                    "",
                )
            ).strip()

            if not target_path:

                return Response(
                    {
                        "error": (
                            f"Target #{index + 1} "
                            "path is required."
                        )
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

            target_path = (
                target_path
                .replace(
                    "\\",
                    "/",
                )
            )

            while target_path.startswith(
                "./"
            ):

                target_path = (
                    target_path[2:]
                )

            normalized = (
                target_path.lower()
            )

            if normalized in seen:

                return Response(
                    {
                        "error": (
                            f"Duplicate target: "
                            f"{target_path}"
                        )
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

            seen.add(
                normalized
            )

            extensions = target.get(
                "extensions",
                [],
            )

            if extensions is None:

                extensions = []

            if not isinstance(
                extensions,
                list,
            ):

                return Response(
                    {
                        "error": (
                            f"Extensions for "
                            f"'{target_path}' "
                            "must be a list."
                        )
                    },

                    status=status.HTTP_400_BAD_REQUEST,
                )

            cleaned_extensions = []

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

                if (
                    extension
                    not in cleaned_extensions
                ):

                    cleaned_extensions.append(
                        extension
                    )

            cleaned_targets.append(
                {
                    "path": target_path,

                    "extensions": (
                        cleaned_extensions
                    ),
                }
            )

        # ==================================================
        # RECIPIENTS
        # ==================================================

        requested_recipients = (
            request.data.get(
                "recipients"
            )
        )

        if requested_recipients:

            recipients = (
                requested_recipients
            )

        else:

            recipients = (
                repository.recipients
            )

        try:

            recipients = (
                EmailService.normalize_recipients(
                    recipients
                )
            )

        except EmailDeliveryError as exc:

            return Response(
                {
                    "error": str(exc)
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        # ==================================================
        # SUBJECT
        # ==================================================

        subject = request.data.get(
            "subject"
        )

        if not subject:

            subject = (
                f"Application Files Delivered — "
                f"{repository.name}"
            )

        # ==================================================
        # EMAIL BODY
        # ==================================================

   

        email_body = request.data.get(
            "message"
        )

        if not email_body:

            target_lines = "\n".join(
                [
                    f"✓ {target['path']}"
                    for target in cleaned_targets
                ]
            )

            email_body = (
                f"Hi Team,\n\n"

                f"The requested application files have been "
                f"successfully collected from the repository "
                f"and are attached to this email.\n\n"

                f"────────────────────────────────────\n"
                f"REPOSITORY INFORMATION\n"
                f"────────────────────────────────────\n\n"

                f"Repository     : {repository.name}\n"
                f"Provider       : {repository.repository_type}\n"
                f"Branch         : {repository.branch}\n\n"

                f"────────────────────────────────────\n"
                f"FILES INCLUDED\n"
                f"────────────────────────────────────\n\n"

                f"{target_lines}\n\n"

                f"────────────────────────────────────\n\n"

                f"The files listed above are attached to this email.\n\n"

                f"This message was generated automatically by\n"
                f"Log Delivery Management.\n\n"

                f"Regards,\n"
                f"Log Delivery Management\n"
                f"Automated Delivery System"
            )

        # ==================================================
        # EMAIL MODE
        # ==================================================

        email_mode = (
            str(
                repository.email_mode
                or ""
            )
            .strip()
            .upper()
        )

        # ==================================================
        # JOB REFERENCE
        # ==================================================

        job_reference = (
            f"JOB-"
            f"{timezone.now():%Y%m%d-%H%M%S}-"
            f"{uuid4().hex[:6].upper()}"
        )

        # ==================================================
        # CREATE JOB
        # ==================================================

        job = DeliveryJob.objects.create(

            job_reference=job_reference,

            repository=repository,

            status=(
                DeliveryJob.Status.RUNNING
            ),

            is_dry_run=dry,

            started_at=timezone.now(),

            recipients=recipients,
        )

        try:

            # ==================================================
            # TEMPORARY TARGET SELECTION
            # ==================================================

            original_targets = (
                repository.targets
            )

            repository.targets = (
                cleaned_targets
            )

            try:

                result = (
                    DeliveryEngine(
                        repository
                    ).run(
                        dry_run=dry
                    )
                )

            finally:

                repository.targets = (
                    original_targets
                )

            files = result.get(
                "files",
                [],
            )

            # ==================================================
            # SAVE JOB INFORMATION
            # ==================================================

            job.files_count = len(
                files
            )

            job.archive_name = (
                result.get(
                    "archive_name",
                    "",
                )
            )

            job.archive_path = (
                result.get(
                    "archive_path",
                    "",
                )
            )

            job.archive_size = (
                result.get(
                    "archive_size",
                    0,
                )
            )

            job.commit = (
                result.get(
                    "commit",
                    "",
                )
            )

            # ==================================================
            # DRY RUN
            # ==================================================

            if dry:

                job.status = (
                    DeliveryJob.Status.DRY_RUN
                )

                job.finished_at = (
                    timezone.now()
                )

                job.save()

                response_data = (
                    JobSerializer(
                        job
                    ).data
                )

                response_data["targets"] = (
                    cleaned_targets
                )

                response_data["target"] = {
                    "files_count": len(
                        files
                    ),

                    "files": [
                        str(file)
                        for file in files
                    ],
                }

                return Response(
                    response_data,

                    status=(
                        status.HTTP_201_CREATED
                    ),
                )

            # ==================================================
            # REAL EMAIL DELIVERY
            # ==================================================

            if email_mode != "SMTP":

                raise EmailDeliveryError(
                    "Real email delivery was requested, "
                    "but the repository email mode is "
                    f"'{email_mode or 'NOT CONFIGURED'}'. "
                    "Set email_mode to 'SMTP' before "
                    "running a real delivery."
                )

            # ==================================================
            # ARCHIVE
            # ==================================================

            archive_path = result.get(
                "archive_path"
            )

            if not archive_path:

                archive_name = (
                    result.get(
                        "archive_name"
                    )
                )

                if not archive_name:

                    raise EmailDeliveryError(
                        "Delivery engine did not "
                        "return an archive path "
                        "or archive name."
                    )

                archive_path = (
                    Path("archives")
                    / archive_name
                )

            archive_path = Path(
                archive_path
            )

            if not archive_path.exists():

                raise EmailDeliveryError(
                    f"Archive was not found: "
                    f"{archive_path}"
                )

            # ==================================================
            # SEND EMAIL
            # ==================================================

            email_service = (
                EmailService()
            )

            email_result = (
                email_service.send(
                    recipients=recipients,

                    subject=subject,

                    body=email_body,

                    attachment_path=(
                        archive_path
                    ),
                )
            )

            # ==================================================
            # SUCCESS
            # ==================================================

            job.status = (
                DeliveryJob.Status.SUCCESS
            )

            job.finished_at = (
                timezone.now()
            )

            job.save()

            response_data = (
                JobSerializer(
                    job
                ).data
            )

            response_data["email"] = {
                "status": (
                    email_result.get(
                        "status"
                    )
                ),

                "recipients": (
                    email_result.get(
                        "recipients"
                    )
                ),

                "subject": (
                    email_result.get(
                        "subject"
                    )
                ),
            }

            response_data["targets"] = (
                cleaned_targets
            )

            response_data["target"] = {
                "files_count": len(
                    files
                ),
            }

            return Response(
                response_data,

                status=(
                    status.HTTP_201_CREATED
                ),
            )

        except EmailDeliveryError as exc:

            job.status = (
                DeliveryJob.Status.FAILED
            )

            job.error = str(exc)

            job.finished_at = (
                timezone.now()
            )

            job.save()

            return Response(
                {
                    **JobSerializer(
                        job
                    ).data,

                    "targets": (
                        cleaned_targets
                    ),

                    "error_type": (
                        "EMAIL_DELIVERY_ERROR"
                    ),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:

            job.status = (
                DeliveryJob.Status.FAILED
            )

            job.error = str(exc)

            job.finished_at = (
                timezone.now()
            )

            job.save()

            return Response(
                {
                    **JobSerializer(
                        job
                    ).data,

                    "targets": (
                        cleaned_targets
                    ),

                    "error_type": (
                        "DELIVERY_ERROR"
                    ),
                },

                status=status.HTTP_400_BAD_REQUEST,
            )

    # ==========================================================
    # BOOLEAN PARSER
    # ==========================================================

    @staticmethod
    def parse_boolean(value):

        if isinstance(
            value,
            bool,
        ):

            return value

        if isinstance(
            value,
            int,
        ):

            return value == 1

        if isinstance(
            value,
            str,
        ):

            return (
                value.strip().lower()
                in {
                    "true",
                    "1",
                    "yes",
                    "y",
                }
            )

        return False


# ==========================================================
# JOB DETAIL
# ==========================================================

class JobDetailView(APIView):
    """
    Retrieve a single delivery job.
    """
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request, pk):

        job = get_object_or_404(
            DeliveryJob.objects.select_related(
                "repository"
            ),
            pk=pk,
        )

        response_data = (
            JobSerializer(
                job
            ).data
        )

        response_data["targets"] = (
            job.repository.targets or []
        )

        return Response(
            response_data
        )


# ==========================================================
# HEALTH
# ==========================================================

class HealthView(APIView):
    """
    API health check.
    """
    permission_classes = [
        AllowAny
    ]

    def get(self, request):

        return Response(
            {
                "status": "ok",

                "service": (
                    "log-delivery-api"
                ),
            }
        )