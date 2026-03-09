from django.urls import path, include
from . import views

from .views import *

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet)
router.register(r'divisions', DivisionViewSet)
router.register(r'positions', PositionViewSet)
router.register(r'time_rules', TimeRuleViewSet)
router.register(r'approvers', ApproverViewSet)

urlpatterns = [
    path('', name='index', view=views.index),
   
    # API URLs
    path('api/', include(router.urls)),
]