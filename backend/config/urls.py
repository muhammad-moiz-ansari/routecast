from django.urls import path

from api.app import api

urlpatterns = [path("api/v1/", api.urls)]
