import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RegisterForm } from '@/components/Auth/RegisterForm';
import { useAuth } from '@/hooks/useAuth';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-mockup">
          <div className="auth-mockup-phone">
            <div className="mockup-screen">
              <div className="mockup-avatar"></div>
              <div className="mockup-row grad"></div>
              <div className="mockup-row"></div>
              <div className="mockup-row short"></div>
              <div className="mockup-row"></div>
              <div className="mockup-row short"></div>
              <div className="mockup-row grad"></div>
              <div className="mockup-row"></div>
            </div>
          </div>
        </div>

        <div className="auth-forms">
          <div className="auth-card">
            <div className="ig-logo"><span className="logo-word">Freind</span><span className="logo-z">Z</span><span className="logo-x">X</span></div>
            <p className="tagline">Sign up to find people near you with shared interests.</p>
            <RegisterForm />
            <div className="auth-divider" style={{ margin: '16px 0' }}>
              <span>OR</span>
            </div>
            <button
              type="button"
              className="btn-google"
              onClick={() => {
                const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';
                window.location.href = `${gatewayUrl}/api/auth/google`;
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 8 }}>
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="auth-footer-card">
            Already have an account?{' '}
            <Link to="/login">Log in</Link>
          </div>

          <div className="auth-app-badges">
            <p>Get the app.</p>
            <div className="badge-row">
              <div className="store-badge">
                <span>App Store</span>
              </div>
              <div className="store-badge">
                <span>Google Play</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
