# Gassless Gossip - Django Messaging API

A real-time messaging application built with Django, Django REST Framework, and Django Channels.

## Features

- 🔐 JWT Authentication (register, login, logout)
- 💬 Real-time messaging via WebSockets
- 👥 Conversation management
- ✅ Message read status tracking
- 🔍 User search functionality
- 📄 Swagger API documentation

## Tech Stack

- **Django 4.2** - Web framework
- **Django REST Framework** - API development
- **Django Channels** - WebSocket support
- **PostgreSQL** - Database
- **Redis** - Channel layer & caching
- **JWT** - Authentication

## Quick Start

### Prerequisites

- Python 3.10+
- PostgreSQL
- Redis

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd django-app
   ```

2. **Create and activate virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # Linux/Mac
   # or
   venv\Scripts\activate  # Windows
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

5. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

6. **Create superuser (optional):**
   ```bash
   python manage.py createsuperuser
   ```

7. **Run the development server:**
   ```bash
   python manage.py runserver
   ```

8. **For WebSocket support, use Daphne:**
   ```bash
   daphne gassless_gossip.asgi:application
   ```

## Environment Variables

Create a `.env` file with:

```env
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_NAME=messaging_db
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
REDIS_URL=redis://localhost:6379/0
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register/` | Register new user |
| POST | `/api/v1/auth/login/` | Login (returns JWT tokens) |
| POST | `/api/v1/auth/logout/` | Logout (blacklist token) |
| POST | `/api/v1/auth/token/refresh/` | Refresh access token |
| GET | `/api/v1/auth/users/` | Search users |
| GET/PATCH | `/api/v1/auth/profile/` | Get/Update profile |

### Messaging

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/conversations/` | List conversations |
| POST | `/api/v1/conversations/` | Create conversation |
| GET | `/api/v1/conversations/{id}/messages/` | List messages |
| POST | `/api/v1/conversations/{id}/messages/` | Send message |
| PATCH | `/api/v1/messages/{id}/read/` | Mark as read |

### Documentation

- Swagger UI: `http://localhost:8000/api/docs/`

## WebSocket

Connect to real-time messaging:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/chat/{conversation_id}/');

// Send message
ws.send(JSON.stringify({
    type: 'message',
    content: 'Hello!'
}));

// Send typing indicator
ws.send(JSON.stringify({
    type: 'typing',
    is_typing: true
}));

// Receive messages
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
};
```

## Testing

Run the test suite:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=apps --cov-report=html

# Run specific app tests
pytest apps/users/
pytest apps/messaging/
```

**Current Coverage: 97%**

## Project Structure

```
django-app/
├── apps/
│   ├── messaging/
│   │   ├── models.py      # Conversation, Message models
│   │   ├── views.py       # API views
│   │   ├── serializers.py # DRF serializers
│   │   ├── consumers.py   # WebSocket consumers
│   │   ├── routing.py     # WebSocket routing
│   │   └── tests.py       # Test suite
│   └── users/
│       ├── models.py      # Custom User model
│       ├── views.py       # Auth views
│       ├── serializers.py # User serializers
│       └── tests.py       # Test suite
├── gassless_gossip/
│   ├── settings.py        # Django settings
│   ├── urls.py            # URL configuration
│   └── asgi.py            # ASGI config
├── requirements.txt
├── pytest.ini
└── manage.py
```

## Code Quality

```bash
# Format code
black apps/

# Lint code
flake8 apps/ --max-line-length=120
```

## License

MIT License
