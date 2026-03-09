from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_salarygrade"),
    ]

    operations = [
        migrations.AddField(
            model_name="salarygrade",
            name="step_1",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[MinValueValidator(Decimal("0.00"))]),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="salarygrade",
            name="step_2",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[MinValueValidator(Decimal("0.00"))]),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="salarygrade",
            name="step_3",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[MinValueValidator(Decimal("0.00"))]),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="salarygrade",
            name="step_4",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[MinValueValidator(Decimal("0.00"))]),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="salarygrade",
            name="step_5",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[MinValueValidator(Decimal("0.00"))]),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="salarygrade",
            name="step_6",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[MinValueValidator(Decimal("0.00"))]),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="salarygrade",
            name="step_7",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[MinValueValidator(Decimal("0.00"))]),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="salarygrade",
            name="step_8",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[MinValueValidator(Decimal("0.00"))]),
            preserve_default=False,
        ),
    ]
