import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
import django; django.setup()
from delivery.models import RepositoryConfig
RepositoryConfig.objects.update_or_create(name='Demo ASP.NET Core',defaults={'local_path':'../demo/demo_repository','branch':'main','log_directory':'logs','extensions':['.log','.txt','.rag'],'recipients':['demo@example.com'],'email_mode':'SIMULATION','active':True})
print('Demo repository configuration created.')
