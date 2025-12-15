from django.urls import path, include
from . import views

from .views import EmployeeViewSet, DivisionViewSet

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet)
router.register(r'divisions', DivisionViewSet)

urlpatterns = [
    path('', name='index', view=views.index),
   
    # API URLs
    path('api/', include(router.urls)),
]