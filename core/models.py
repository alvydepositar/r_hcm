from django.db import models

# Create your models here.
class Division(models.Model):
    division_id = models.AutoField(primary_key=True)
    division_name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.division_name