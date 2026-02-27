# 🧠 DSA Study Rooms

A real-time collaborative coding platform for practicing Data Structures & Algorithms together.

## ✨ Features

- 🔐 **User Authentication** — Sign up / Login with JWT
- 🏠 **Study Rooms** — Create or join rooms with a PIN
- 💻 **Collaborative Code Editor** — Real-time shared Monaco Editor (VS Code-like)
- 🎮 **Role System** — Owner / Editor / Viewer with control transfer
- ▶️ **Code Execution** — Run Python, Java, C, C++ via Judge0 API
- 📥 **Stdin Support** — Provide program input before execution
- 📋 **DSA Questions** — Browse and create custom DSA problems
- 💬 **Live Chat** — Real-time chat inside each room
- 📡 **WebSocket Sync** — Powered by Socket.IO

## 🛠 Tech Stack

| Layer          | Technology                    |
| -------------- | ----------------------------- |
| Frontend       | React + Vite + Monaco Editor  |
| Backend        | Node.js + Express + Socket.IO |
| Database       | SQLite (via better-sqlite3)   |
| Code Execution | Judge0 Public API             |
| Auth           | JWT + bcrypt                  |

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/jayapraka5h/DSA.git
cd DSA
```

### 2. Setup Backend

```bash
cd backend
cp .env.example .env       # Fill in your JWT secret
npm install
node server.js
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Open in browser

```
http://localhost:5173
```

## 📁 Project Structure

```
DSA/
├── backend/
│   ├── controllers/      # Auth, Questions, Rooms, Solutions
│   ├── routes/           # API route definitions
│   ├── middleware/       # JWT auth middleware
│   ├── db.js             # SQLite setup
│   └── server.js         # Express + Socket.IO server
└── frontend/
    └── src/
        ├── pages/        # Home, Room, Login, Signup
        ├── context/      # Auth context
        └── room.css      # Room styling
```

## 🌍 Environment Variables

See `backend/.env.example` for required variables.
