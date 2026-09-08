from django.urls import path

from .views import (
    DashboardView,
    RepositoryListView,
    RepositoryDetailView,
    RepositoryActivateView,
    RepositoryBranchesView,
    RepositoryBranchesPreviewView,
    RepositoryTestConnectionView,
    JobListView,
    JobDetailView,
    HealthView,
)


urlpatterns = [

    # ==========================================================
    # SYSTEM
    # ==========================================================

    path(
        "health/",
        HealthView.as_view(),
        name="health",
    ),

    # ==========================================================
    # DASHBOARD
    # ==========================================================

    path(
        "dashboard/",
        DashboardView.as_view(),
        name="dashboard",
    ),

    # ==========================================================
    # REPOSITORIES
    # ==========================================================

    path(
        "repositories/",
        RepositoryListView.as_view(),
        name="repository-list",
    ),

    # ----------------------------------------------------------
    # BRANCH PREVIEW
    #
    # Used BEFORE a repository is saved.
    #
    # Supports:
    #   Public repository  -> NONE
    #   Private repository -> PAT
    # ----------------------------------------------------------

    path(
        "repositories/branches/preview/",
        RepositoryBranchesPreviewView.as_view(),
        name="repository-branches-preview",
    ),

    path(
        "repositories/<int:pk>/",
        RepositoryDetailView.as_view(),
        name="repository-detail",
    ),

    # ----------------------------------------------------------
    # ACTIVATE REPOSITORY
    #
    # Reactivates an existing deactivated repository.
    # ----------------------------------------------------------

    path(
        "repositories/<int:pk>/activate/",
        RepositoryActivateView.as_view(),
        name="repository-activate",
    ),

    path(
        "repositories/<int:pk>/test/",
        RepositoryTestConnectionView.as_view(),
        name="repository-test-connection",
    ),

    # ----------------------------------------------------------
    # SAVED REPOSITORY BRANCHES
    # ----------------------------------------------------------

    path(
        "repositories/<int:pk>/branches/",
        RepositoryBranchesView.as_view(),
        name="repository-branches",
    ),

    # ==========================================================
    # DELIVERY JOBS
    # ==========================================================

    path(
        "jobs/",
        JobListView.as_view(),
        name="job-list",
    ),

    path(
        "jobs/<int:pk>/",
        JobDetailView.as_view(),
        name="job-detail",
    ),
]