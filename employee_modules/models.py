from django.db import models
from core.models import Division, Position

# Create your models here.
class Employee(models.Model):
    id = models.AutoField(primary_key=True)
    employee_id = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    middle_name = models.CharField(max_length=30, blank=True, null=True)
    name_extension = models.CharField(max_length=5, blank=True, null=True)
    position = models.ForeignKey(Position, on_delete=models.CASCADE)
    division = models.ForeignKey(Division, on_delete=models.CASCADE)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"