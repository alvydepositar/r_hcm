from django.db import models
from core.models import Division

# Create your models here.
class Employee(models.Model):
    id = models.AutoField(primary_key=True)
    employee_id = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    middle_name = models.CharField(max_length=30, blank=True, null=True)
    name_extension = models.CharField(max_length=5, blank=True, null=True)
    position = models.CharField(max_length=50)
    division = models.ForeignKey(Division, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"