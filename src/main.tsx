import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import Login from './pages/Login'
import Recepcao from './pages/Recepcao'
import Admin from './pages/Admin'

function RoleRedirect() {
  const { isAdmin } = useAuth()
  return <Navigate to={isAdmin ? '/admin' : '/recepcao'} replace />
}

const router = createHashRouter([
  { path: '/', element: <Login /> },
  { path: '/recepcao', element: <ProtectedRoute><Recepcao /></ProtectedRoute> },
  { path: '/admin', element: <ProtectedRoute><Admin /></ProtectedRoute> },
  { path: '/home', element: (<ProtectedRoute><RoleRedirect /></ProtectedRoute>) },
  { path: '*', element: <div style={{ padding: 16 }}>404</div> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
)
