'use strict';

// ===================================
// CONFIGURATION
// ===================================
const CONFIG = {
    METRICS_ANIMATION_DURATION: 2000,
    SCROLL_OFFSET: 80,
};

// Replace with your actual Token Server URL
const LiveKitConfig = {
    TOKEN_URL: 'https://livekit-token-chi.vercel.app/api/token.js', // Ensure this endpoint returns { token: "..." }
    LIVEKIT_URL: "wss://aiagent-avy0myx4.livekit.cloud",
};

// ===================================
// VOICE AGENT (MERGED & FIXED)
// ===================================
class VoiceAgent {
    constructor() {
        this.room = null;
        this.isActive = false;
        this.isConnecting = false;
        
        // Audio & Visualizer Context
        this.audioContext = null;
        this.analyser = null;
        this.mediaStream = null;
        this.animationId = null;

        // DOM Elements
        this.micBtn = document.getElementById('agentMicBtn');
        this.statusText = document.querySelector('.status-text');
        this.statusDot = document.querySelector('.status-dot');
        this.canvas = document.getElementById('audioVisualizer');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        // Icons
        this.micIcon = document.querySelector('.mic-icon');
        this.stopIcon = document.querySelector('.stop-icon');

        if (this.canvas) {
            this.setupCanvas();
            this.bindEvents();
            this.drawIdleVisualization();
        }
    }

    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    bindEvents() {
        if (this.micBtn) {
            this.micBtn.addEventListener('click', () => this.toggleAgent());
        }
        window.addEventListener('resize', () => {
            if (this.canvas) this.setupCanvas();
        });
    }

    async toggleAgent() {
        if (this.isActive) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        if (this.isConnecting) return;
        
        try {
            this.isConnecting = true;
            this.updateStatus('Connecting...', 'connecting');
            this.micBtn.disabled = true;

            // 1. Setup Audio Context & Visualizer (Local Mic)
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.setupAudioAnalysis(this.mediaStream);
            this.startVisualizer();

            // 2. Fetch Token
            console.log("Fetching token...");
            const response = await fetch(LiveKitConfig.TOKEN_URL);
            if (!response.ok) throw new Error(`Token fetch failed: ${response.statusText}`);
            const data = await response.json();

            // 3. Connect to LiveKit
            console.log("Connecting to LiveKit Room...");
            this.room = new LivekitClient.Room();

            // Handle Agent's Audio (Remote Track)
            this.room.on('trackSubscribed', (track) => {
                if (track.kind === 'audio') {
                    console.log('Agent audio track received');
                    const audioElement = track.attach();
                    document.body.appendChild(audioElement);
                }
            });

            await this.room.connect(LiveKitConfig.LIVEKIT_URL, data.token, {
                autoSubscribe: true,
            });

            // Publish Local Mic to Room
            await this.room.localParticipant.setMicrophoneEnabled(true);

            // Update State to Active
            this.isActive = true;
            this.updateStatus('Connected - Listening', 'active');
            this.toggleUIState(true);

        } catch (error) {
            console.error('Connection failed:', error);
            this.updateStatus('Connection Failed', 'error');
            alert(`Could not connect: ${error.message}`);
            this.stopLocalAudio(); // Cleanup if failed
        } finally {
            this.isConnecting = false;
            this.micBtn.disabled = false;
        }
    }

    async disconnect() {
        this.updateStatus('Disconnecting...', 'connecting');
        
        if (this.room) {
            await this.room.disconnect();
            this.room = null;
        }

        this.stopLocalAudio();
        this.isActive = false;
        this.toggleUIState(false);
        this.updateStatus('Ready to Connect', 'ready');
        this.drawIdleVisualization();
    }

    setupAudioAnalysis(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
    }

    stopLocalAudio() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    toggleUIState(isActive) {
        if (isActive) {
            this.micBtn.classList.add('active');
            this.micIcon.style.display = 'none';
            this.stopIcon.style.display = 'block';
        } else {
            this.micBtn.classList.remove('active');
            this.micIcon.style.display = 'block';
            this.stopIcon.style.display = 'none';
        }
    }

    updateStatus(text, state) {
        if (this.statusText) this.statusText.textContent = text;
        if (this.statusDot) {
            this.statusDot.className = 'status-dot'; // reset
            if (state === 'active') this.statusDot.classList.add('active');
            if (state === 'connecting') this.statusDot.classList.add('connecting');
        }
    }

