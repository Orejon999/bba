import React, { useState } from 'react';
import { PackageOpen, ArrowRight, Lock, User, Mail, Loader2, CheckCircle } from 'lucide-react';
import { User as UserType } from '../types';
import { supabase } from '../services/supabaseClient';

interface LoginPanelProps {
  onLogin: (user: UserType) => void;
}

export const LoginPanel: React.FC<LoginPanelProps> = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    
    try {
        if (!formData.email || !formData.password) {
            throw new Error('Completa correo y contraseña.');
        }

        if (isRegistering) {
            if (!formData.firstName) throw new Error('Nombre es requerido para registrarse.');
            if (formData.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
            
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName
                    }
                }
            });
            
            if (signUpError) throw signUpError;

            // Check if session is null (Email confirmation enabled)
            if (data.user && !data.session) {
                setSuccessMsg('¡Cuenta creada! Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.');
                setIsRegistering(false); // Switch to login view
            } else {
                 // Auto-login success (if Email Confirm is OFF in Supabase)
                 setSuccessMsg('¡Bienvenido! Iniciando sesión...');
            }
        } else {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            });
            if (signInError) throw signInError;
        }

        // Auth state listener in App.tsx will handle the rest
    } catch (err: any) {
        setError(err.message || "Error de autenticación. Verifica tus credenciales.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        
        <div className="bg-blue-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 backdrop-blur-sm shadow-inner">
            <PackageOpen size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BBC Inventario</h1>
          <p className="text-blue-100 text-sm mt-2">Sistema Cloud con Supabase</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
              {isRegistering ? 'Crear Cuenta Nueva' : 'Iniciar Sesión'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 text-center font-medium">
                {error}
              </div>
            )}
            
            {successMsg && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg border border-green-200 text-center font-medium flex flex-col items-center gap-1">
                <CheckCircle size={16}/>
                {successMsg}
              </div>
            )}

            {isRegistering && (
                <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Nombre</label>
                    <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Apellido</label>
                    <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-70"
            >
              {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Conectando...</span>
                  </>
              ) : (
                  <>
                    <span>{isRegistering ? 'Registrarse' : 'Ingresar'}</span>
                    <ArrowRight size={18} />
                  </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
             <button 
                onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                    setSuccessMsg('');
                }}
                className="text-sm text-blue-600 hover:underline font-medium"
             >
                 {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};