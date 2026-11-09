from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("persistence", "0003_corridorrun")]
    operations = [
        migrations.CreateModel(
            name="ProviderBudget",
            fields=[
                ("provider", models.CharField(max_length=32, primary_key=True, serialize=False)),
                ("windows", models.JSONField(default=dict)),
            ],
        )
    ]
