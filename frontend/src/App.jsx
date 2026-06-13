import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './index.css';

// Remplacer par l'URL de votre backend si différent
const BACKEND_URL = 'http://localhost:4000';

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeCalls, setActiveCalls] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  
  // Formulaire CTI
  const [callee, setCallee] = useState('');

  // Initialisation Socket.io
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connecté au backend via Socket.io');
    });

    newSocket.on('telephony:state', (state) => {
      console.log('State reçu:', state);
      if (state.deviceId) {
        setIsConnected(true);
        setDeviceId(state.deviceId);
      }
      setActiveCalls(state.activeCalls || []);
    });

    newSocket.on('telephony:event', (event) => {
      console.log('Event CSTA reçu:', event);
    });

    return () => newSocket.close();
  }, []);

  // Déclencher un appel HTTP vers le backend
  const handleMakeCall = async (e) => {
    e.preventDefault();
    if (!callee) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/calls/make`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callee })
      });
      if (!res.ok) throw new Error("Erreur lors de l'appel");
      setCallee('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAnswer = async (callId) => {
    try {
      await fetch(`${BACKEND_URL}/api/calls/${callId}/answer`, { method: 'POST' });
    } catch (err) {
      alert("Erreur lors de la réponse");
    }
  };

  const handleHangup = async (callId) => {
    try {
      await fetch(`${BACKEND_URL}/api/calls/${callId}`, { method: 'DELETE' });
    } catch (err) {
      alert("Erreur lors du raccrochage");
    }
  };

  const connectBackendToAlcatel = async () => {
    try {
      // Dans une vraie app, on pourrait envoyer les identifiants ici.
      // Pour l'instant, le backend utilise ses propres variables d'environnement (.env)
      const res = await fetch(`${BACKEND_URL}/api/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error("Impossible de se connecter à l'O2G.");
      // Le state arrivera via Socket.io
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="app-container">
      <header className="glass-header">
        <h1>Console Opérateur Alcatel</h1>
        <div className={`status-badge ${isConnected ? 'online' : 'offline'}`}>
          {isConnected ? `En Ligne - Poste ${deviceId}` : 'Hors Ligne'}
        </div>
      </header>

      <main className="main-content">
        {!isConnected ? (
          <section className="glass-card connect-section">
            <h2>Connexion O2G</h2>
            <p>Connectez le serveur à la passerelle Alcatel OmniPCX.</p>
            <button className="btn-primary" onClick={connectBackendToAlcatel}>
              Établir la connexion
            </button>
          </section>
        ) : (
          <div className="dashboard">
            <section className="glass-card dialer-section">
              <h2>Composeur</h2>
              <form onSubmit={handleMakeCall} className="dialer-form">
                <input 
                  type="text" 
                  value={callee}
                  onChange={(e) => setCallee(e.target.value)}
                  placeholder="Numéro à appeler..." 
                  className="dial-input"
                />
                <button type="submit" className="btn-success">Appeler</button>
              </form>
            </section>

            <section className="calls-section">
              <h2>Appels en cours ({activeCalls.length})</h2>
              {activeCalls.length === 0 ? (
                <p className="no-calls">Aucun appel actif.</p>
              ) : (
                <div className="calls-grid">
                  {activeCalls.map(call => (
                    <div key={call.id} className={`glass-card call-card ${call.state}`}>
                      <div className="call-header">
                        <span className="call-direction">{call.direction === 'incoming' ? '↙ Entrant' : '↗ Sortant'}</span>
                        <span className={`call-state-badge ${call.state}`}>{call.state}</span>
                      </div>
                      <div className="call-details">
                        <p><strong>De:</strong> {call.caller}</p>
                        <p><strong>Vers:</strong> {call.callee}</p>
                      </div>
                      <div className="call-actions">
                        {call.state === 'ringing' && (
                          <button className="btn-success" onClick={() => handleAnswer(call.id)}>Répondre</button>
                        )}
                        {call.state !== 'ended' && (
                          <button className="btn-danger" onClick={() => handleHangup(call.id)}>Raccrocher</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
