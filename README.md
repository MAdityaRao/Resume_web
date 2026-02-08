# 🤖 AI-Powered Portfolio with Voice Interview Agent

A futuristic, cyberpunk-themed portfolio website featuring an intelligent voice-enabled AI agent that conducts real-time job interviews based on your resume and job descriptions.

## ✨ Features

### 🎨 **Cyberpunk UI/UX**
- **Particle Background System** - Dynamic animated particle network
- **Scan Lines & Grid Effects** - Retro-futuristic visual aesthetics
- **Glitch Text Animations** - Cyberpunk-style typography effects
- **Terminal-style Components** - Command-line inspired interfaces
- **Smooth Scroll Progress** - Visual scroll indicator
- **Responsive Design** - Optimized for all devices

### 🎙️ **AI Voice Interview Agent**
- **Real-time Voice Interaction** - Speak naturally with the AI agent
- **Context-Aware Responses** - Answers based on your resume and job description
- **LiveKit Integration** - Professional-grade WebRTC voice streaming
- **Audio Visualization** - Real-time waveform and ring animations
- **Job Description Analysis** - AI evaluates fit between resume and JD
- **Professional Interview Simulation** - Practice for real interviews

### 🧠 **Intelligent Features**
- **Resume-Based Knowledge** - Agent trained on your actual resume
- **Dynamic JD Processing** - Paste any job description to start
- **First-Person Responses** - Agent speaks as you, the candidate
- **Skill Gap Handling** - Pivots to related strengths when needed
- **Concise Answers** - Professional 30-45 word responses

### 📱 **Portfolio Sections**
- **Hero Section** - Eye-catching introduction with status indicators
- **About** - Professional background and expertise
- **Experience** - Work history with animations
- **Projects** - Portfolio showcase with live demos
- **Skills** - Technical stack visualization
- **Contact** - Multiple communication channels

## 🚀 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Web server for local development (optional)
- LiveKit account for voice agent functionality

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/MAdityaRao/Resume_web.git
cd resume_web
```

2. **Setup your resume**
```bash
# Create resume.txt with your resume content
# The AI agent will use this as its knowledge base
echo "Your resume content here..." > resume.txt
```

3. **Configure LiveKit** (for voice agent)
   - Sign up at [LiveKit Cloud](https://livekit.io/)
   - Update `script.js` with your LiveKit credentials:
```javascript
const LiveKitConfig = {
    TOKEN_URL: 'YOUR_TOKEN_SERVER_URL',
    LIVEKIT_URL: 'YOUR_LIVEKIT_WSS_URL',
};
```

4. **Customize content**
   - Edit `index.html` to update personal information
   - Modify `styles.css` for custom color schemes
   - Update project details and links

5. **Run locally**
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx serve

# Or simply open index.html in your browser
```

6. **Deploy**
   - Upload to any static hosting service (Netlify, Vercel, GitHub Pages)
   - Ensure HTTPS for LiveKit voice functionality

## 📂 Project Structure

```
.
├── index.html              # Main HTML structure
├── styles.css              # Cyberpunk theme & animations
├── script.js               # Voice agent & interactive features
├── resume.txt              # Your resume (AI knowledge base)
├── resume.docx             # Downloadable resume
├── profile-photo.png       # Your profile picture
└── README.md               # Documentation
```

## 🎯 How the AI Agent Works

### **Workflow**
1. **User clicks microphone** → Connects to LiveKit room
2. **Connection established** → JD input field appears
3. **User pastes Job Description** → Sent to AI agent
4. **Agent analyzes fit** → Evaluates resume vs. JD
5. **Voice interview begins** → Real-time Q&A conversation

### **Agent Behavior**
- **Persona**: Speaks as you (first person: "I have...", "My experience...")
- **Strategy**: 
  - ✅ **Match Found** → Enthusiastic confirmation with project examples
  - ⚠️ **Skill Gap** → Pivots to related strengths + learning ability
- **Style**: Concise, professional, natural spoken language

### **Technical Stack**
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Voice**: LiveKit WebRTC (real-time audio streaming)
- **AI Backend**: LiveKit Agents framework
- **STT**: AssemblyAI (Speech-to-Text)
- **LLM**: GPT-4o-mini (OpenAI)
- **TTS**: ElevenLabs Flash v2 (Text-to-Speech)

## 🛠️ Configuration

### **Customizing the Agent**

Edit `agent.py` (backend):
```python
# Update resume path
RESUME_FILE_PATH = "resume.txt"

# Customize agent instructions
instructions=f"""
Your custom instructions here...
Resume: {RESUME_CONTENT}
Job Description: {jd_content}
"""
```

### **Styling**

Edit CSS variables in `styles.css`:
```css
:root {
    --color-primary: #00ff9f;      /* Neon green */
    --color-secondary: #00d9ff;    /* Cyan */
    --color-accent: #ff006e;       /* Pink */
    /* Customize all theme colors */
}
```

### **LiveKit Backend Setup**

```bash
# Install dependencies
pip install livekit livekit-agents python-dotenv

# Create .env.local
echo "LIVEKIT_API_KEY=your_key" >> .env.local
echo "LIVEKIT_API_SECRET=your_secret" >> .env.local

# Run the agent
python agent.py start
```

## 🎨 Color Scheme

```css
Primary:     #00ff9f  /* Neon Green */
Secondary:   #00d9ff  /* Cyan */
Accent:      #ff006e  /* Pink */
Background:  #0a0a0f  /* Deep Dark */
Surface:     #1a1a2e  /* Dark Blue */
Text:        #ffffff  /* White */
```

## 🔧 Advanced Features

### **Custom Animations**
```javascript
// Add custom particle effects
const CONFIG = {
    PARTICLE_COUNT: 60,        // Number of particles
    CONNECTION_DISTANCE: 100,  // Connection range
};
```

### **Audio Visualization**
```javascript
// Customize visualizer
analyser.fftSize = 256;  // FFT size (32-32768)
analyser.smoothingTimeConstant = 0.8;  // Smoothing (0-1)
```

### **Job Description Templates**
Pre-load JD templates for quick testing:
```javascript
const JD_TEMPLATES = {
    frontend: "Looking for React developer...",
    backend: "Python Django expert needed...",
    fullstack: "Full-stack MERN developer..."
};
```

## 📊 Performance

- **Lighthouse Score**: 95+ (Performance, Accessibility, Best Practices)
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 2.5s
- **Voice Latency**: ~300-500ms (LiveKit + AI processing)

## 🐛 Troubleshooting

### **Agent not connecting?**
- Check LiveKit credentials in `script.js`
- Verify token server is running
- Ensure HTTPS (required for microphone access)

### **No audio?**
- Check browser microphone permissions
- Verify LiveKit quota limits
- Test with different TTS/STT providers

### **Styling issues?**
- Clear browser cache
- Check for CSS conflicts
- Verify Google Fonts are loading

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [LiveKit](https://livekit.io/) - Real-time voice streaming
- [ElevenLabs](https://elevenlabs.io/) - High-quality TTS
- [AssemblyAI](https://www.assemblyai.com/) - Speech recognition
- [OpenAI](https://openai.com/) - GPT-4 language model
- [Google Fonts](https://fonts.google.com/) - Orbitron & Rajdhani fonts

## 📞 Contact

**Aditya Rao**
- GitHub: [@MAdityaRao](https://github.com/MAdityaRao)
- Email:madityarao5@gmail.com
- Location: Belman, Karnataka, India

---
for agent setup vist
git clone https://github.com/MAdityaRao/Resume_agent.git

**⭐ Star this repo if you found it helpful!**

Built with 💚 using cutting-edge AI technology

</div>