from django.contrib import admin

# Register your models here.
from .models import Employee, Division

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'cs_id_no', 'first_name', 'last_name', 'position', 'division')
    search_fields = ('first_name', 'last_name', 'cs_id_no')
    list_filter = ('division',)
    
@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display = ('division_id', 'division_name')
    search_fields = ('division_name',)
    