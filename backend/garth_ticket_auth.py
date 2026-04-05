"""Riceve il ticket SSO Garmin dal browser e lo converte in token OAuth."""
from dotenv import load_dotenv; load_dotenv()
import sys, os, requests, threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from garth.sso import get_oauth1_token, exchange
from garth import http as garth_http

received_ticket = [None]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        ticket = params.get('ticket', [None])[0]
        if ticket:
            received_ticket[0] = ticket
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'<h1>Ticket ricevuto! Puoi chiudere questa tab.</h1>')
        else:
            self.send_response(400)
            self.end_headers()
    def log_message(self, *a): pass

server = HTTPServer(('localhost', 9876), Handler)
print("In attesa del ticket su http://localhost:9876 ...")
server.handle_request()  # aspetta UNA richiesta poi esci

ticket = received_ticket[0]
if not ticket:
    print("Nessun ticket ricevuto"); sys.exit(1)

print(f"Ticket: {ticket[:30]}...")

client = garth_http.Client()
print("Exchange ticket -> OAuth1...")
oauth1 = get_oauth1_token(ticket, client)
client.oauth1_token = oauth1
print("OAuth1 OK")

print("Exchange OAuth1 -> OAuth2...")
oauth2 = exchange(client, oauth1)
client.oauth2_token = oauth2
print("OAuth2 OK")

token_dump = client.dumps()
print(f"Token dump: {len(token_dump)} chars")

resp = requests.post('http://localhost:8000/api/garmin/save-token',
                     json={'token_dump': token_dump}, timeout=10)
print("Salvato MongoDB:", resp.status_code, resp.json())
