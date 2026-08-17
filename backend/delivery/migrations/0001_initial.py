from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    initial=True
    dependencies=[]
    operations=[
        migrations.CreateModel(name='RepositoryConfig',fields=[('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),('name',models.CharField(max_length=120)),('local_path',models.CharField(max_length=500)),('branch',models.CharField(default='main',max_length=120)),('log_directory',models.CharField(default='logs',max_length=255)),('extensions',models.JSONField(default=list)),('recipients',models.JSONField(default=list)),('email_mode',models.CharField(default='SIMULATION',max_length=30)),('active',models.BooleanField(default=True)),('created_at',models.DateTimeField(auto_now_add=True)),('updated_at',models.DateTimeField(auto_now=True))]),
        migrations.CreateModel(name='DeliveryJob',fields=[('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),('status',models.CharField(choices=[('QUEUED','Queued'),('RUNNING','Running'),('SUCCESS','Success'),('FAILED','Failed'),('DRY_RUN','Dry Run')],default='QUEUED',max_length=20)),('files_count',models.PositiveIntegerField(default=0)),('archive_name',models.CharField(blank=True,max_length=255)),('archive_size',models.PositiveBigIntegerField(default=0)),('recipients',models.JSONField(default=list)),('commit',models.CharField(blank=True,max_length=64)),('error',models.TextField(blank=True)),('started_at',models.DateTimeField(blank=True,null=True)),('finished_at',models.DateTimeField(blank=True,null=True)),('created_at',models.DateTimeField(auto_now_add=True)),('repository',models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name='jobs',to='delivery.repositoryconfig'))])
    ]
