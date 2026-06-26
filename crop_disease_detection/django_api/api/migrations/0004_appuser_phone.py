from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_appuser'),
    ]

    operations = [
        migrations.AddField(
            model_name='appuser',
            name='phone',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
