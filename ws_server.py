#!/usr/bin/python

'''
TO BUILD:
pyinstaller ws_server.py --name "FnotFTestServer" --onefile
'''


import logging
from websocket_server import WebsocketServer
import os, time, sys, argparse

parser = argparse.ArgumentParser()
parser.add_argument("--port", default=False,
    help="Server port to bind to. Default: 5000", required=False)
parser.add_argument("--run", default=1,
    help="1: run one time, loop: loop", required=True)
parser.add_argument("--delay", default=1,
    help="loop delay, default 1 (second)", required=False)
args = parser.parse_args()


if args.port:
	port=int(args.port)
else: 
	port=5000
print("_F Setting up OSC server on port",port)
print("_F going to run in mode? ",args.run)


def new_client(client, server):
	server.send_message_to_all("A new client has joined")
	print("New client has joined",client)


	if args.delay:
		loop_delay=float(args.delay)
	else: 
		loop_delay = 0.5

	if(args.run)=="1":

		print("Going to run once")
		server.send_message_to_all('{"series":"series1"}')
		time.sleep(0.5)
		server.send_message_to_all('{"marker":1}')
		time.sleep(0.5)
		server.send_message_to_all('{"reveal":0.1}')

		os._exit(0)


	#3. get arg to loop tests with a desired delay
	elif(args.run == "loop"):
		print("Going to run in a loop with delay",args.delay)
		print("To exit, type command+C")


		while(True):

			for i in range(1,2):

				print("Sending series ",i)

				series = "series{0}".format(i)
				label = "Series {0}".format(i)


				msg = '{{"series":"{0}","label":"{1}"}}'.format(series,label)
				#msg = '{"series":"series1"}'
				server.send_message_to_all(msg)
				time.sleep(0.5)

				for j in range(1,11):
					server.send_message_to_all('{{"marker":{0}}}'.format(j))
					time.sleep(0.5)
					#server.send_message_to_all("reveal",round(j*0.1,2))
					server.send_message_to_all('{{"reveal":{0}}}'.format(round(j*0.1,2)))
					time.sleep(0.5)

				server.send_message_to_all("Finished loop - restarting in {0} seconds".format(loop_delay))

				print("Waiting {0} seconds before next loop".format(loop_delay))
				time.sleep(loop_delay)



		time.sleep(1)
		#server.send_message_to_all("message1")



def client_left(client,server):
	print("Client has left. Ignore any errors, server will continue")

server = WebsocketServer(port, host='127.0.0.1', loglevel=logging.INFO)
server.set_fn_new_client(new_client)
server.set_fn_client_left(client_left)
server.run_forever()

