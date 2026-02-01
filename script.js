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
// In frontend/script.js

const LiveKitConfig = {
    TOKEN_URL: 'https://resume-token.vercel.app/api/token', // Must end in /api/token
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
            this.submitJDBtn.textContent = 'Starting Interview...';

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
                    <div class="agent-context-input" style="background: rgba(34, 197, 94, 0.1); border-color: var(--color-success); text-align: center; padding: 1rem;">
                        <p style="color: var(--color-success); font-weight: 600;">Job Description Submitted</p>
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
        this.toggleUIState(false);
        this.resetUI(); // Call reset UI
        this.updateStatus('Ready to Connect', 'ready');
        this.drawIdleVisualization();
    }

    resetState() {
        this.isConnecting = false;
        this.isConnected = false;
        this.micBtn.disabled = false;
    }

    // NEW METHOD: Reset UI to initial state
    resetUI() {
        if (this.instructionsWrapper) this.instructionsWrapper.style.display = 'block';
        if (this.jdWrapper) {
            this.jdWrapper.style.display = 'none';
            // Restore original HTML for next session
            this.jdWrapper.innerHTML = `
                <label for="jobDescription" class="agent-context-label">Recruiter Mode: Paste JD</label>
                <textarea id="jobDescription" class="agent-context-input" placeholder="Paste the Job Description here..."></textarea>
                <button class="btn btn-primary" id="submitJD" style="margin-top: var(--spacing-md); width: 100%;">Submit & Start Interview</button>
            `;
            // Re-bind listener because we replaced innerHTML
            this.jobDescriptionInput = document.getElementById('jobDescription');
            this.submitJDBtn = document.getElementById('submitJD');
            if (this.submitJDBtn) this.submitJDBtn.addEventListener('click', () => this.submitJD());
        }
        if (this.agentHint) this.agentHint.textContent = 'Click the microphone to join the meeting';
    }

    // ... (rest of the methods like stopLocalAudio, toggleUIState, updateStatus, drawIdleVisualization, startVisualizer remain exactly the same)
    
    stopLocalAudio() {
        // LiveKit manages the microphone stream, so we don't need to stop it manually
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
            this.analyser = null;
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
            this.statusDot.className = 'status-dot';
            if (state === 'active') this.statusDot.classList.add('active');
            if (state === 'connecting') this.statusDot.classList.add('connecting');
            if (state === 'error') this.statusDot.classList.add('error');
        }
    }

    drawIdleVisualization() {
        // ... (keep original code)
        if (!this.ctx || !this.canvas) return;
        const width = this.canvas.getBoundingClientRect().width;
        const height = this.canvas.getBoundingClientRect().height;
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.strokeStyle = 'rgba(78, 205, 196, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        const time = Date.now() * 0.001;
        for (let x = 0; x < width; x += 2) {
            const y = height / 2 + Math.sin(x * 0.02 + time) * 10;
            if (x === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
        if (!this.isActive) requestAnimationFrame(() => this.drawIdleVisualization());
    }

    startVisualizer() {
       // ... (keep original code)
       if (!this.analyser) return;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const draw = () => {
            if (!this.isActive && !this.isConnected) return;
            this.animationId = requestAnimationFrame(draw);
            this.analyser.getByteTimeDomainData(dataArray);
            const width = this.canvas.getBoundingClientRect().width;
            const height = this.canvas.getBoundingClientRect().height;
            this.ctx.fillStyle = 'rgba(26, 35, 50, 0.2)';
            this.ctx.fillRect(0, 0, width, height);
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#4ecdc4';
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = '#4ecdc4';
            this.ctx.beginPath();
            const sliceWidth = width / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * height / 2;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
                x += sliceWidth;
            }
            this.ctx.lineTo(width, height / 2);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        };
        draw();
    }
}

// ===================================
// NAVIGATION
// ===================================
const nav = document.querySelector('.nav');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

// Scroll effect
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

document.querySelectorAll('.section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(30px)';
    section.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    sectionObserver.observe(section);
});

// ===================================
// TYPING EFFECT
// ===================================
function typeWriter(element, text, speed = 25) {
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

// ===================================
// PARTICLE SYSTEM
// ===================================
class ParticleSystem {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0.6;';
        
        const heroBg = document.getElementById('heroBackground');
        if (heroBg) {
            heroBg.appendChild(this.canvas);
            this.particles = [];
            this.mouse = { x: null, y: null };
            
            this.resize();
            this.init();
            this.animate();
            
            window.addEventListener('resize', () => this.resize());
            
            // Mouse interaction
            const hero = document.querySelector('.hero');
            if (hero) {
                hero.addEventListener('mousemove', (e) => {
                    const rect = this.canvas.getBoundingClientRect();
                    this.mouse.x = e.clientX - rect.left;
                    this.mouse.y = e.clientY - rect.top;
                });
                
                hero.addEventListener('mouseleave', () => {
                    this.mouse.x = null;
                    this.mouse.y = null;
                });
            }
        }
    }
    
    resize() {
        const hero = document.querySelector('.hero');
        if (hero) {
            this.canvas.width = hero.offsetWidth;
            this.canvas.height = hero.offsetHeight;
        }
    }
    
    init() {
        this.particles = [];
        const count = Math.min(CONFIG.PARTICLE_COUNT, Math.floor((this.canvas.width * this.canvas.height) / 15000));
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1
            });
        }
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Mouse interaction
            if (this.mouse.x != null) {
                const dx = this.mouse.x - p.x;
                const dy = this.mouse.y - p.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const maxDist = CONFIG.CONNECTION_DISTANCE;
                
                if (distance < maxDist && distance > 0) {
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
            
            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = '#4ecdc4';
            this.ctx.shadowBlur = 6;
            this.ctx.shadowColor = '#4ecdc4';
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
        
        // Draw connections
        this.particles.forEach((p1, i) => {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < CONFIG.CONNECTION_DISTANCE) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    const opacity = 0.15 * (1 - dist/CONFIG.CONNECTION_DISTANCE);
                    this.ctx.strokeStyle = `rgba(78, 205, 196, ${opacity})`;
                    this.ctx.lineWidth = 1;
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

    // 3. Typing Effect on Hero Subtitle
    const subtitle = document.getElementById('heroSubtitle');
    if (subtitle) {
        const text = subtitle.textContent;
        typeWriter(subtitle, text, 20);
    }
    
    console.log('Premium Portfolio initialized');
});