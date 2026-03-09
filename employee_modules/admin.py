from django.contrib import admin

from .models import Employee, EmployeePersonalDataSheet

# Register your models here.
@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('id', 'employee_id', 'first_name', 'last_name', 'position', 'division')
    search_fields = ('first_name', 'last_name', 'employee_id', 'position')
    list_filter = ('division',)


@admin.register(EmployeePersonalDataSheet)
class EmployeePersonalDataSheetAdmin(admin.ModelAdmin):
    list_display = ('pds_id', 'employee', 'surname', 'first_name', 'modified')
    search_fields = ('employee__employee_id', 'employee__first_name', 'employee__last_name', 'surname', 'first_name')
