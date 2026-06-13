const axios = require('axios');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

class O2GClient extends EventEmitter {
  constructor(config) {
    super();
    this.baseURL = config.baseURL;
    this.appName = config.appName;
    this.appPassword = config.appPassword;
    this.deviceId = config.deviceId;
    
    // Axios instance config
    this.api = axios.create({
      baseURL: `${this.baseURL}/api/rest/1.0`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.cookie = null;
    this.ws = null;
    this.activeCalls = new Map();
  }

  // 1. Authentification pour récupérer le cookie de session (JSESSIONID)
  async authenticate() {
    try {
      // Dans certains cas O2G utilise les credentials dans le body, 
      // ou en basic auth. On utilise ici l'URL params par défaut, 
      // à ajuster selon la conf de votre O2G.
      const url = `/authenticate?login=${encodeURIComponent(this.appName)}&password=${encodeURIComponent(this.appPassword)}`;
      const response = await this.api.post(url);
      
      const setCookie = response.headers['set-cookie'];
      if (setCookie && setCookie.length > 0) {
        this.cookie = setCookie[0].split(';')[0];
        this.api.defaults.headers.common['Cookie'] = this.cookie;
        console.log("✅ Authentification O2G réussie");
        return true;
      } else {
        throw new Error("Pas de cookie reçu lors de l'authentification.");
      }
    } catch (error) {
      console.error("❌ Erreur d'authentification O2G:", error.message);
      throw error;
    }
  }

  // 2. Création de la souscription pour recevoir les événements CSTA du poste
  async createSubscription() {
    try {
      await this.api.post('/subscriptions', {
        deviceId: this.deviceId,
        type: 'TELEPHONY' // O2G Call Control
      });
      console.log(`✅ Souscription CSTA créée pour le poste ${this.deviceId}`);
    } catch (error) {
      console.error("❌ Erreur de souscription O2G:", error.message);
      throw error;
    }
  }

  // 3. Ouverture de la WebSocket pour écouter en temps réel
  openWebSocket() {
    return new Promise((resolve, reject) => {
      // Conversion d'URL http(s) -> ws(s)
      const wsUrl = `${this.baseURL}/api/rest/1.0/notifications`.replace(/^http/, 'ws');
      
      this.ws = new WebSocket(wsUrl, {
        headers: this.cookie ? { Cookie: this.cookie } : {}
      });

      this.ws.on('open', () => {
        console.log("✅ WebSocket O2G connectée");
        // S'inscrire à l'écoute des events de ce device
        this.ws.send(JSON.stringify({
          action: 'subscribe',
          deviceId: this.deviceId
        }));
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleO2gEvent(event);
        } catch (error) {
          console.error("❌ Erreur de parsing WS:", error.message);
        }
      });

      this.ws.on('error', (err) => {
        console.error("❌ Erreur WebSocket:", err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log("⚠️ WebSocket O2G fermée");
        this.emit('disconnected');
      });
    });
  }

  // Initialisation complète
  async connect() {
    await this.authenticate();
    await this.createSubscription();
    await this.openWebSocket();
    return this.getState();
  }

  // Traitement des événements reçus via WebSocket
  handleO2gEvent(event) {
    console.log("📨 Event O2G Reçu:", event.eventName);

    if (event.eventName === 'OnCallCreated' || event.eventName === 'OnCallModified') {
      const call = this.normalizeCall(event.call);
      this.activeCalls.set(call.id, call);
      this.emit('call.updated', call);
      this.emit('state.changed', this.getState());
    } 
    else if (event.eventName === 'OnCallRemoved') {
      this.activeCalls.delete(event.callId);
      this.emit('call.ended', { id: event.callId, reason: event.reason });
      this.emit('state.changed', this.getState());
    }
  }

  // Normaliser le format Alcatel compliqué vers un format simple pour React
  normalizeCall(o2gCall) {
    const stateMap = {
      DIALING: 'dialing',
      RINGING: 'ringing',
      ACTIVE: 'active',
      RELEASED: 'ended'
    };

    return {
      id: o2gCall.callId,
      deviceId: o2gCall.deviceId,
      caller: o2gCall.caller,
      callee: o2gCall.callee,
      state: stateMap[o2gCall.state] || o2gCall.state?.toLowerCase(),
      direction: o2gCall.direction || (o2gCall.caller === o2gCall.deviceId ? 'outgoing' : 'incoming'),
    };
  }

  // --- ACTIONS CTI ---

  async makeCall(callee) {
    const response = await this.api.post('/telephony/basicCall', {
      deviceId: this.deviceId,
      callee: callee,
      autoAnswer: false
    });
    return response.data;
  }

  async answerCall(callId) {
    const response = await this.api.post(`/telephony/calls/${callId}/answer`);
    return response.data;
  }

  async hangupCall(callId) {
    const response = await this.api.delete(`/telephony/calls/${callId}`);
    return response.data;
  }

  getState() {
    return {
      deviceId: this.deviceId,
      activeCalls: Array.from(this.activeCalls.values())
    };
  }
}

module.exports = O2GClient;
