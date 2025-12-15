from django.contrib import admin
from .models import Division

# Register your models here.
@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display = ('division_id', 'division_name')
    search_fields = ('division_name',)