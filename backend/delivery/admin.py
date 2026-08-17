from django.contrib import admin
from .models import RepositoryConfig, DeliveryJob
admin.site.register(RepositoryConfig)
admin.site.register(DeliveryJob)
