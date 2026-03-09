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