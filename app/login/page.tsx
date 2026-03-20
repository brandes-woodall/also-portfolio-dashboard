'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      router.push('/');
    } else {
      setError(true);
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-sm p-8 border border-gray-200 rounded-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Portfolio Dashboard</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false); }}
            className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-gray-400"
          />
          {error && <p className="text-red-500 text-xs">Incorrect password</p>}
          <button type="submit" className="w-full bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700">
            Enter
          </button>
        </form>
      </div>
    </main>
  );
}