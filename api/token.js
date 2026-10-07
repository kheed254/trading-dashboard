export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, code_verifier, redirect_uri, client_id } = req.body || {};

  if (!code || !code_verifier || !redirect_uri || !client_id) {
    return res.status(400).json({
      error:
        'Missing required fields. Need: code, code_verifier, redirect_uri, client_id',
    });
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id,
    redirect_uri,
    code_verifier,
  });

  try {
    const derivRes = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await derivRes.json();

    if (!derivRes.ok) {
      return res.status(derivRes.status).json({
        error: data.error_description || data.error || 'Token exchange failed',
        raw: data,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: 'Server error during token exchange',
      message: err.message,
    });
  }
}