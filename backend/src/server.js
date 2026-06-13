require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const O2GClient = require('./O2GClient');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Configuration O2G depuis le .env
const o2gConfig = {
  baseURL: process.env.O2G_BASE_URL,
  appName: process.env.O2G_APP_NAME,
  appPassword: process.env.O2G_APP_PASSWORD,
  deviceId: process.env.O2G_DEVICE_ID
};

let client = null;

// Gérer les certificats SSL auto-signés si nécessaire
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

io.on('connection', (socket) => {
  console.log('🟢 Nouveau client UI connecté:', socket.id);
  if (client) {
    socket.emit('telephony:state', client.getState());
  }

  socket.on('disconnect', () => {
    console.log('🔴 Client UI déconnecté:', socket.id);
  });
});

// Route pour initialiser la connexion avec l'Alcatel
app.post('/api/connect', async (req, res) => {
  try {
    // On permet de surcharger la configuration via le body
    const config = { ...o2gConfig, ...req.body };
    
    if (!config.baseURL || !config.appName || !config.appPassword || !config.deviceId) {
      return res.status(400).json({ error: "Configuration O2G incomplète." });
    }

    // Instanciation du client métier
    client = new O2GClient(config);

    // Relais des événements du client O2G vers le frontend React
    client.on('state.changed', (state) => {
      io.emit('telephony:state', state);
    });

    client.on('call.updated', (call) => {
      io.emit('telephony:event', { type: 'call.updated', call });
    });

    client.on('call.ended', (payload) => {
      io.emit('telephony:event', { type: 'call.ended', payload });
    });

    client.on('disconnected', () => {
      io.emit('telephony:event', { type: 'session.closed' });
    });

    // Connexion effective (Auth + WS)
    const initialState = await client.connect();
    
    res.json({ message: "Connecté à O2G avec succès", state: initialState });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour lancer un appel
app.post('/api/calls/make', async (req, res) => {
  if (!client) return res.status(400).json({ error: "Non connecté à l'O2G" });
  try {
    const { callee } = req.body;
    const result = await client.makeCall(callee);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour répondre à un appel entrant
app.post('/api/calls/:callId/answer', async (req, res) => {
  if (!client) return res.status(400).json({ error: "Non connecté à l'O2G" });
  try {
    const result = await client.answerCall(req.params.callId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour raccrocher
app.delete('/api/calls/:callId', async (req, res) => {
  if (!client) return res.status(400).json({ error: "Non connecté à l'O2G" });
  try {
    await client.hangupCall(req.params.callId);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Serveur Backend Alcatel O2G démarré sur http://localhost:${PORT}`);
});
