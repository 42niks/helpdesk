from django.contrib import admin
from django.http import HttpResponse
from django.urls import path


def health(_request):
    return HttpResponse("ok", content_type="text/plain")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("_health/", health),
]

