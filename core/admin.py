from django.contrib import admin

from .models import CSCPlantilla, Division, Position, SalaryGrade, TimeRule

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


@admin.register(SalaryGrade)
class SalaryGradeAdmin(admin.ModelAdmin):
    list_display = ('salary_grade_id', 'csc_grade', 'step_1', 'step_8')
    search_fields = ('=csc_grade',)


@admin.register(CSCPlantilla)
class CSCPlantillaAdmin(admin.ModelAdmin):
    list_display = (
        'plantilla_id',
        'item_number',
        'position',
        'division',
        'salary_grade',
        'salary_step',
    )
    search_fields = ('item_number', 'position__position_name', 'division__division_name')
