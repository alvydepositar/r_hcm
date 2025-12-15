from django.contrib import admin

from .models import Employee

# Register your models here.
@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('id', 'employee_id', 'first_name', 'last_name', 'position', 'division')
    search_fields = ('first_name', 'last_name', 'employee_id', 'position')
    list_filter = ('division',)