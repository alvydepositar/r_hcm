from django.conf import settings
from django.db import models
from core.models import Division, Position

# Create your models here.
class Employee(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_profile",
    )
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


class EmployeePersonalDataSheet(models.Model):
    class Sex(models.TextChoices):
        FEMALE = "female", "Female"
        MALE = "male", "Male"

    class CivilStatus(models.TextChoices):
        SINGLE = "single", "Single"
        MARRIED = "married", "Married"
        WIDOWED = "widowed", "Widowed"
        SEPARATED = "separated", "Separated"
        ANNULLED = "annulled", "Annulled"
        OTHER = "other", "Other"

    class CitizenshipBasis(models.TextChoices):
        BY_BIRTH = "by_birth", "By Birth"
        BY_NATURALIZATION = "by_naturalization", "By Naturalization"

    pds_id = models.AutoField(primary_key=True)
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name="personal_data_sheet",
    )
    surname = models.CharField(max_length=100, blank=True)
    first_name = models.CharField(max_length=100, blank=True)
    middle_name = models.CharField(max_length=100, blank=True)
    name_extension = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    place_of_birth = models.CharField(max_length=150, blank=True)
    sex = models.CharField(max_length=10, choices=Sex.choices, blank=True)
    civil_status = models.CharField(max_length=20, choices=CivilStatus.choices, blank=True)
    civil_status_other = models.CharField(max_length=100, blank=True)
    citizenship = models.CharField(max_length=100, blank=True)
    citizenship_basis = models.CharField(
        max_length=30,
        choices=CitizenshipBasis.choices,
        blank=True,
    )
    dual_citizenship_country = models.CharField(max_length=100, blank=True)
    height_m = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    blood_type = models.CharField(max_length=20, blank=True)
    gsis_id_no = models.CharField(max_length=50, blank=True)
    pagibig_id_no = models.CharField(max_length=50, blank=True)
    philhealth_no = models.CharField(max_length=50, blank=True)
    sss_no = models.CharField(max_length=50, blank=True)
    tin_no = models.CharField(max_length=50, blank=True)
    agency_employee_no = models.CharField(max_length=50, blank=True)
    residential_address = models.JSONField(default=dict, blank=True)
    permanent_address = models.JSONField(default=dict, blank=True)
    telephone_no = models.CharField(max_length=50, blank=True)
    mobile_no = models.CharField(max_length=50, blank=True)
    email_address = models.EmailField(blank=True)
    spouse_information = models.JSONField(default=dict, blank=True)
    father_information = models.JSONField(default=dict, blank=True)
    mother_information = models.JSONField(default=dict, blank=True)
    children = models.JSONField(default=list, blank=True)
    educational_background = models.JSONField(default=dict, blank=True)
    civil_service_eligibilities = models.JSONField(default=list, blank=True)
    work_experiences = models.JSONField(default=list, blank=True)
    voluntary_works = models.JSONField(default=list, blank=True)
    learning_and_development = models.JSONField(default=list, blank=True)
    special_skills = models.JSONField(default=list, blank=True)
    recognitions = models.JSONField(default=list, blank=True)
    memberships = models.JSONField(default=list, blank=True)
    questionnaire = models.JSONField(default=dict, blank=True)
    references = models.JSONField(default=list, blank=True)
    government_id_type = models.CharField(max_length=100, blank=True)
    government_id_number = models.CharField(max_length=100, blank=True)
    government_id_date_of_issue = models.DateField(null=True, blank=True)
    government_id_place_of_issue = models.CharField(max_length=150, blank=True)
    date_accomplished = models.DateField(null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    modified_by = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["employee__last_name", "employee__first_name"]

    def __str__(self):
        return f"PDS - {self.employee}"
