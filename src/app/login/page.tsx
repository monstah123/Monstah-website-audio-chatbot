"use client";

import { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!auth) {
      setError("System Offline: Firebase API keys missing.");
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!auth) {
      setError("System Offline: Firebase API keys missing.");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="auth-card glass"
      >
        <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>
        <p className="subtitle">Sign in to manage your AI Knowledge Base</p>

        <button onClick={handleGoogleAuth} className="btn-google" disabled={isLoading}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="google-icon" />
          Continue with Google
        </button>

        <div className="divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleEmailAuth}>
          <div className="input-group">
            <Mail size={18} className="icon" />
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="input-group">
            <Lock size={18} className="icon" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="spin" size={20} /> : (isLogin ? "Sign In" : "Sign Up")}
          </button>
        </form>

        <div className="toggle-auth">
          <button onClick={() => setIsLogin(!isLogin)} type="button">
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </motion.div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at top right, rgba(0, 242, 254, 0.05), transparent),
                      radial-gradient(circle at bottom left, rgba(255, 0, 128, 0.05), transparent);
          padding: 20px;
        }

        .auth-card {
          width: 100%;
          max-width: 440px;
          padding: 40px 32px;
          border-radius: 24px;
          text-align: center;
          background: rgba(10, 10, 10, 0.8);
          border: 1px solid var(--glass-border);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          backdrop-filter: blur(20px);
        }

        h2 {
          font-size: 1.7rem;
          margin-bottom: 8px;
          font-weight: 700;
        }

        .subtitle {
          color: var(--text-secondary);
          margin-bottom: 24px;
          font-size: 0.9rem;
        }
        
        .btn-google {
          width: 100%;
          padding: 12px;
          background: white;
          color: #000;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          transition: transform 0.2s, box-shadow 0.2s;
          margin-bottom: 24px;
        }
        
        .btn-google:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(255,255,255,0.1);
        }
        
        .google-icon {
          width: 18px;
          height: 18px;
        }
        
        .divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin-bottom: 24px;
        }
        
        .divider::before,
        .divider::after {
          content: "";
          flex: 1;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .divider span {
          padding: 0 16px;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .input-group {
          position: relative;
          margin-bottom: 16px;
        }

        .icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
        }

        input {
          width: 100%;
          padding: 14px 14px 14px 44px;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
        }

        input:focus {
          border-color: var(--primary);
        }

        .btn-submit {
          width: 100%;
          padding: 16px;
          background: var(--primary);
          color: #000;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 1.1rem;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: transform 0.2s, box-shadow 0.2s;
          margin-top: 10px;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 20px rgba(68, 255, 68, 0.4);
        }

        .btn-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .error-message {
          color: #ff4444;
          background: rgba(255, 68, 68, 0.1);
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 0.9rem;
          text-align: left;
        }

        .toggle-auth {
          margin-top: 24px;
        }

        .toggle-auth button {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.95rem;
          transition: color 0.2s;
        }

        .toggle-auth button:hover {
          color: white;
          text-decoration: underline;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
