import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Firebase for server-side persistence
const firebaseApp = initializeApp(firebaseConfig, "server-app");
const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
const serverDb = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
}, dbId);

// Enable CORS and JSON parsing
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// Helper to construct redirection URI
const getRedirectUri = (req: express.Request): string => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanUrl}/auth/callback`;
};

// 1. API to construct and return Google OAuth URL
app.get("/api/auth/google/url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    return res.status(400).json({ 
      error: "Google Client ID is missing. Please configure GOOGLE_CLIENT_ID in the application environment variables." 
    });
  }

  const redirectUri = getRedirectUri(req);
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl, configured: true });
});

// 2. OAuth Callback Route to exchange auth code for user credentials
app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(`
      <html>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #fef2f2; color: #991b1b; padding: 20px; text-align: center;">
          <div style="max-width: 450px; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #fca5a5;">
            <h2 style="margin-top: 0;">Gagal Autentikasi</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #7f1d1d;">Terjadi kesalahan saat masuk dengan Google: <strong>${error}</strong></p>
            <button onclick="window.close()" style="background-color: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 15px;">Tutup Jendela</button>
          </div>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send("Authorization code is missing.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.send(`
      <html>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #fef3c7; color: #92400e; padding: 20px; text-align: center;">
          <div style="max-width: 450px; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #fcd34d;">
            <h2 style="margin-top: 0;">Konfigurasi Belum Lengkap</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #78350f;">Kredensial Google OAuth (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET) belum dikonfigurasi di AI Studio Secrets.</p>
            <button onclick="window.close()" style="background-color: #d97706; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 15px;">Tutup Jendela</button>
          </div>
        </body>
      </html>
    `);
  }

  try {
    const redirectUri = getRedirectUri(req);

    // 1. Exchange authorization code for token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json() as { access_token: string };

    // 2. Fetch user's profile info
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userinfoResponse.ok) {
      const errorText = await userinfoResponse.text();
      throw new Error(`User info request failed: ${errorText}`);
    }

    const userData = await userinfoResponse.json() as {
      email: string;
      name: string;
      picture?: string;
    };

    // 3. Render page that communicates with client using postMessage
    res.send(`
      <html>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f0fdf4; color: #166534; padding: 20px; text-align: center;">
          <div style="max-width: 450px; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #bbf7d0;">
            <div style="width: 60px; height: 60px; background-color: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto;">
              <svg style="width: 30px; height: 30px; color: #15803d;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 style="margin-top: 0; color: #14532d;">Login Berhasil!</h2>
            <p style="font-size: 14px; color: #166534; margin-bottom: 5px;">Selamat datang, <strong>${userData.name}</strong></p>
            <p style="font-size: 12px; color: #15803d; opacity: 0.85;">Menghubungkan ke dasbor keuangan, jendela ini akan menutup...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  user: { 
                    email: ${JSON.stringify(userData.email)},
                    name: ${JSON.stringify(userData.name)},
                    picture: ${JSON.stringify(userData.picture || '')}
                  } 
                }, '*');
                setTimeout(() => {
                  window.close();
                }, 1000);
              } else {
                window.location.href = '/';
              }
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("OAuth error during callback exchange:", error);
    res.send(`
      <html>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #fef2f2; color: #991b1b; padding: 20px; text-align: center;">
          <div style="max-width: 450px; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #fca5a5;">
            <h2 style="margin-top: 0;">Error Autentikasi</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #7f1d1d;">Terjadi kesalahan teknis saat mengambil profil Google Anda.</p>
            <p style="font-size: 11px; font-family: monospace; color: #991b1b; background-color: #fef2f2; padding: 10px; border-radius: 5px; text-align: left; overflow-x: auto;">${error.message || error}</p>
            <button onclick="window.close()" style="background-color: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 15px;">Tutup Jendela</button>
          </div>
        </body>
      </html>
    `);
  }
});

// Health check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// API Webhook to receive payment transactions from Invoice App
app.post("/api/webhooks/invoice-payment", async (req, res) => {
  try {
    const { date, division, type, amount, description, invoiceNumber, paymentType } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: "Kolom amount wajib diisi." });
    }

    const validDivision = ["Konveksi", "Sablon", "Aksesori", "Alat"].includes(division) 
      ? division 
      : "Konveksi";

    let finalDescription = description;
    if (!finalDescription) {
      const tag = paymentType ? `[${paymentType}]` : '[Pembayaran]';
      const invStr = invoiceNumber ? `Invoice #${invoiceNumber}` : 'Invoice';
      finalDescription = `${tag} ${invStr}`;
    } else if (invoiceNumber && !finalDescription.toLowerCase().includes(String(invoiceNumber).toLowerCase())) {
      finalDescription = `${finalDescription} (Invoice #${invoiceNumber})`;
    }

    const txId = `tx-inv-${Date.now()}`;
    const newTransaction = {
      id: txId,
      date: date || new Date().toISOString().split('T')[0],
      division: validDivision,
      type: type || "Pemasukan",
      amount: Number(amount),
      description: finalDescription,
    };

    // Directly save to Firestore 'transactions' collection so the financial dashboard real-time listener triggers
    await setDoc(doc(serverDb, 'transactions', txId), newTransaction);

    console.log(`[Webhook Invoice] Transaksi baru berhasil disimpan ke Firestore: ${txId}`, newTransaction);

    res.json({
      success: true,
      message: "Transaksi invoice berhasil disimpan secara real-time ke Dashboard Keuangan.",
      transaction: newTransaction
    });
  } catch (err: any) {
    console.error("Gagal menyimpan transaksi webhook ke Firestore:", err);
    res.status(500).json({
      error: "Gagal menyimpan transaksi ke database.",
      details: err?.message || String(err)
    });
  }
});

// Configure Vite middleware in development or serve built files in production
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
