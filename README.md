# Voting App

A real-time voting application built with React (frontend), Node.js/Express (backend), MongoDB, and Socket.IO.

## Project Structure

- `frontend/`: React app for Vercel
- `backend/`: Express + Socket.IO API for Railway

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=3001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=https://your-frontend-project.vercel.app
SERVE_FRONTEND=false
```

### Frontend (`frontend/.env`)

```env
REACT_APP_API_URL=https://your-backend-service.up.railway.app
REACT_APP_SOCKET_URL=https://your-backend-service.up.railway.app
```

## Deployment Notes

- Deploy `frontend/` to Vercel.
- Deploy `backend/` to Railway.
- In Vercel, set the Root Directory to `frontend`.
- In Railway, set the service root to `backend`.
- After Railway gives you a public URL, set that URL in Vercel as `REACT_APP_API_URL` and `REACT_APP_SOCKET_URL`.
- After Vercel gives you a public URL, set that URL in Railway as `CLIENT_URL`.
