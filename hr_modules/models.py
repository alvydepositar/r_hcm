from django.db import models

from core.models import Division
from employee_modules.models import Employee

class Approver(models.Model):
    approver_id = models.AutoField(primary_key=True)
    approval_type = models.CharField(max_length=50)
    division_id = models.ForeignKey(Division, on_delete=models.CASCADE, null=True, blank=True, related_name='approver_division')
    employee_id = models.ForeignKey(Employee, on_delete=models.CASCADE, null=True, blank=True, related_name='approver_employee')
    immediate_supervisor = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='immediate_supervisor')
    alt_supervisor = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='alternative_supervisor')
    division_chief = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='division_chief')
    alt_division_chief = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='alternative_division_chief')
    hr_approver = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='hr_approver')
    alt_hr_approver = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='alternative_hr_approver')

    def __str__(self):
        if self.employee_id:
            first_name = getattr(self.employee_id, 'first_name', '')
            last_name = getattr(self.employee_id, 'last_name', '')
            return f"Approvers for {first_name} {last_name}"
        else:
            division_name = self.division_id.division_name if self.division_id else "No Division"
        return f"Approvers for Division: {division_name}"