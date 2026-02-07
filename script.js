'use strict';

// ===================================
// CONFIGURATION
// ===================================
const CONFIG = {
    SCROLL_OFFSET: 80,
    PARTICLE_COUNT: 60,
    CONNECTION_DISTANCE: 100,
};

// LiveKit Configuration
const LiveKitConfig = {
    TOKEN_URL: 'https://resume-token.vercel.app/api/token',
    LIVEKIT_URL: "wss://resumeai-ap63rl0b.livekit.cloud",
};

// ===================================
// VOICE AGENT WITH POST-CONNECTION JD
// ===================================
class VoiceAgent {
    constructor() {
        this.room = null;
        this.isActive = false;
        this.isConnecting = false;
        this.isConnected = false;
        
        // Audio & Visualizer Context
        this.audioContext = null;
        this.analyser = null;
        this.animationId = null;

        // DOM Elements
        this.micBtn = document.getElementById('agentMicBtn');
        this.statusText = document.querySelector('.status-text');
        this.statusDot = document.querySelector('.status-dot');
        this.canvas = document.getElementById('audioVisualizer');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        // NEW: JD Elements
        this.jdWrapper = document.getElementById('jdWrapper');
        this.instructionsWrapper = document.getElementById('instructionsWrapper');
        this.jobDescriptionInput = document.getElementById('jobDescription');
        this.submitJDBtn = document.getElementById('submitJD');
        this.agentHint = document.getElementById('agentHint');
        
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
        
        // NEW: Bind Submit JD Button
        if (this.submitJDBtn) {
            this.submitJDBtn.addEventListener('click', () => this.submitJD());
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

            // 1. Init Audio Context
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 256;
            }

            // 2. Fetch Token
            const response = await fetch(LiveKitConfig.TOKEN_URL);
            if (!response.ok) throw new Error(`Token fetch failed: ${response.statusText}`);
            const data = await response.json();

            this.room = new LivekitClient.Room();

            // 3. Handle Agent's Audio (remote tracks)
            this.room.on('trackSubscribed', (track) => {
                if (track.kind === 'audio') {
                    const audioElement = track.attach();
                    document.body.appendChild(audioElement);

                    // Connect to analyzer for visualization
                    if (track.mediaStream) {
                        const remoteSource = this.audioContext.createMediaStreamSource(track.mediaStream);
                        remoteSource.connect(this.analyser);
                    }
                }
            });

            // 4. Connect to LiveKit room
            await this.room.connect(LiveKitConfig.LIVEKIT_URL, data.token, {
                autoSubscribe: true,
            });

            // 5. Enable microphone and get the track for visualization
            await this.room.localParticipant.setMicrophoneEnabled(true);
            
            // 6. Connect local mic to analyzer for visualization
            const localAudioTrack = this.room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Microphone);
            if (localAudioTrack && localAudioTrack.track) {
                const mediaStreamTrack = localAudioTrack.track.mediaStreamTrack;
                if (mediaStreamTrack) {
                    const stream = new MediaStream([mediaStreamTrack]);
                    const localSource = this.audioContext.createMediaStreamSource(stream);
                    localSource.connect(this.analyser);
                }
            }
            
            this.startVisualizer();

