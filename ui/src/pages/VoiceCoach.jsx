import { useState, useEffect, useRef } from 'react';
import { 
  Presentation, Mic, Square, Settings, Layout, 
  Sparkles, Clock, AlertCircle, CheckCircle2, 
  ChevronRight, RefreshCw, Volume2, Activity, Play, Award
} from 'lucide-react';
import gsap from 'gsap';

// PRESET MOCK SLIDES
const MOCK_SLIDES = [
  { id: 1, title: "Slide 1: Hook & Introduction", desc: "Introduce the problem statement. Create empathy and state your overarching mission." },
  { id: 2, title: "Slide 2: Core Value Prop & Mechanics", desc: "Show how your product works. Focus on simplicity and unique advantages." },
  { id: 3, title: "Slide 3: Business Model & Market", desc: "Address pricing, distribution strategy, and overall financial sizing." },
  { id: 4, title: "Slide 4: Closing & Call to Action", desc: "Summarize major takeaways and give a strong, memorable call to action." }
];

export default function VoiceCoach() {
  // Configurations
  const [engine, setEngine] = useState(() => localStorage.getItem('pres_coach_engine') || 'sandbox');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('pres_coach_gemini_key') || '');
  const [sttProvider, setSttProvider] = useState(() => localStorage.getItem('pres_coach_stt') || 'browser');
  const [showSettings, setShowSettings] = useState(false);

  // Practice States
  const [activeSlide, setActiveSlide] = useState(MOCK_SLIDES[0]);
  const [speechIntervals, setSpeechIntervals] = useState({}); // Keep track of transcript per slide

  // Recording / Interview States
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Sẵn sàng huấn luyện thuyết trình. Bấm bắt đầu nói để chạy Slide thứ nhất.');
  
  // Waveform animation
  const [bars, setBars] = useState(Array(15).fill(10));
  const animRef = useRef(null);

  // Scoring States
  const [isLoading, setIsLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [activeTab, setActiveTab] = useState('delivery'); // delivery, slides, rewrite
  const [textInput, setTextInput] = useState('');

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  // Browser STT Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'vi-VN'; // Vietnamese primary for Presentation

      rec.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => {
            const updated = (prev + ' ' + finalTranscript).trim();
            // Assign to active slide's transcript bucket
            setSpeechIntervals(prevBuckets => ({
              ...prevBuckets,
              [activeSlide.id]: updated
            }));
            return updated;
          });
        }
      };

      rec.onerror = (e) => {
        console.error('STT Error:', e);
      };

      recognitionRef.current = rec;
    }
  }, [activeSlide]);

  // Waveform visualizer simulation
  useEffect(() => {
    if (isRecording) {
      animRef.current = setInterval(() => {
        setBars(Array(15).fill(0).map(() => Math.floor(Math.random() * 40) + 8));
      }, 100);
    } else {
      if (animRef.current) clearInterval(animRef.current);
      setBars(Array(15).fill(10));
    }
    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, [isRecording]);

  // Timer Effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Save Settings
  const saveSettings = () => {
    localStorage.setItem('pres_coach_engine', engine);
    localStorage.setItem('pres_coach_gemini_key', geminiKey);
    localStorage.setItem('pres_coach_stt', sttProvider);
    setShowSettings(false);
    setStatusMsg('Cấu hình thuyết trình đã lưu thành công.');
  };

  // GSAP Animations
  useEffect(() => {
    gsap.fromTo('.fade-in-element', 
      { opacity: 0, y: 15 }, 
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out' }
    );
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Start Presentation Recording
  const startRecording = async () => {
    setTranscript('');
    setAssessment(null);
    audioChunksRef.current = [];
    
    if (sttProvider === 'browser' && recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setRecordingTime(0);
        setStatusMsg(`Đang thuyết trình Slide: "${activeSlide.title}"...`);
      } catch (err) {
        console.error(err);
        setStatusMsg('Lỗi khởi động nhận diện giọng nói trình duyệt.');
      }
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatusMsg('Trình duyệt không hỗ trợ ghi âm.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorderRef.current.onstop = () => {
          setStatusMsg('Đã ghi nhận audio thuyết trình (Sandbox).');
        };
        mediaRecorderRef.current.start();
        setIsRecording(true);
        setRecordingTime(0);
        setStatusMsg('Đang ghi nhận slide (Sandbox)... Thuyết trình đi.');
      } catch (err) {
        setStatusMsg('Lỗi micro.');
      }
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (isRecording) {
      if (sttProvider === 'browser' && recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      setStatusMsg('Đã tạm dừng bài nói. Bấm "Chấm bài nói" để nhận phản hồi cấu trúc slide.');
    }
  };

  // Local Sandbox Grading for Presentation
  const generateSandboxReport = (text) => {
    setIsLoading(true);
    setStatusMsg('Đang tính toán nhịp điệu slide & cấu trúc thuyết trình...');
    
    setTimeout(() => {
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const fillerWords = (text.match(/\b(thì|là|mà|như là|kiểu như|kiểu|với lại|à|ừm)\b/ig) || []).length;
      const pacingWpm = recordingTime > 0 ? Math.round((wordCount / recordingTime) * 60) : 130;

      let score = 80;
      if (wordCount > 40) score += 4;
      if (wordCount > 80) score += 4;
      if (fillerWords < 4) score += 4;
      if (pacingWpm >= 120 && pacingWpm <= 150) score += 3;
      score = Math.min(96, Math.max(55, score));

      let impact = "Đạt Yêu Cầu";
      if (score >= 88) impact = "Rất Thuyết Phục";
      else if (score >= 78) impact = "Thuyết Phục";

      setAssessment({
        overall_score: score,
        estimated_impact: impact,
        brutally_honest_summary: `Bài thuyết trình có bố cục khá đồng đều. Bạn trình bày được ${wordCount} từ trong vòng ${recordingTime}s. Nhịp nói trung bình là ${pacingWpm} WPM (rất vừa vặn để người nghe tiếp thu thông tin trên slide).`,
        delivery_metrics: {
          structure: "Phần giới thiệu vấn đề tương đối ấn tượng. Tuy nhiên phần dẫn dắt sang Giải pháp (Slide 2) cần bổ sung thêm cầu nối mượt mà hơn.",
          persuasion: "Bạn sử dụng nhiều tính từ cảm xúc, tuy nhiên độ thuyết phục sẽ tăng gấp đôi nếu đưa thêm dữ liệu thống kê.",
          clarity: "Độ rõ và phát âm tiếng Việt được đánh giá cao, các ý chính có khoảng ngừng nghỉ để khán giả tập trung tốt."
        },
        slide_by_slide_feedback: MOCK_SLIDES.map((s) => {
          const slideText = speechIntervals[s.id] || "";
          const slideWords = slideText.split(/\s+/).filter(Boolean).length;
          return `Slide ${s.id} (${slideWords} từ): ${
            slideWords > 0 
              ? `Trình bày tương đối sâu sát nội dung slide. Cần làm rõ ý chính để tránh đọc nguyên văn tài liệu.` 
              : `Chưa có thông tin ghi nhận cho slide này. Nên bổ sung tối thiểu 30 giây thuyết trình.`
          }`;
        }),
        pro_presentation_tip: "Mẹo Zen Coach: Hãy tập thói quen hạ giọng ở cuối các câu khẳng định quan trọng (Slide 2 và Slide 4) để tạo ra uy lực và tăng độ tin cậy trong lời nói.",
        better_version: "Gợi ý bố cục mở bài ấn tượng:\n\"Kính thưa các anh chị, 80% các startup gặp khó khăn không phải vì thiếu ý tưởng, mà vì thiếu sự thấu hiểu khách hàng. Hôm nay, tôi xin giới thiệu giải pháp AuraSpeak giúp giải quyết triệt để bài toán kỹ năng nói...\""
      });
      setIsLoading(false);
      setStatusMsg('Đã kết xuất báo cáo thuyết trình.');
    }, 1500);
  };

  // Call Gemini directly for Presentation
  const analyzeWithGemini = async (textToAnalyze) => {
    if (!geminiKey) {
      setStatusMsg('Hãy cấu hình Gemini API Key trong cài đặt.');
      return;
    }
    
    setIsLoading(true);
    setStatusMsg('Đang đánh giá thuyết trình qua Google Gemini API...');

    // Collect slide stats
    const slideStats = MOCK_SLIDES.map(s => `Slide ${s.id} [${s.title}]: "${speechIntervals[s.id] || ''}"`).join('\n');

    const systemInstruction = `
      You are a world-class TED Talk Presentation Coach and Pitch Trainer.
      Analyze the user's presentation transcript.
      The presentation language is Vietnamese. Provide feedback in premium, clear Vietnamese.
      
      Structure your analysis to output raw JSON strictly matching this format:
      {
        "overall_score": 88,
        "estimated_impact": "Ấn Tượng",
        "brutally_honest_summary": "Tóm tắt phản hồi thuyết trình ngắn gọn bằng tiếng Việt...",
        "delivery_metrics": {
          "structure": "Đánh giá cấu trúc (Mở - Thân - Kết) bằng tiếng Việt...",
          "persuasion": "Đánh giá tính thuyết phục bằng tiếng Việt...",
          "clarity": "Đánh giá độ rõ ràng và mạch lạc bằng tiếng Việt..."
        },
        "slide_by_slide_feedback": [
          "Feedback ngắn gọn cho Slide 1...",
          "Feedback ngắn gọn cho Slide 2...",
          "Feedback ngắn gọn cho Slide 3...",
          "Feedback ngắn gọn cho Slide 4..."
        ],
        "pro_presentation_tip": "Mẹo thuyết trình chuyên nghiệp độc quyền...",
        "better_version": "Phiên bản viết lại gợi ý đoạn mở bài hoặc kết bài hoàn hảo..."
      }
    `;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemInstruction}\n\nOverall presentation transcript: "${textToAnalyze}"\n\nIndividual slide transcripts:\n${slideStats}` }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(rawText.trim());
      setAssessment(parsed);
      setStatusMsg('Đã nhận báo cáo phân tích thuyết trình.');
    } catch (err) {
      console.error(err);
      setStatusMsg(`Lỗi kết nối Gemini API. Đang tự động chuyển sang Sandbox.`);
      generateSandboxReport(textToAnalyze);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = () => {
    const textToAnalyze = transcript.trim() || textInput.trim();
    if (!textToAnalyze) {
      setStatusMsg('Vui lòng gõ nội dung hoặc ghi âm để bắt đầu.');
      return;
    }
    
    if (engine === 'gemini' && geminiKey) {
      analyzeWithGemini(textToAnalyze);
    } else {
      generateSandboxReport(textToAnalyze);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#F1F5F9] font-sans selection:bg-[#10B981] selection:text-black px-6 py-8 relative">
      
      {/* Top Navbar */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8 fade-in-element">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10B981] flex items-center justify-center text-black">
            <Presentation size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">Presentation Coach</h1>
            <p className="text-xs text-[#10B981] font-mono tracking-widest uppercase">Zen Spatial Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-10 h-10 rounded-xl border border-[#2D3139] bg-[#1A1C20] flex items-center justify-center text-white hover:bg-[#2D3139] transition-colors"
          >
            <Settings size={18} />
          </button>
          
          <div className="px-3 py-1.5 rounded-lg border border-[#2D3139] bg-[#1A1C20] text-xs text-[#10B981] font-mono flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${engine === 'sandbox' ? 'bg-amber-400' : 'bg-[#10B981]'} animate-pulse`}></span>
            {engine === 'sandbox' ? 'Sandbox Mode' : 'Gemini Connected'}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Slide Simulators & Waveform */}
        <section className="lg:col-span-5 space-y-6 fade-in-element">
          
          {/* Active Slide Screen */}
          <div className="bg-[#1A1C20] rounded-[2rem] border border-[#2D3139] p-6 shadow-md space-y-5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-[#10B981] uppercase tracking-wider">Slide Deck Simulator</span>
              <span className="text-xs text-slate-400 font-mono">Interactive Deck</span>
            </div>

            {/* Simulated Slide Canvas */}
            <div className="aspect-[16/10] bg-[#0A0B0D] rounded-2xl p-6 border border-[#2D3139] flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-2">
                <p className="text-xs font-mono text-[#10B981]">{activeSlide.title}</p>
                <h3 className="text-lg font-bold text-white leading-tight font-serif italic">"{activeSlide.desc}"</h3>
              </div>

              <div className="flex justify-between items-end border-t border-[#2D3139] pt-4 mt-4">
                <span className="text-[10px] text-slate-500 font-mono">AuraSpeak Deck Editor</span>
                <span className="text-[10px] text-slate-500 font-mono">Slide {activeSlide.id} / 4</span>
              </div>
            </div>

            {/* Slide Navigation Dots */}
            <div className="flex justify-center gap-2.5">
              {MOCK_SLIDES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSlide(s);
                    // Extract existing transcript for that slide
                    setTranscript(speechIntervals[s.id] || "");
                  }}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    activeSlide.id === s.id ? 'bg-[#10B981] scale-125' : 'bg-[#2D3139] hover:bg-[#10B981]/50'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Precision Soundwave & Recording Telemetry */}
          <div className="bg-[#1A1C20] rounded-[2rem] border border-[#2D3139] p-6 shadow-md space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-mono text-[#10B981] uppercase tracking-wider">Live Soundwave & Pacing</h4>
              {isRecording && (
                <span className="text-[10px] text-red-500 font-mono flex items-center gap-1.5 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/50">
                  <Activity size={10} className="animate-pulse" /> RECORDING
                </span>
              )}
            </div>

            {/* Soundwave Bars */}
            <div className="h-16 bg-[#0A0B0D] rounded-xl border border-[#2D3139] flex items-center justify-center gap-1 px-4">
              {bars.map((barHeight, idx) => (
                <div 
                  key={idx}
                  style={{ height: `${barHeight}px` }}
                  className={`w-1.5 rounded-full transition-all duration-100 ${
                    isRecording ? 'bg-[#10B981]' : 'bg-[#2D3139]'
                  }`}
                />
              ))}
            </div>

            <div className="flex justify-between text-xs text-slate-400 font-mono bg-[#0A0B0D] p-3 rounded-lg border border-[#2D3139]/60">
              <span>Thời gian: {formatTime(recordingTime)}</span>
              <span>Slide WPM: {recordingTime > 0 ? Math.round((transcript.split(/\s+/).filter(Boolean).length / recordingTime) * 60) : 0} WPM</span>
            </div>
          </div>

        </section>

        {/* Right Column: Responses and Assessments */}
        <section className="lg:col-span-7 space-y-6 fade-in-element">
          
          {/* Main Controller Area */}
          <div className="bg-[#1A1C20] rounded-[2rem] border border-[#2D3139] p-6 shadow-md space-y-4">
            <h2 className="text-sm font-mono text-[#10B981] uppercase tracking-wider">
              Thuyết trình nội dung slide hiện tại
            </h2>

            {sttProvider === 'browser' ? (
              <div className="min-h-36 bg-[#0A0B0D] rounded-2xl border border-[#2D3139] p-4 text-sm text-[#F1F5F9] relative overflow-y-auto max-h-48">
                {transcript ? (
                  <p className="leading-relaxed">{transcript}</p>
                ) : (
                  <span className="text-slate-500 italic">Bấm "Nói trực tiếp" và thuyết trình theo đề bài slide bên trái...</span>
                )}
              </div>
            ) : (
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Nhập nội dung thuyết trình slide của bạn tại đây bằng tiếng Việt..."
                className="w-full min-h-36 bg-[#0A0B0D] border border-[#2D3139] rounded-2xl p-4 text-sm focus:outline-none focus:border-[#10B981] text-[#F1F5F9]"
              />
            )}

            <div className="flex items-center gap-3">
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="flex-1 h-14 rounded-2xl bg-red-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
                >
                  <Square size={16} /> Tạm dừng nói
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="flex-1 h-14 rounded-2xl bg-[#10B981] text-black font-bold flex items-center justify-center gap-2 hover:bg-[#34D399] transition-colors"
                >
                  <Mic size={18} /> Nói trực tiếp
                </button>
              )}

              <button
                onClick={handleAnalyze}
                disabled={isLoading || isRecording}
                className="px-6 h-14 rounded-2xl bg-[#FAF5E6] text-black font-semibold flex items-center justify-center gap-2 hover:bg-white transition-colors disabled:opacity-40"
              >
                {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Chấm bài nói
              </button>
            </div>

            <p className="text-xs text-slate-400 font-mono leading-relaxed bg-[#0A0B0D] p-3 rounded-xl border border-[#2D3139]/60">
              {statusMsg}
            </p>
          </div>

          {/* Score Assessment Dashboards */}
          {isLoading ? (
            <div className="bg-[#1A1C20] rounded-[2rem] border border-[#2D3139] p-12 text-center shadow-md space-y-4">
              <RefreshCw className="animate-spin text-[#10B981] mx-auto" size={40} />
              <h3 className="font-bold text-lg text-white">Đang tổng hợp báo cáo thuyết trình...</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">AI đang phân tích bố cục thuyết trình slide-by-slide và tính toán độ thuyết phục.</p>
            </div>
          ) : assessment ? (
            <div className="bg-[#1A1C20] rounded-[2rem] border border-[#2D3139] p-6 shadow-md space-y-6">
              
              {/* Header metrics */}
              <div className="flex flex-wrap justify-between items-center gap-4 bg-[#10B981]/5 p-5 rounded-2xl border border-[#10B981]/15">
                <div className="space-y-1">
                  <h3 className="text-sm font-mono text-[#10B981] uppercase tracking-wider">Độ thuyết phục tổng thể</h3>
                  <p className="text-2xl font-extrabold text-white">{assessment.estimated_impact}</p>
                </div>
                
                <div className="text-center bg-[#0A0B0D] px-5 py-3 rounded-xl border border-[#2D3139] min-w-28">
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Overall Impact</p>
                  <p className="text-3xl font-black text-[#10B981]">{assessment.overall_score} <span className="text-xs text-slate-400 font-normal">/100</span></p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[#2D3139]">
                <button
                  onClick={() => setActiveTab('delivery')}
                  className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
                    activeTab === 'delivery' ? 'border-[#10B981] text-[#10B981]' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Nhịp diễn đạt
                </button>
                <button
                  onClick={() => setActiveTab('slides')}
                  className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
                    activeTab === 'slides' ? 'border-[#10B981] text-[#10B981]' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Báo cáo Slide-by-slide
                </button>
                <button
                  onClick={() => setActiveTab('rewrite')}
                  className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
                    activeTab === 'rewrite' ? 'border-[#10B981] text-[#10B981]' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Mở bài / Gợi ý mẫu
                </button>
              </div>

              {/* Tab views */}
              <div className="space-y-4 min-h-64">
                
                {activeTab === 'delivery' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[#0A0B0D] border border-[#2D3139] space-y-2">
                      <p className="text-xs font-mono text-[#10B981] uppercase tracking-wider flex items-center gap-1.5">
                        <Award size={14} /> Nhận xét tổng quan của Zen Coach:
                      </p>
                      <p className="text-sm font-serif leading-relaxed text-slate-300 italic">
                        "{assessment.brutally_honest_summary}"
                      </p>
                    </div>

                    <div className="space-y-3">
                      {Object.entries(assessment.delivery_metrics).map(([metric, text]) => (
                        <div key={metric} className="p-4 rounded-xl border border-[#2D3139] space-y-1">
                          <span className="text-[10px] font-mono text-[#10B981] uppercase tracking-wider">
                            {metric.toUpperCase()}
                          </span>
                          <p className="text-xs leading-relaxed text-slate-300">
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'slides' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono text-[#10B981] uppercase tracking-wider mb-2">Đánh giá theo từng trang Slide:</h4>
                    {assessment.slide_by_slide_feedback.map((f, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-[#2D3139] bg-[#0A0B0D]/50 text-xs leading-relaxed text-slate-300 flex items-start gap-2">
                        <span className="text-[#10B981] font-bold">•</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'rewrite' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-[#2D3139] bg-[#0A0B0D] space-y-2">
                      <p className="text-xs font-mono text-[#10B981] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={14} /> Đoạn mở bài đề xuất (TED Talk Style):
                      </p>
                      <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line font-serif italic bg-[#1A1C20] p-4 rounded-lg border border-[#2D3139]/80">
                        {assessment.better_version}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#10B981]/5 border border-[#10B981]/15 text-xs text-[#10B981] leading-relaxed">
                      💡 <strong>Mẹo độc quyền:</strong> {assessment.pro_presentation_tip}
                    </div>
                  </div>
                )}

              </div>

            </div>
          ) : (
            <div className="bg-[#1A1C20] rounded-[2rem] border border-[#2D3139] p-12 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#0A0B0D] border border-[#2D3139] flex items-center justify-center mx-auto text-[#10B981]">
                <Layout size={24} />
              </div>
              <h3 className="font-bold text-lg text-white">Chưa có bài nói thuyết trình</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">Chọn slide trên bảng slide deck, ghi âm hoặc gõ văn bản rồi bấm "Chấm bài nói" để bắt đầu nhận phân tích.</p>
            </div>
          )}

        </section>

      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1C20] rounded-[2rem] border border-[#2D3139] p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-lg flex items-center gap-2 text-white">
                <Settings size={20} className="text-[#10B981]" /> Cấu hình Thuyết trình
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white font-semibold"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#10B981] uppercase tracking-wider mb-2">Phương thức chấm</label>
                <select
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  className="w-full bg-[#0A0B0D] border border-[#2D3139] rounded-xl p-3 text-sm focus:outline-none focus:border-[#10B981] text-white"
                >
                  <option value="sandbox">Sandbox (Mô phỏng tại chỗ - Hoàn toàn miễn phí)</option>
                  <option value="gemini">Google Gemini API (Direct Client)</option>
                </select>
              </div>

              {engine === 'gemini' && (
                <div>
                  <label className="block text-xs font-mono text-[#10B981] uppercase tracking-wider mb-2">Google Gemini API Key</label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#0A0B0D] border border-[#2D3139] rounded-xl p-3 text-sm focus:outline-none focus:border-[#10B981] text-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                    🔑 API Key được lưu bảo mật trong LocalStorage của riêng trình duyệt bạn đang chạy.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-[#10B981] uppercase tracking-wider mb-2">Công cụ chuyển đổi giọng nói</label>
                <select
                  value={sttProvider}
                  onChange={(e) => setSttProvider(e.target.value)}
                  className="w-full bg-[#0A0B0D] border border-[#2D3139] rounded-xl p-3 text-sm focus:outline-none focus:border-[#10B981] text-white"
                >
                  <option value="browser">Browser Web Speech API (NATIVE - Khuyên dùng)</option>
                  <option value="mechanical">Mô phỏng (Sandbox Audio Simulator)</option>
                </select>
              </div>
            </div>

            <button
              onClick={saveSettings}
              className="w-full h-12 rounded-xl bg-[#10B981] text-black font-bold text-sm hover:bg-[#34D399] transition-colors"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
