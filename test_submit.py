import requests
import json

payload = {
    'name': 'Test User',
    'email': 'test@example.com',
    'phone': '1234567890',
    'age': '25',
    'address': 'Test Address',
    'photo': 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
}

try:
    response = requests.post('http://localhost:5000/submit', json=payload)
    print(f'Status: {response.status_code}')
    print(f'Response: {response.text}')
except Exception as e:
    print(f'Error: {e}')