            // NEW: UI Logic - Show JD Input AFTER connection
            this.isConnected = true;
            this.showJDInput();
            this.updateStatus('Connected - Add JD to Start', 'active');

        } catch (error) {
            console.error('Connection failed:', error);
            this.updateStatus('Connection Failed', 'error');
            alert(`Could not connect: ${error.message}`);
            this.resetState();
        } finally {
            this.isConnecting = false;
            this.micBtn.disabled = false;
        }
    }

    // NEW METHOD: Show JD Input
    showJDInput() {
        if (this.instructionsWrapper) this.instructionsWrapper.style.display = 'none';
        if (this.jdWrapper) {
            this.jdWrapper.style.display = 'block';
            this.jdWrapper.style.animation = 'fadeInUp 0.5s ease-out forwards';
        }
        if (this.agentHint) this.agentHint.textContent = 'Enter a Job Description to begin the interview';
        
        setTimeout(() => {
            if (this.jobDescriptionInput) this.jobDescriptionInput.focus();
        }, 300);
    }

    // NEW METHOD: Submit JD
    async submitJD() {
        const jobDescription = this.jobDescriptionInput ? this.jobDescriptionInput.value.trim() : '';
        
        if (!jobDescription) {
            alert('Please enter a Job Description.');
            return;
        }

        try {
            this.submitJDBtn.disabled = true;
            this.submitJDBtn.innerHTML = '<span class="btn-glow"></span><span class="btn-content">Starting Interview...</span>';

            // Send JD as data message to the agent
            if (this.room && this.room.localParticipant) {
                const encoder = new TextEncoder();
                const data = encoder.encode(JSON.stringify({
                    type: 'job_description',
                    content: jobDescription
                }));
                
                await this.room.localParticipant.publishData(data, { reliable: true });
            }

            this.isActive = true;
            this.updateStatus('Interview Started', 'active');
            this.toggleUIState(true);
            
            // UX Update
            if (this.jdWrapper) {
                this.jdWrapper.innerHTML = `
                    <div class="agent-context-input" style="background: rgba(0, 255, 159, 0.1); border-color: var(--color-primary); text-align: center; padding: 1rem;">
                        <p style="color: var(--color-primary); font-weight: 600;">Job Description Submitted</p>
                        <p style="color: var(--color-text-secondary); font-size: 0.85rem;">The agent is analyzing the JD. Please speak now.</p>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Failed to submit JD:', error);
            this.submitJDBtn.disabled = false;
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
        this.isConnected = false;
        this.resetState();
    }

    stopLocalAudio() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.drawIdleVisualization();
    }

    resetState() {
        this.toggleUIState(false);
        this.updateStatus('Ready to Connect', 'idle');
        
        // Reset UI
        if (this.jdWrapper) this.jdWrapper.style.display = 'none';
        if (this.instructionsWrapper) this.instructionsWrapper.style.display = 'block';
        if (this.agentHint) this.agentHint.textContent = 'Click the microphone to join the meeting';
    }

    toggleUIState(active) {
        if (this.micIcon) this.micIcon.style.display = active ? 'none' : 'block';
        if (this.stopIcon) this.stopIcon.style.display = active ? 'block' : 'none';
        if (this.micBtn) {
            if (active) {
                this.micBtn.classList.add('active');
            } else {
                this.micBtn.classList.remove('active');
            }
        }
    }

    updateStatus(text, state) {
        if (this.statusText) this.statusText.textContent = text;
        
        if (this.statusDot) {
            this.statusDot.className = 'status-dot';
            if (state === 'active') {
                this.statusDot.style.background = '#00ff9f';
                this.statusDot.style.boxShadow = '0 0 10px #00ff9f';
            } else if (state === 'connecting') {
                this.statusDot.style.background = '#ffaa00';
                this.statusDot.style.boxShadow = '0 0 10px #ffaa00';
            } else if (state === 'error') {
                this.statusDot.style.background = '#ff6b6b';
                this.statusDot.style.boxShadow = '0 0 10px #ff6b6b';
            } else {
                this.statusDot.style.background = '#8b93b8';
                this.statusDot.style.boxShadow = 'none';
            }
        }
        
        if (this.agentHint) {
            if (state === 'active') {
                this.agentHint.textContent = 'Speak now - Agent is listening';
            } else if (state === 'connecting') {
                this.agentHint.textContent = 'Connecting to voice agent...';
            }
        }
    }

    startVisualizer() {
        if (!this.analyser || !this.ctx) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);
            
            this.analyser.getByteFrequencyData(dataArray);
            
            this.ctx.clearRect(0, 0, width, height);
            
            const barWidth = width / bufferLength * 2.5;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height * 0.8;
                
                const gradient = this.ctx.createLinearGradient(0, height - barHeight, 0, height);
                gradient.addColorStop(0, 'rgba(0, 255, 159, 0.8)');
                gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.6)');
                gradient.addColorStop(1, 'rgba(0, 255, 159, 0.3)');
                
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
                
                x += barWidth;
            }
        };
        
        draw();
    }

    drawIdleVisualization() {
        if (!this.ctx) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const barCount = 64;
        const barWidth = width / barCount;
        
        const drawIdle = () => {
            if (this.isActive) return;
            
            this.ctx.clearRect(0, 0, width, height);
            
            for (let i = 0; i < barCount; i++) {
                const barHeight = Math.random() * height * 0.3;
                const x = i * barWidth;
                const y = height / 2 - barHeight / 2;
                
                const gradient = this.ctx.createLinearGradient(0, y, 0, y + barHeight);
                gradient.addColorStop(0, 'rgba(0, 255, 159, 0.3)');
                gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.2)');
                gradient.addColorStop(1, 'rgba(0, 255, 159, 0.3)');
                
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(x, y, barWidth - 2, barHeight);
            }
            
            setTimeout(drawIdle, 100);
        };
        
        drawIdle();
    }
}

// ===================================
// NAVIGATION
// ===================================
const nav = document.querySelector('.nav');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

// Mobile Navigation Toggle
if (navToggle) {
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });
}

// Close mobile menu when clicking a link
if (navLinks) {
    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

// ===================================
// SMOOTH SCROLL WITH OFFSET
// ===================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - CONFIG.SCROLL_OFFSET;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ===================================
// SCROLL PROGRESS BAR
// ===================================
const scrollProgress = document.getElementById('scrollProgress');
if (scrollProgress) {
    window.addEventListener('scroll', () => {
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.scrollY / height) * 100;
        scrollProgress.style.width = scrolled + '%';
    });
}

// ===================================
// INTERSECTION OBSERVER FOR SECTIONS
// ===================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.skill-category, .timeline-item, .project-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    sectionObserver.observe(el);
});

// ===================================
// PARTICLE SYSTEM
// ===================================
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 80;
        this.connectionDistance = 120;
        
        this.resize();
        this.init();
        this.animate();
        
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    init() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1
            });
        }
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;
            
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0, 255, 159, 0.6)';
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = 'rgba(0, 255, 159, 0.8)';
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
        
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.connectionDistance) {
                    const opacity = (1 - distance / this.connectionDistance) * 0.3;
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(0, 255, 159, ${opacity})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
        
        requestAnimationFrame(() => this.animate());
    }
}

// ===================================
// TERMINAL TYPING EFFECT
// ===================================
function initTerminalTyping() {
    const terminalText = document.getElementById('terminalText');
    if (!terminalText) return;
    
    const texts = [
        'I design and deploy enterprise-grade AI agents...',
        'Building scalable web systems with low-latency...',
        'Focus on production constraints and real-world solutions...',
        'Voice intelligence and AI-powered applications...'
    ];
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    
    function typeText() {
        const currentText = texts[textIndex];
        
        if (!isDeleting) {
            terminalText.textContent = currentText.substring(0, charIndex);
            charIndex++;
            
            if (charIndex > currentText.length) {
                isDeleting = true;
                setTimeout(typeText, 2000);
                return;
            }
        } else {
            terminalText.textContent = currentText.substring(0, charIndex);
            charIndex--;
            
            if (charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % texts.length;
            }
        }
        
        setTimeout(typeText, isDeleting ? 30 : 50);
    }
    
    typeText();
}

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Particle System
    const particleCanvas = document.getElementById('particleCanvas');
    if (particleCanvas) {
        new ParticleSystem(particleCanvas);
    }

    // 2. Initialize Voice Agent
    const voiceAgent = new VoiceAgent();
    
    // 3. Terminal Typing Effect
    initTerminalTyping();
    
    // 4. Interactive Effects
    const heroImageFrame = document.querySelector('.hero-image-frame');
    if (heroImageFrame) {
        heroImageFrame.addEventListener('mouseenter', () => {
            heroImageFrame.style.boxShadow = '0 0 60px rgba(0, 255, 159, 0.6), inset 0 0 60px rgba(0, 255, 159, 0.2)';
        });
        heroImageFrame.addEventListener('mouseleave', () => {
            heroImageFrame.style.boxShadow = '0 0 40px rgba(0, 255, 159, 0.3), inset 0 0 40px rgba(0, 255, 159, 0.1)';
        });
    }
    
    // 5. Project card effects
    document.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const glow = card.querySelector('.project-glow');
            if (glow) {
                glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(0, 255, 159, 0.2) 0%, transparent 50%)`;
            }
        });
    });
    
    console.log('Cyberpunk Portfolio initialized with LiveKit integration');
});