from channels.generic.websocket import AsyncWebsocketConsumer

import json


class ChatConsumer(AsyncWebsocketConsumer):
	async def connect(self):
		self.room_group_name = 'Test-room'
		print('\n self.room_group_name', self.room_group_name)
		await self.channel_layer.group_add(
			self.room_group_name,
			self.channel_name
		)

		await self.accept()

	async def disconnect(self, close_code):
		await self.channel_layer.group_discard(
			self.room_group_name,
			self.channel_name
		)
	print("\n****DISCONNECTED****")
	async def receive(self, text_data):
		received_dict = json.loads(text_data)
		message = received_dict['message']
		action = received_dict['action']

		if (action == 'new-offer') or (action == 'new-answer'):
			receiver_channel_name = received_dict['message']['receiver_channel_name']
			received_dict['message']['receiver_channel_name'] = self.channel_name
			print('\n**receiver_channel_name**',receiver_channel_name)
			await self.channel_layer.send(
				receiver_channel_name,
				{
					'type': 'send.sdp',
					'received_dict': received_dict
				}
			)

			return

		received_dict['message']['receiver_channel_name'] = self.channel_name

		await self.channel_layer.group_send(
			self.room_group_name,
			{
				'type': 'send.sdp',
				'received_dict': received_dict
			}
		)
	
	async def send_sdp(self, event):

		received_dict = event['received_dict']
		text_data=json.dumps(received_dict)
		print('**text_data**',text_data)
		await self.send(text_data=json.dumps(received_dict))
