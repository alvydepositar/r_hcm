from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from django.template.loader import render_to_string
from django.test import TestCase
from django.urls import reverse

from core.models import Division, Position
from core.rbac import ROLE_HR, ROLE_RECRUITMENT
from core.serializers import AccessRightsSerializer, ApproverSerializer
from employee_modules.models import Employee
from hr_modules.models import Approver


class HRPortalAuthMixin:
    def setUp(self):
        super().setUp()
        self.client.force_login(get_user_model().objects.get(username="amelia.rivera"))


class ApproverPageTests(HRPortalAuthMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.division = Division.objects.create(
            division_name='Finance',
            division_abbreviation='FIN',
        )
        cls.position = Position.objects.create(position_name='Analyst')
        cls.employee = Employee.objects.create(
            employee_id='EMP001',
            first_name='Alice',
            last_name='Santos',
            position=cls.position,
            division=cls.division,
        )

    def test_approvers_template_renders(self):
        html = render_to_string(
            'employee/approvers.html',
            {'divisions': [self.division], 'employees': [self.employee]},
        )

        self.assertIn('Approvers', html)
        self.assertIn('Division Approvers', html)

    def test_approvers_page_renders_with_lookup_options(self):
        response = self.client.get(reverse('approvers'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.division.division_name)
        self.assertContains(response, f'{self.employee.first_name} {self.employee.last_name}')


class AccessRightsPageTests(HRPortalAuthMixin, TestCase):
    def test_access_rights_page_renders(self):
        response = self.client.get(reverse("access_rights"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Access Rights")
        self.assertContains(response, "Grant Recruitment access")
        self.assertContains(response, "access-rights-table")
        self.assertContains(response, "js/hr/security/access_rights.js")


class RecruitmentManagementPageTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.division = Division.objects.create(
            division_name="Recruitment Services",
            division_abbreviation="RS",
        )
        cls.position = Position.objects.create(position_name="Recruitment Officer")

        cls.user_model = get_user_model()
        cls.hr_user = cls.user_model.objects.get(username="amelia.rivera")

        cls.recruitment_group, _ = Group.objects.get_or_create(name=ROLE_RECRUITMENT)
        cls.it_user = cls.user_model.objects.create_user(
            username="workspace.it",
            password="Recruitment@2026",
        )
        cls.it_user.groups.add(cls.recruitment_group)

        cls.division_chief_user = cls.user_model.objects.create_user(
            username="workspace.dc",
            password="Recruitment@2026",
        )
        cls.division_chief_employee = Employee.objects.create(
            employee_id="EMP-RM-DC-001",
            first_name="Daryl",
            last_name="Chief",
            position=cls.position,
            division=cls.division,
            user=cls.division_chief_user,
        )
        cls.hr_approver_user = cls.user_model.objects.create_user(
            username="workspace.hr.approver",
            password="Recruitment@2026",
        )
        cls.hr_employee = Employee.objects.create(
            employee_id="EMP-RM-HR-001",
            first_name="Hazel",
            last_name="Recruiter",
            position=cls.position,
            division=cls.division,
            user=cls.hr_approver_user,
        )
        Approver.objects.create(
            approval_type=Approver.ApprovalType.DIVISION,
            division_id=cls.division,
            division_chief=cls.division_chief_employee,
            hr_approver=cls.hr_employee,
        )

        cls.employee_user = cls.user_model.objects.create_user(
            username="workspace.employee",
            password="Recruitment@2026",
        )
        cls.employee_record = Employee.objects.create(
            employee_id="EMP-RM-001",
            first_name="Nina",
            last_name="Employee",
            position=cls.position,
            division=cls.division,
            user=cls.employee_user,
        )

    def test_hr_user_can_open_recruitment_workspace(self):
        self.client.force_login(self.hr_user)

        response = self.client.get(reverse("recruitment_management"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Recruitment Workspace")
        self.assertContains(response, "recruitment-hiring-requests-table")
        self.assertContains(response, "js/hr/recruitment/recruitment_management.js")

    def test_it_manager_cannot_open_recruitment_workspace(self):
        self.client.force_login(self.it_user)

        response = self.client.get(reverse("recruitment_management"))

        self.assertEqual(response.status_code, 403)

    def test_division_chief_cannot_open_recruitment_workspace(self):
        self.client.force_login(self.division_chief_user)

        response = self.client.get(reverse("recruitment_management"))

        self.assertEqual(response.status_code, 403)

    def test_regular_employee_cannot_open_recruitment_workspace(self):
        self.client.force_login(self.employee_user)

        response = self.client.get(reverse("recruitment_management"))

        self.assertEqual(response.status_code, 403)

    def test_it_manager_can_open_recruitment_requestor_portal(self):
        self.client.force_login(self.it_user)

        response = self.client.get(reverse("recruitment_requestor_portal"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Requestor Recruitment Portal")
        self.assertContains(response, "requestor-my-hiring-requests-table")
        self.assertContains(response, "js/employee/recruitment_portal.js")
        self.assertContains(response, self.division.division_name)
        self.assertContains(response, self.position.position_name)

    def test_division_chief_can_open_recruitment_requestor_portal_in_employee_mode(self):
        self.client.force_login(self.division_chief_user)

        response = self.client.get(f"{reverse('recruitment_requestor_portal')}?portal=employee")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["portal_mode"], "employee")
        self.assertContains(response, "Requestor Recruitment Portal")
        self.assertContains(response, "js/employee/recruitment_portal.js")
        self.assertFalse(response.context["requestor_recruitment_permissions"]["can_create_hiring_requests"])

    def test_regular_employee_cannot_open_recruitment_requestor_portal(self):
        self.client.force_login(self.employee_user)

        response = self.client.get(reverse("recruitment_requestor_portal"))

        self.assertEqual(response.status_code, 403)


class ApproverSerializerTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.division = Division.objects.create(
            division_name='Operations',
            division_abbreviation='OPS',
        )
        cls.position = Position.objects.create(position_name='Manager')
        cls.employee = Employee.objects.create(
            employee_id='EMP100',
            first_name='Juan',
            last_name='Dela Cruz',
            position=cls.position,
            division=cls.division,
        )
        cls.supervisor = Employee.objects.create(
            employee_id='EMP101',
            first_name='Maria',
            last_name='Supervisor',
            position=cls.position,
            division=cls.division,
        )
        cls.division_chief = Employee.objects.create(
            employee_id='EMP102',
            first_name='Paolo',
            last_name='Chief',
            position=cls.position,
            division=cls.division,
        )
        cls.hr_approver = Employee.objects.create(
            employee_id='EMP103',
            first_name='Helen',
            last_name='HR',
            position=cls.position,
            division=cls.division,
        )

    def test_rejects_invalid_approval_type(self):
        serializer = ApproverSerializer(data={
            'approval_type': 'team',
            'division_id': self.division.pk,
            'immediate_supervisor': self.supervisor.pk,
            'division_chief': self.division_chief.pk,
            'hr_approver': self.hr_approver.pk,
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('approval_type', serializer.errors)

    def test_partial_update_rejects_duplicate_approver_roles(self):
        approver = Approver.objects.create(
            approval_type=Approver.ApprovalType.DIVISION,
            division_id=self.division,
            immediate_supervisor=self.supervisor,
            division_chief=self.division_chief,
            hr_approver=self.hr_approver,
        )

        serializer = ApproverSerializer(
            instance=approver,
            data={'alt_supervisor': self.supervisor.pk},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)

    def test_partial_update_rejects_mixed_targets(self):
        approver = Approver.objects.create(
            approval_type=Approver.ApprovalType.DIVISION,
            division_id=self.division,
            immediate_supervisor=self.supervisor,
            division_chief=self.division_chief,
            hr_approver=self.hr_approver,
        )

        serializer = ApproverSerializer(
            instance=approver,
            data={'employee_id': self.employee.pk},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)


class AccessRightsSerializerTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.division = Division.objects.create(
            division_name="Human Resources",
            division_abbreviation="HR",
        )
        cls.position = Position.objects.create(position_name="HR Officer")
        cls.primary_employee = Employee.objects.create(
            employee_id="EMP-AR-001",
            first_name="Aira",
            last_name="Reyes",
            position=cls.position,
            division=cls.division,
        )
        cls.secondary_employee = Employee.objects.create(
            employee_id="EMP-AR-002",
            first_name="Paolo",
            last_name="Santos",
            position=cls.position,
            division=cls.division,
        )
        cls.user_model = get_user_model()

    def test_create_links_employee_and_assigns_hr_group(self):
        serializer = AccessRightsSerializer(data={
            "username": "access.user",
            "password": "Access@2026",
            "employee": self.primary_employee.pk,
            "has_hr_access": True,
            "is_active": True,
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.primary_employee.refresh_from_db()
        self.assertEqual(self.primary_employee.user, user)
        self.assertTrue(user.groups.filter(name=ROLE_HR).exists())
        self.assertTrue(user.is_active)

    def test_create_assigns_recruitment_group(self):
        serializer = AccessRightsSerializer(data={
            "username": "access.recruitment",
            "password": "Access@2026",
            "employee": self.primary_employee.pk,
            "has_recruitment_access": True,
            "is_active": True,
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.primary_employee.refresh_from_db()
        self.assertEqual(self.primary_employee.user, user)
        self.assertTrue(user.groups.filter(name=ROLE_RECRUITMENT).exists())

    def test_update_normalizes_legacy_requestor_groups_to_recruitment_group(self):
        legacy_it_group, _ = Group.objects.get_or_create(name="IT Manager")
        legacy_division_chief_group, _ = Group.objects.get_or_create(name="Division Chief")
        user = self.user_model.objects.create_user(
            username="access.legacy",
            password="Access@2026",
            is_active=True,
        )
        user.groups.add(legacy_it_group, legacy_division_chief_group)

        serializer = AccessRightsSerializer(
            instance=user,
            data={"is_active": True},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_user = serializer.save()

        self.assertTrue(updated_user.groups.filter(name=ROLE_RECRUITMENT).exists())
        self.assertFalse(updated_user.groups.filter(name="IT Manager").exists())
        self.assertFalse(updated_user.groups.filter(name="Division Chief").exists())

    def test_update_relinks_employee_and_removes_hr_group(self):
        hr_group, _ = Group.objects.get_or_create(name=ROLE_HR)
        user = self.user_model.objects.create_user(
            username="access.update",
            password="Access@2026",
            is_active=True,
        )
        user.groups.add(hr_group)
        self.primary_employee.user = user
        self.primary_employee.save(update_fields=["user"])

        serializer = AccessRightsSerializer(
            instance=user,
            data={
                "employee": self.secondary_employee.pk,
                "has_hr_access": False,
                "is_active": True,
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_user = serializer.save()

        self.primary_employee.refresh_from_db()
        self.secondary_employee.refresh_from_db()
        self.assertIsNone(self.primary_employee.user)
        self.assertEqual(self.secondary_employee.user, updated_user)
        self.assertFalse(updated_user.groups.filter(name=ROLE_HR).exists())
