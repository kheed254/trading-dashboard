/* ---------------------------------------------------------
 * POST /api/token
 *
 * Exchanges a Deriv OAuth authorization code for an access token.
 * Runs on Vercel's serverless platform — no CORS issues, no
 * exposed secrets in the browser.
 * --------------------------------------------------------- */

export default async function handler(req, res) {
  /* Only allow POST */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* Destructure the body — Vercel parses JSON automatically */
  const { code, code_verifier, redirect_uri, client_id } = req.body || {};

  if (!code || !code_verifier || !redirect_uri || !client_id) {
    return res.status(400).json({
      error:
        'Missing required fields. Need: code, code_verifier, redirect_uri, client_id',
    });
  }

  /* Build the form-encoded body Deriv expects */
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await derivRes.json();

    if (!derivRes.ok) {
      return res.status(derivRes.status).json({
        error: data.error_description || data.error || 'Token exchange failed',
        raw: data,
      });
    }

    /* Success — send the token data back to the app */
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: 'Server error during token exchange',
      message: err.message,
    });
  }
}