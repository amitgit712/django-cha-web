from django.urls import path

from . import consumer

websocket_urlpatterns = [
	path('', consumer.ChatConsumer.as_asgi()),
]
