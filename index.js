/*  Script Web By : Xvoid
Bukan untuk dijual !!
*/

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const chatSessions = {};

const CONFIG = {
  GEMINI: {
    URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    API_KEY: 'AIzaSyDygP13EtFP5SQv7pE5cPoD4Z9DSAfnMtI',
    HEADERS: {
      'User-Agent': 'okhttp/5.3.2',
      'Accept-Encoding': 'gzip',
      'content-type': 'application/json; charset=UTF-8',
      'x-goog-api-key': 'AIzaSyAKbxdxfyNoQMx9ft9xAVoQWrwpN9JnphY',
      'x-android-package': 'com.jetkite.gemmy',
      'x-android-cert': '037CD2976D308B4EFD63EC63C48DC6E7AB7E5AF2'
    }
  },
  IMAGEN: {
    URL: 'https://firebasevertexai.googleapis.com/v1beta/projects/gemmy-ai-bdc03/models/imagen-4.0-fast-generate-001:predict',
    HEADERS: {
      'User-Agent': 'ktor-client',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-goog-api-key': 'AIzaSyAxof8_SbpDcww38NEQRhNh0Pzvbphh-IQ'
    }
  }
};

const SYSTEM_INSTRUCTION = {
  role: 'user',
  parts: [{ text: 'Kamu adalah asisten AI yang ramah dan helpful. Jawab dengan singkat dan padat dalam bahasa yang sopan.' }]
};

function decrypt(enc) {
  try {
    const input = Buffer.from(enc, 'base64');
    const key = Buffer.from('G3mmy@pp_2025_S3cur3K3y!');
    const out = Buffer.alloc(input.length);

    for (let i = 0; i < input.length; i++) {
      out[i] = input[i] ^ key[i % key.length];
    }
    return out.toString();
  } catch (err) {
    console.error('Decrypt error:', err.message);
    return null;
  }
}

async function refreshApiKey() {
  try {
    const { data } = await axios.get(
      'https://firebasestorage.googleapis.com/v0/b/gemmy-ai-bdc03.appspot.com/o/remote_config.json?alt=media',
      { timeout: 10000 }
    );
    
    const enc = data?.remote_config?.[0]?.gemini_api_key;
    if (!enc) return false;

    const key = decrypt(enc);
    if (!key) return false;

    CONFIG.GEMINI.API_KEY = key;
    CONFIG.GEMINI.HEADERS['x-goog-api-key'] = key;
    console.log('✅ API Key refreshed');
    return true;
  } catch (err) {
    console.error('❌ Refresh API key failed:', err.message);
    return false;
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/build', async (req, res) => {
  try {
    const { url, email, name } = req.body;
    const apiKey = 'bagus';

    if (!url || !email || !name) {
      return res.status(400).json({ 
        status: false, 
        message: 'Missing required parameters.' 
      });
    }

    const apiURL = `https://web2apk-cg.zone.id/tools/web2app?apikey=${apiKey}&url=${encodeURIComponent(url)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;

    const { data } = await axios.get(apiURL, { 
      timeout: 60000,
      validateStatus: () => true 
    });
    
    res.json(data);
  } catch (err) {
    console.error('Web2APK Error:', err.message);
    res.status(500).json({ 
      status: false, 
      message: err.message || 'Server Error' 
    });
  }
});

app.post('/api/ai-chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ 
        status: false, 
        message: 'Message is required.' 
      });
    }

    const sessionId = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'default')
      .split(',')[0]
      .trim()
      .replace(/:/g, '_');
    
    if (!chatSessions[sessionId]) {
      chatSessions[sessionId] = [];
    }

    const parts = [{ text: message }];

    const payload = {
      contents: [
        ...chatSessions[sessionId],
        { role: 'user', parts }
      ],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.9
      },
      systemInstruction: SYSTEM_INSTRUCTION
    };

    let response;

    try {
      response = await axios.post(CONFIG.GEMINI.URL, payload, {
        headers: CONFIG.GEMINI.HEADERS,
        timeout: 30000
      });
    } catch (err) {
      console.log('⚠️ Retrying with refreshed API key...');
      
      if (await refreshApiKey()) {
        response = await axios.post(CONFIG.GEMINI.URL, payload, {
          headers: CONFIG.GEMINI.HEADERS,
          timeout: 30000
        });
      } else {
        throw new Error('AI service unavailable');
      }
    }

    const reply = response.data?.candidates?.[0]?.content;
    
    if (!reply || !reply.parts || !reply.parts[0]) {
      return res.status(500).json({ 
        status: false, 
        message: 'AI tidak merespon dengan benar.' 
      });
    }

    const aiText = reply.parts[0].text;

    chatSessions[sessionId].push({ role: 'user', parts });
    chatSessions[sessionId].push(reply);

    if (chatSessions[sessionId].length > 20) {
      chatSessions[sessionId] = chatSessions[sessionId].slice(-20);
    }

    res.json({
      status: true,
      message: aiText
    });

  } catch (err) {
    console.error('AI Chat Error:', err.message);
    res.status(500).json({ 
      status: false, 
      message: err.response?.data?.error?.message || 'AI error, coba lagi nanti.' 
    });
  }
});

app.post('/api/ai-image', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ 
        status: false, 
        message: 'Prompt is required.' 
      });
    }

    const payload = {
      instances: [{ prompt: prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '1:1',
        imageOutputOptions: {
          mimeType: 'image/jpeg',
          compressionQuality: 100
        }
      }
    };

    const response = await axios.post(CONFIG.IMAGEN.URL, payload, {
      headers: CONFIG.IMAGEN.HEADERS,
      timeout: 60000
    });

    const imageBase64 = response.data.predictions?.[0]?.bytesBase64Encoded;
    
    if (!imageBase64) {
      return res.status(500).json({
        status: false,
        message: 'Gagal generate gambar'
      });
    }

    const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

    res.json({
      status: true,
      imageUrl: imageUrl
    });

  } catch (err) {
    console.error('AI Image Error:', err.message);
    res.status(500).json({ 
      status: false, 
      message: err.response?.data?.error?.message || 'AI Image Server Error' 
    });
  }
});

app.post('/api/clear-session', (req, res) => {
  try {
    const sessionId = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'default')
      .split(',')[0]
      .trim()
      .replace(/:/g, '_');
    
    if (chatSessions[sessionId]) {
      delete chatSessions[sessionId];
    }
    
    res.json({ status: true, message: 'Session cleared' });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

app.get('/api/session-status', (req, res) => {
  try {
    const sessionId = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'default')
      .split(',')[0]
      .trim()
      .replace(/:/g, '_');
    
    const totalUsers = Object.keys(chatSessions).length;
    const myHistory = chatSessions[sessionId] ? chatSessions[sessionId].length : 0;

    res.json({
      status: true,
      data: {
        totalUsers,
        myHistory,
        note: 'Session stored in memory (resets on server restart)'
      }
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

module.exports = app;