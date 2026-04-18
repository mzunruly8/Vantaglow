```react
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { 
  Grid, User, Palette, Trash2, Undo, Save, Sparkles, 
  BrainCircuit, X, Zap, Wand2, Cloud, Flame, MousePointer2,
  PenTool, Hash, Eraser, ChevronDown, PenLine, Pencil, Paintbrush, Highlighter,
  Wind, Stars, Activity, Cpu, Loader2, Download, Eye, EyeOff, Frame, RefreshCw
} from 'lucide-react';

const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'vantaglow-app';

const COLORS = [
  '#ff00ff', '#00ffff', '#ffff00', '#00ff00', '#ff0000', 
  '#ffffff', '#ff8800', '#7b00ff', '#ff0077', '#00ff88'
];

const BRUSHES = [
  { id: 'pencil', name: 'Pencil', icon: <Pencil size={14}/>, size: 2, alpha: 0.6 },
  { id: 'pen', name: 'Pen', icon: <PenLine size={14}/>, size: 5, alpha: 1.0 },
  { id: 'marker', name: 'Marker', icon: <Highlighter size={14}/>, size: 25, alpha: 0.4 },
  { id: 'paint', name: 'Paint', icon: <Paintbrush size={14}/>, size: 45, alpha: 0.8 },
];

const EFFECTS = [
  { id: 'solid', name: 'Solid', icon: <PenTool size={14}/> },
  { id: 'glow', name: 'Glow', icon: <Sparkles size={14}/> },
  { id: 'nebula', name: 'Nebula', icon: <Cloud size={14}/> },
  { id: 'plasma', name: 'Plasma', icon: <Wind size={14}/> },
  { id: 'stardust', name: 'Stardust', icon: <Stars size={14}/> },
  { id: 'pulse', name: 'Pulse', icon: <Activity size={14}/> },
  { id: 'circuit', name: 'Circuit', icon: <Cpu size={14}/> },
  { id: 'particle', name: 'Particle', icon: <Zap size={14}/> },
  { id: 'sparks', name: 'Sparks', icon: <Flame size={14}/> },
  { id: 'calligraphy', name: 'Script', icon: <Wand2 size={14}/> },
  { id: 'echo', name: 'Echo', icon: <MousePointer2 size={14}/> },
  { id: 'pixel', name: 'Pixel', icon: <Hash size={14}/> }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('draw'); 
  const [isRainbow, setIsRainbow] = useState(false);
  const [size, setSize] = useState(8);
  const [opacity, setOpacity] = useState(1.0);
  const [symmetry, setSymmetry] = useState(4);
  const [currentColor, setCurrentColor] = useState('#00ffff');
  const [hexInput, setHexInput] = useState('#00ffff');
  const [brushType, setBrushType] = useState('glow');
  const [isEraser, setIsEraser] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [vignette, setVignette] = useState(true);
  const [galleryItems, setGalleryItems] = useState([]);
  const [myDrawings, setMyDrawings] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hue = useRef(0);
  const history = useRef([]);

  // Shake Detection Logic
  useEffect(() => {
    let lastX, lastY, lastZ;
    let threshold = 15; 

    const handleMotion = (e) => {
        let acc = e.accelerationIncludingGravity;
        if (!acc.x) return;

        let deltaX = Math.abs(lastX - acc.x);
        let deltaY = Math.abs(lastY - acc.y);
        let deltaZ = Math.abs(lastZ - acc.z);

        if (((deltaX > threshold) && (deltaY > threshold)) || 
            ((deltaX > threshold) && (deltaZ > threshold)) || 
            ((deltaY > threshold) && (deltaZ > threshold))) {
            if (window.confirm("Shake detected! Clear canvas?")) {
                ctxRef.current.clearRect(0,0,canvasRef.current.width,canvasRef.current.height);
            }
        }

        lastX = acc.x;
        lastY = acc.y;
        lastZ = acc.z;
    };

    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', handleMotion);
    }
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubPublic = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'gallery'), (s) => {
      setGalleryItems(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));
    const unsubPrivate = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'drawings'), (s) => {
      setMyDrawings(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));
    return () => { unsubPublic(); unsubPrivate(); };
  }, [user]);

  useEffect(() => {
    if (view !== 'draw' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
  }, [view]);

  const draw = (e) => {
    if (!isDrawing.current || view !== 'draw') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;

    const ctx = ctxRef.current;
    const centerX = canvasRef.current.width / 2;
    const centerY = canvasRef.current.height / 2;
    let color = isEraser ? '#000000' : currentColor;
    
    if (isRainbow && !isEraser) {
      hue.current = (hue.current + 2) % 360;
      color = `hsl(${hue.current}, 100%, 50%)`;
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.globalAlpha = isEraser ? 1.0 : opacity;

    if (brushType === 'glow' && !isEraser) {
        ctx.shadowBlur = size * 1.5;
        ctx.shadowColor = color;
    } else if (brushType === 'nebula' && !isEraser) {
        ctx.shadowBlur = size * 4;
        ctx.shadowColor = color;
        ctx.globalAlpha = 0.2 * opacity;
    } else if (brushType === 'plasma' && !isEraser) {
        ctx.shadowBlur = size * 2;
        ctx.shadowColor = color;
        ctx.globalAlpha = 0.6 * opacity;
    } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }

    for (let i = 0; i < symmetry; i++) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((Math.PI * 2 / symmetry) * i);
      const dx = x - centerX;
      const dy = y - centerY;
      const ldx = lastPos.current.x - centerX;
      const ldy = lastPos.current.y - centerY;
      ctx.beginPath();

      if (brushType === 'calligraphy') {
          ctx.lineWidth = size * (1 - Math.abs(Math.sin(Date.now() / 100)));
          ctx.moveTo(ldx, ldy); ctx.lineTo(dx, dy); ctx.stroke();
      } else if (brushType === 'pixel') {
          ctx.fillRect(dx - size/4, dy - size/4, size/2, size/2);
      } else if (brushType === 'particle') {
          for(let j=0; j<2; j++) ctx.fillRect(dx + (Math.random()-0.5)*15, dy + (Math.random()-0.5)*15, 2, 2);
      } else if (brushType === 'stardust') {
          for(let j=0; j<3; j++) {
              ctx.globalAlpha = Math.random() * opacity;
              ctx.fillRect(dx + (Math.random()-0.5)*30, dy + (Math.random()-0.5)*30, 1.5, 1.5);
          }
      } else if (brushType === 'pulse') {
          const pulse = Math.abs(Math.sin(Date.now() / 200)) * (size * 0.5);
          ctx.arc(dx, dy, pulse, 0, Math.PI * 2);
          ctx.fill();
      } else if (brushType === 'circuit') {
          if (Math.random() > 0.9) {
              const dir = Math.random() > 0.5;
              ctx.moveTo(ldx, ldy);
              ctx.lineTo(dir ? dx : ldx, dir ? ldy : dy);
              ctx.stroke();
          }
      } else if (brushType === 'sparks') {
          ctx.moveTo(ldx, ldy); ctx.lineTo(dx, dy); ctx.stroke();
          ctx.lineWidth = 1;
          ctx.moveTo(ldx + 10, ldy + 10); ctx.lineTo(dx + 15, dy + 15); ctx.stroke();
      } else if (brushType === 'echo') {
          ctx.moveTo(ldx, ldy); ctx.lineTo(dx, dy); ctx.stroke();
          ctx.save(); ctx.globalAlpha = 0.3 * opacity;
          ctx.moveTo(ldx + 15, ldy + 15); ctx.lineTo(dx + 15, dy + 15); ctx.stroke();
          ctx.restore();
      } else {
          ctx.moveTo(ldx, ldy); ctx.lineTo(dx, dy); ctx.stroke();
      }
      ctx.restore();
    }
    lastPos.current = { x, y };
  };

  const downloadImage = () => {
    const link = document.createElement('a');
    link.download = `vantaglow_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const handleStart = (e) => {
    isDrawing.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    lastPos.current = { x: t.clientX - rect.left, y: t.clientY - rect.top };
    history.current.push(ctxRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    if (history.current.length > 20) history.current.shift();
  };

  const handleSave = async (isPublic) => {
    if (!user) return;
    setIsSaving(true);
    setSaveStatus('Archiving...');
    try {
      const drawingData = { 
        image: canvasRef.current.toDataURL('image/png'), 
        userId: user.uid, 
        timestamp: serverTimestamp(), 
        isPublic
      };
      const path = isPublic 
        ? collection(db, 'artifacts', appId, 'public', 'data', 'gallery')
        : collection(db, 'artifacts', appId, 'users', user.uid, 'drawings');
      await addDoc(path, drawingData);
      setSaveStatus('Vantaglow Saved');
      setTimeout(() => { setShowSaveModal(false); setSaveStatus(null); }, 1000);
    } catch (err) {
      setSaveStatus('Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  const analyzeDrawing = async () => {
    if (isAnalyzing || !canvasRef.current) return;
    const pixelData = ctxRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data;
    let isBlank = true;
    for (let i = 0; i < pixelData.length; i += 4) { if (pixelData[i+3] > 0) { isBlank = false; break; } }
    if (isBlank) { setAnalysisResult("Draw a spark first."); return; }
    setIsAnalyzing(true);
    const imageData = canvasRef.current.toDataURL('image/png').split(',')[1];
    try {
      const apiKey = ""; 
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Describe this neon doodle on its dark background in one poetic sentence." },
              { inlineData: { mimeType: "image/png", data: imageData } }
            ]
          }]
        })
      });
      const result = await response.json();
      setAnalysisResult(result.candidates?.[0]?.content?.parts?.[0]?.text || "A mysterious glow.");
    } catch (err) { setAnalysisResult("Magic is quiet."); } finally { setIsAnalyzing(false); }
  };

  const applyHex = () => {
    if (/^#[0-9A-F]{6}$/i.test(hexInput)) {
        setCurrentColor(hexInput);
        setIsRainbow(false);
    }
  };

  return (
    <div className={`fixed inset-0 text-white font-sans overflow-hidden transition-colors duration-500 ${transparent ? 'bg-transparent' : 'bg-black'}`}>
      
      {/* Vignette Overlay */}
      {vignette && !transparent && <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_150px_rgba(0,0,0,1)]" />}

      {/* Navigation Header */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl px-6 py-4 bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-5">
            <button onClick={() => setView('draw')} className={`p-1 ${view === 'draw' ? 'text-cyan-400' : 'text-zinc-500'}`}><Palette size={28} /></button>
            <button onClick={() => setView('gallery')} className={`p-1 ${view === 'gallery' ? 'text-cyan-400' : 'text-zinc-500'}`}><Grid size={28} /></button>
            <button onClick={() => setView('profile')} className={`p-1 ${view === 'profile' ? 'text-cyan-400' : 'text-zinc-500'}`}><User size={28} /></button>
        </div>

        {view === 'draw' && (
          <div className="flex items-center gap-5">
            <button onClick={() => setShowStudio(!showStudio)} className={`flex items-center gap-1 px-4 py-2 rounded-2xl transition-all ${showStudio ? 'bg-cyan-500 text-black' : 'bg-zinc-800 text-cyan-400'}`}>
                <span className="text-xs font-black uppercase tracking-widest">Studio</span>
                <ChevronDown size={16} className={`transition-transform duration-300 ${showStudio ? 'rotate-180' : ''}`} />
            </button>
            <div className="w-px h-6 bg-white/10" />
            <div className="relative">
                <BrainCircuit size={24} onClick={analyzeDrawing} className={`${isAnalyzing ? 'animate-pulse text-purple-400' : 'text-purple-400'}`} />
                {analysisResult && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 w-64 p-5 bg-purple-950/95 backdrop-blur-md rounded-2xl text-[11px] text-center border border-purple-400/30 shadow-2xl z-[100]">
                        <button onClick={() => setAnalysisResult(null)} className="absolute -top-2 -right-2 w-8 h-8 bg-purple-400 text-black rounded-full flex items-center justify-center"><X size={16} strokeWidth={3} /></button>
                        <p className="leading-relaxed italic">"{analysisResult}"</p>
                    </div>
                )}
            </div>
            <Undo size={24} onClick={() => history.current.length && ctxRef.current.putImageData(history.current.pop(), 0, 0)} className="text-zinc-400 active:scale-90" />
            <Trash2 size={24} onClick={() => ctxRef.current.clearRect(0,0,canvasRef.current.width,canvasRef.current.height)} className="text-red-500 active:scale-90" />
            <Save size={24} onClick={() => setShowSaveModal(true)} className="text-green-500 active:scale-90" />
          </div>
        )}
      </div>

      {/* Condense Studio Panel */}
      {showStudio && view === 'draw' && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl bg-zinc-900/95 backdrop-blur-3xl border border-white/10 rounded-[40px] p-5 shadow-2xl animate-in slide-in-from-top-4 duration-300 max-h-[70vh] overflow-y-auto no-scrollbar">
            
            <div className="flex gap-4 mb-6">
                <div className="flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block px-1">Tool Presets</span>
                    <div className="grid grid-cols-5 gap-2">
                        <button onClick={() => {setIsEraser(!isEraser); setShowStudio(false);}} className={`h-14 rounded-xl flex flex-col items-center justify-center border border-white/5 ${isEraser ? 'bg-red-500 text-white shadow-lg' : 'bg-zinc-800 text-zinc-400'}`}>
                            <Eraser size={16} /><span className="text-[8px] font-bold mt-1 uppercase">Eraser</span>
                        </button>
                        {BRUSHES.map(b => (
                            <button key={b.id} onClick={() => { setSize(b.size); setOpacity(b.alpha); setIsEraser(false); setShowStudio(false); }} className={`h-14 rounded-xl flex flex-col items-center justify-center border border-white/5 bg-zinc-800 text-zinc-400`}>
                                {b.icon}<span className="text-[8px] font-bold mt-1 uppercase">{b.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="w-24">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block px-1 text-center">Scene</span>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => setTransparent(!transparent)} className={`h-14 rounded-xl flex flex-col items-center justify-center border border-white/5 ${transparent ? 'bg-cyan-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                            {transparent ? <EyeOff size={16} /> : <Eye size={16} />}
                            <span className="text-[8px] font-bold mt-1 uppercase">Alpha</span>
                        </button>
                        <button onClick={() => setVignette(!vignette)} className={`h-14 rounded-xl flex flex-col items-center justify-center border border-white/5 ${vignette ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                            <Frame size={16} />
                            <span className="text-[8px] font-bold mt-1 uppercase">Mood</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Color Control */}
            <div className="mb-6 bg-white/5 rounded-2xl p-3 border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block">Brutalist Palette (HEX)</span>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={hexInput} 
                        onChange={(e) => setHexInput(e.target.value)}
                        className="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                        placeholder="#00FFFF"
                    />
                    <button onClick={applyHex} className="bg-cyan-600 px-4 rounded-xl active:scale-95 transition-transform"><RefreshCw size={16}/></button>
                </div>
            </div>

            <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block px-1">Visual Effects</span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {EFFECTS.map(e => (
                        <button key={e.id} onClick={() => { setBrushType(e.id); setIsEraser(false); setShowStudio(false); }} className={`h-14 rounded-xl flex flex-col items-center justify-center border border-white/5 transition-all ${brushType === e.id && !isEraser ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                            {e.icon}
                            <span className="text-[8px] font-bold mt-1 uppercase truncate w-full px-1">{e.name}</span>
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Brush Size</span>
                        <span className="text-xs font-bold text-cyan-400">{size}px</span>
                    </div>
                    <input type="range" min="1" max="150" value={size} onChange={(e) => setSize(parseInt(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none accent-cyan-500" />
                    
                    <div className="flex justify-between items-center px-1 mt-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Opacity</span>
                        <span className="text-xs font-bold text-cyan-400">{Math.round(opacity * 100)}%</span>
                    </div>
                    <input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none accent-cyan-500" />
                </div>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Symmetry</span>
                        <span className="text-xs font-bold text-purple-400">{symmetry}x</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                        {[1, 4, 8, 12, 16, 24].map(sym => (
                            <button key={sym} onClick={() => setSymmetry(sym)} className={`py-2 rounded-lg text-[9px] font-black border border-white/5 transition-all ${symmetry === sym ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-600'}`}>{sym}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {view === 'draw' && (
        <>
          <canvas ref={canvasRef} onMouseDown={handleStart} onMouseMove={draw} onMouseUp={() => isDrawing.current = false} onTouchStart={handleStart} onTouchMove={draw} onTouchEnd={() => isDrawing.current = false} className="w-full h-full touch-none relative z-20" />
          
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-sm px-5 py-4 bg-zinc-900/70 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-2xl flex items-center gap-4">
            <button onClick={() => setIsRainbow(!isRainbow)} className={`w-14 h-14 rounded-2xl border-2 transition-transform active:scale-90 ${isRainbow ? 'border-white scale-110 shadow-lg' : 'border-white/10'}`} style={{ background: isRainbow ? 'linear-gradient(45deg, #f00, #0f0, #00f)' : '#18181b' }}>{!isRainbow && <span className="text-[10px] font-black text-zinc-600">RGB</span>}</button>
            <div className="flex-grow flex gap-3 overflow-x-auto no-scrollbar py-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => { setIsRainbow(false); setCurrentColor(c); setIsEraser(false); setHexInput(c); }} className={`w-10 h-10 rounded-2xl shrink-0 border-2 transition-all active:scale-95 ${currentColor === c && !isRainbow && !isEraser ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </>
      )}

      {view !== 'draw' && (
        <div className="absolute inset-0 z-[60] bg-black overflow-y-auto pt-32 px-6 pb-24">
          <div className="flex justify-between items-center mb-8"><h1 className="text-3xl font-black uppercase tracking-tighter italic">{view}</h1><X size={32} onClick={() => setView('draw')} className="text-zinc-500" /></div>
          {view === 'gallery' && (
            <div className="grid grid-cols-2 gap-4">
              {galleryItems.length === 0 ? <p className="col-span-2 text-center text-zinc-500 text-xs">The void is empty.</p> : galleryItems.map(item => (
                <div key={item.id} className="aspect-square rounded-3xl overflow-hidden bg-zinc-900 border border-white/5 shadow-xl"><img src={item.image} className="w-full h-full object-cover" /></div>
              ))}
            </div>
          )}
          {view === 'profile' && (
            <div className="space-y-10">
              <div className="flex items-center gap-6 p-8 bg-zinc-900/50 rounded-[40px] border border-white/5">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-[28px] flex items-center justify-center text-black text-3xl font-black">{user?.uid.charAt(0).toUpperCase()}</div>
                <div><h3 className="text-xl font-bold leading-tight">Vantaglow<br/>Creator</h3><p className="text-xs text-zinc-500 font-mono mt-1">ID: {user?.uid.slice(0, 8)}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {myDrawings.map(item => (<img key={item.id} src={item.image} className="w-full aspect-square object-cover rounded-3xl border border-white/5 shadow-sm" />))}
              </div>
            </div>
          )}
        </div>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[110] flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-white/10 p-8 rounded-[48px] w-full max-w-xs space-y-4 text-center shadow-3xl">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">{saveStatus || 'Vantaglow Archive'}</h3>
            <button onClick={downloadImage} className="w-full py-6 bg-cyan-600 text-white font-black rounded-[28px] text-base uppercase flex items-center justify-center gap-3 active:scale-95 transition-transform">
                <Download size={20} /> Download PNG
            </button>
            <div className="h-px bg-white/5 my-2" />
            <button disabled={isSaving} onClick={() => handleSave(false)} className="w-full py-4 bg-white/5 text-zinc-300 font-black rounded-[24px] text-xs uppercase flex items-center justify-center gap-3 active:scale-95 transition-transform">
                {isSaving && <Loader2 className="animate-spin" size={16} />} Sync Private
            </button>
            <button disabled={isSaving} onClick={() => handleSave(true)} className="w-full py-4 bg-white/5 text-zinc-300 font-black rounded-[24px] text-xs uppercase flex items-center justify-center gap-3 active:scale-95 transition-transform">
                {isSaving && <Loader2 className="animate-spin" size={16} />} Post Public
            </button>
            <button onClick={() => setShowSaveModal(false)} className="pt-2 text-zinc-600 text-[10px] font-black uppercase">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}


```
