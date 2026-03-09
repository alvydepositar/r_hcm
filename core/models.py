from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

# Create your models here.
class Division(models.Model):
    division_id = models.AutoField(primary_key=True)
    division_name = models.CharField(max_length=100, unique=True)
    division_abbreviation = models.CharField(max_length=10)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)
    
    def __str__(self):
        return self.division_name
    
    
class Position(models.Model):
    position_id = models.AutoField(primary_key=True)
    position_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)
    
    def __str__(self):
        return self.position_name
    
class TimeRule(models.Model):
    time_rule_id = models.AutoField(primary_key=True)
    time_rule_name = models.CharField(max_length=100, unique=True)
    earliest_in = models.TimeField()
    latest_in = models.TimeField()
    earliest_out = models.TimeField()
    latest_out = models.TimeField()
    lunch_start = models.TimeField()
    lunch_end = models.TimeField()
    lunch_grace_period = models.IntegerField(help_text="Grace period in minutes")
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)
    
    def __str__(self):
        return self.time_rule_name


class SalaryGrade(models.Model):
    salary_grade_id = models.AutoField(primary_key=True)
    csc_grade = models.PositiveSmallIntegerField(unique=True)
    step_1 = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    step_2 = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    step_3 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_4 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_5 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_6 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_7 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    step_8 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["csc_grade"]

    def __str__(self):
        return f"Salary Grade {self.csc_grade}"


class CSCPlantilla(models.Model):
    plantilla_id = models.AutoField(primary_key=True)
    item_number = models.CharField(max_length=50, unique=True)
    position = models.ForeignKey(Position, on_delete=models.CASCADE)
    division = models.ForeignKey(Division, on_delete=models.CASCADE)
    salary_grade = models.ForeignKey(SalaryGrade, on_delete=models.CASCADE)
    salary_step = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(8)]
    )
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["item_number"]

    def __str__(self):
        return f"{self.item_number} - {self.position}"

    @property
    def monthly_salary_amount(self):
        if not self.salary_grade_id or not self.salary_step:
            return None

        return getattr(self.salary_grade, f"step_{self.salary_step}", None)

    @property
    def annual_salary_amount(self):
        if self.monthly_salary_amount is None:
            return None

        return self.monthly_salary_amount * Decimal("12")

    def clean(self):
        super().clean()

        if not self.salary_grade_id or not self.salary_step:
            return

        if self.monthly_salary_amount is None:
            raise ValidationError({
                "salary_step": (
                    f"Salary Grade {self.salary_grade.csc_grade} does not have a published "
                    f"amount for Step {self.salary_step}."
                ),
            })
