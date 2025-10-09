import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'

import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import Login from './pages/Login'
import Recepcao from './pages/Recepcao'
import Admin from './pages/Admin'
import TesteDB from './pages/TesteDB'   // rota de teste

function RoleRedirect() {
    const { isAdmin } = useAuth()
    return <Navigate to={isAdmin ? '/admin' : '/recepcao'} replace />
}

const router = createBrowserRouter([
    { path: '/', element: <Login /> },
    { path: '/recepcao', element: <ProtectedRoute><Recepcao /></ProtectedRoute> },
    { path: '/admin', element: <ProtectedRoute><Admin /></ProtectedRoute> },
    { path: '/home', element: <ProtectedRoute><RoleRedirect /></ProtectedRoute> },
    // rota de teste para validar Firestore
    { path: '/teste-db', element: <ProtectedRoute><TesteDB /></ProtectedRoute> },
    { path: '*', element: <div style={{ padding: 16 }}>404</div> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <RouterProvider router={router} />
        </AuthProvider>
    </React.StrictMode>,
)
