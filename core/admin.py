from django.contrib import admin
from .models import *

# Register your models here.
@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display = ('division_id', 'division_name', 'division_abbreviation')
    search_fields = ('division_name',)
    
@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ('position_id', 'position_name', 'description')
    search_fields = ('position_name',)
    
@admin.register(TimeRule)
class TimeRuleAdmin(admin.ModelAdmin):
    list_display = ('time_rule_id', 'time_rule_name', 'earliest_in', 'latest_in', 'earliest_out', 'latest_out', 'lunch_start', 'lunch_end', 'lunch_grace_period')
    search_fields = ('time_rule_name',)