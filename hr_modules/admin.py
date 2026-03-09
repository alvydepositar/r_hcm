from django.contrib import admin
from .models import Approver

# Register your models here.
admin.site.register(Approver)
class ApproverAdmin(admin.ModelAdmin):
    list_display = ('approver_id', 'approval_type', 'division_id', 'employee_id', 'immediate_supervisor', 'alt_supervisor', 'division_chief', 'alt_division_chief', 'hr_approver', 'alt_hr_approver')
    search_fields = ('approval_type', 'employee_id__first_name', 'employee_id__last_name')
    list_filter = ('approval_type', 'division_id')