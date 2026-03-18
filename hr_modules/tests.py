from django.contrib.auth import get_user_model
from django.template.loader import render_to_string
from django.test import TestCase
from django.urls import reverse

from core.models import Division, Position
from core.serializers import ApproverSerializer
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