    drawIdleVisualization() {
        if (!this.ctx || !this.canvas) return;
        const width = this.canvas.getBoundingClientRect().width;
        const height = this.canvas.getBoundingClientRect().height;
        
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
    }

    startVisualizer() {
        if (!this.analyser) return;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (!this.isActive) return;
            this.animationId = requestAnimationFrame(draw);
            this.analyser.getByteTimeDomainData(dataArray);
            
            const width = this.canvas.getBoundingClientRect().width;
            const height = this.canvas.getBoundingClientRect().height;
            
            this.ctx.fillStyle = 'rgba(26, 31, 58, 0.2)'; // Slight trail effect
            this.ctx.fillRect(0, 0, width, height);
            
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#3B82F6';
            this.ctx.beginPath();
            
            const sliceWidth = width / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
                x += sliceWidth;
            }
            this.ctx.lineTo(width, height / 2);
            this.ctx.stroke();
        };
        draw();
    }
}

// ===================================
// UTILITIES & INTERACTIONS
// ===================================

// Navigation & Scroll
const nav = document.querySelector('.nav');
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const navLinkItems = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
});

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });
}

navLinkItems.forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
    });
});

// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({
                top: target.offsetTop - CONFIG.SCROLL_OFFSET,
                behavior: 'smooth'
            });
        }
    });
});

// Intersection Observer (Fade In)
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(30px)';
    section.style.transition = 'all 0.6s ease-out';
    observer.observe(section);
});

// Typing Effect
function typeWriter(element, text, speed = 40) {
    let i = 0;
    element.textContent = '';
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// Particle System (Interactive)
class ParticleSystem {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0.4;';
        
        const heroBg = document.querySelector('.hero-background');
        if (heroBg) {
            heroBg.appendChild(this.canvas);
            this.particles = [];
            this.mouse = { x: null, y: null };
            
            this.resize();
            this.init();
            this.animate();
            
            window.addEventListener('resize', () => this.resize());
            // Add mouse interaction
            document.querySelector('.hero').addEventListener('mousemove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                this.mouse.x = e.clientX - rect.left;
                this.mouse.y = e.clientY - rect.top;
            });
            document.querySelector('.hero').addEventListener('mouseleave', () => {
                this.mouse.x = null;
                this.mouse.y = null;
            });
        }
    }
    
    resize() {
        const hero = document.querySelector('.hero');
        if (hero) {
            this.canvas.width = hero.offsetWidth;
            this.canvas.height = hero.offsetHeight;
            this.init(); 
        }
    }
    
    init() {
        this.particles = [];
        const count = Math.floor((this.canvas.width * this.canvas.height) / 10000);
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                baseX: Math.random() * this.canvas.width,
                baseY: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 1
            });
        }
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(p => {
            // Movement
            p.x += p.vx;
            p.y += p.vy;

            // Mouse Repel Effect
            if (this.mouse.x != null) {
                const dx = this.mouse.x - p.x;
                const dy = this.mouse.y - p.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const maxDist = 100;
                
                if (distance < maxDist) {
                    const force = (maxDist - distance) / maxDist;
                    const directionX = dx / distance;
                    const directionY = dy / distance;
                    p.x -= directionX * force * 2;
                    p.y -= directionY * force * 2;
                }
            }

            // Bounce off edges
            if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;
            
            // Draw
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = '#3B82F6';
            this.ctx.fill();
        });
        
        // Connections
        this.particles.forEach((p1, i) => {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < 100) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = `rgba(59, 130, 246, ${0.15 * (1 - dist/100)})`;
                    this.ctx.stroke();
                }
            }
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Particle System
    new ParticleSystem();

    // 2. Initialize Voice Agent
    const voiceAgent = new VoiceAgent();

    // 3. Trigger Typing Effect on Hero Subtitle
    const subtitle = document.querySelector('.hero-subtitle');
    if (subtitle) {
        const text = subtitle.textContent;
        typeWriter(subtitle, text, 20); // Speed 20ms
    }

    // 4. Scroll Progress Bar
    const scrollProgress = document.createElement('div');
    scrollProgress.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#3B82F6,#60A5FA);z-index:9999;width:0;transition:width 0.1s;';
    document.body.appendChild(scrollProgress);
    
    window.addEventListener('scroll', () => {
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.scrollY / height) * 100;
        scrollProgress.style.width = scrolled + '%';
    });
    
    console.log('Portfolio initialized.');
});
    <script src="https://cdn.jsdelivr.net/npm/livekit-client@2.7.2/dist/livekit-client.umd.min.js"></script>
