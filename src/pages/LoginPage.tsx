import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Mail, Lock, User, ArrowRight, Github } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login, signup } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await signup(name, email, password);
            }
            navigate('/chat');
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
    // Redirects directly to your Node.js backend
        window.location.href = 'http://localhost:5001/api/auth/google';
    };
    
    const handleGithubLogin = () => {
        window.location.href = 'http://localhost:5001/api/auth/github';
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements to match Landing Page */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent"></div>
            <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-fuchsia-900/10 via-transparent to-transparent"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                {/* Logo Section */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(139,92,246,0.5)]">
                        <Bot className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">
                        {isLogin ? 'Welcome Back' : 'Join the Agentic Age'}
                    </h2>
                    <p className="text-zinc-500 mt-2 text-center">
                        {isLogin
                            ? 'Continue your journey with Kshitij Agent'
                            : 'Start building intelligent agentic systems today'}
                    </p>
                </div>

                {/* Form Container */}
                <div className="glass-panel p-8 rounded-3xl border border-white/5 bg-white/[0.02]">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Full Name</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-violet-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Kshitij Dalvi"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-violet-600/50 transition-all placeholder:text-zinc-700"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-violet-500 transition-colors" />
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-violet-600/50 transition-all placeholder:text-zinc-700"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Password</label>
                                {isLogin && <button type="button" className="text-xs text-violet-500 hover:text-violet-400 font-medium transition-colors">Forgot?</button>}
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-violet-500 transition-colors" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-violet-600/50 transition-all placeholder:text-zinc-700"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-2 px-4 rounded-lg text-center"
                            >
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-violet-600/20 disabled:opacity-50 mt-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-zinc-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-transparent px-2 text-zinc-500 font-semibold tracking-widest">Or continue with</span>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-4">
                            <button 
                                onClick={handleGithubLogin}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white hover:bg-zinc-800 transition-colors">
                                <Github className="w-5 h-5" />
                                <span className="text-sm font-medium">GitHub</span>
                                </button>
                            <button 
                                onClick={handleGoogleLogin} 
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white hover:bg-zinc-800 transition-colors">
                                {/* Google Icon SVG */}
                                <span className="text-sm font-medium">Google</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center text-sm">
                    <span className="text-zinc-500">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                    </span>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="ml-2 text-violet-500 hover:text-violet-400 font-bold transition-colors"
                    >
                        {isLogin ? 'Sign up for free' : 'Sign in here'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
