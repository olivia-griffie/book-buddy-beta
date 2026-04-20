const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = require('./supabase-config');

async function supabaseFetch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const message = data?.error_description || data?.msg || data?.message || 'Authentication failed.';
    throw new Error(message);
  }

  return data;
}

async function signIn(email, password) {
  return supabaseFetch('token?grant_type=password', { email, password });
}

async function refreshSession(refreshToken) {
  return supabaseFetch('token?grant_type=refresh_token', { refresh_token: refreshToken });
}

async function signOut(accessToken) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    },
  }).catch(() => {});
}

async function signUp(email, password, username) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password, data: { username } }),
  });

  const data = await res.json();

  if (!res.ok) {
    const message = data?.error_description || data?.msg || data?.message || 'Sign up failed.';
    throw new Error(message);
  }

  return data;
}

module.exports = { signIn, signUp, refreshSession, signOut };
