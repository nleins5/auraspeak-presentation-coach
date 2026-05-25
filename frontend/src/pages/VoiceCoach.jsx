import { useState, useEffect, useRef } from 'react';
import { 
  Presentation, Mic, Square, Settings, Layout, 
  Sparkles,
  ChevronRight, ChevronLeft, RefreshCw, Volume2, Activity, Play, Award, 
  Edit3, Trash2, Plus, Sparkle, Check, Pause, Loader2, Upload
} from 'lucide-react';
import gsap from 'gsap';

class WavRecorder {
  constructor(stream) {
    this.stream = stream;
    this.audioContext = null;
    this.scriptProcessor = null;
    this.mediaStreamSource = null;
    this.audioBuffers = [];
    this.recordingSampleRate = 16000;
  }

  start() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const originalSampleRate = this.audioContext.sampleRate;
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
    
    // Create script processor (4096 buffer size, 1 input channel, 1 output channel)
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.audioBuffers = [];

    this.scriptProcessor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer.getChannelData(0); // Mono channel
      const downsampledBuffer = this.downsample(inputBuffer, originalSampleRate, this.recordingSampleRate);
      this.audioBuffers.push(downsampledBuffer);
    };

    this.mediaStreamSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  stop() {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.mediaStreamSource.disconnect();
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    // Flatten buffers
    const totalLength = this.audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const resultBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of this.audioBuffers) {
      resultBuffer.set(buf, offset);
      offset += buf.length;
    }

    // Encode to WAV
    return this.encodeWAV(resultBuffer, this.recordingSampleRate);
  }

  downsample(buffer, fromRate, toRate) {
    if (fromRate === toRate) {
      return new Float32Array(buffer);
    }
    const sampleRateRatio = fromRate / toRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

// PRESET DEFAULT SLIDES
const DEFAULT_SLIDES = [
  { id: 1, title: "Slide 1: Lời Mở Đầu & Dẫn Dắt", desc: "Giới thiệu vấn đề thực tế. Tạo sự đồng cảm và tuyên bố sứ mệnh cốt lõi của bạn." },
  { id: 2, title: "Slide 2: Giá Trị Cốt Lõi & Giải Pháp", desc: "Trình bày cách thức sản phẩm/dịch vụ vận hành. Tập trung vào sự đơn giản và lợi thế độc nhất." },
  { id: 3, title: "Slide 3: Mô Hình Kinh Doanh & Thị Trường", desc: "Giải quyết bài toán doanh thu, định giá, chiến lược phân phối và quy mô thị trường." },
  { id: 4, title: "Slide 4: Đúc Kết & Kêu Gọi Hành Động", desc: "Tóm tắt các thông điệp chính và đưa ra lời kêu gọi hành động mạnh mẽ, đáng nhớ." }
];

export default function VoiceCoach() {
  const apiBase = import.meta.env.VITE_API_BASE || '';
  const [geminiKey, setGeminiKey] = useState(() => {
    const saved = localStorage.getItem('pres_coach_gemini_key');
    if (saved && saved.trim() !== '') return saved;
    return import.meta.env.VITE_GEMINI_API_KEY || '';
  });
  const [sttProvider, setSttProvider] = useState(() => {
    const saved = localStorage.getItem('pres_coach_stt');
    return saved && saved !== 'browser' ? saved : 'cloud';
  });
  const [activeView, setActiveView] = useState('practice'); // practice, report, settings
  const [showSlideDrawer, setShowSlideDrawer] = useState(false);

  // Editable Slide Deck State
  const [slides, setSlides] = useState(() => {
    const saved = localStorage.getItem('pres_coach_slides');
    return saved ? JSON.parse(saved) : DEFAULT_SLIDES;
  });
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = slides[activeSlideIndex] || slides[0] || DEFAULT_SLIDES[0];

  // Temp slide editing state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Speech Interval / Slide Transcript State
  const [speechIntervals, setSpeechIntervals] = useState({}); // slideId -> transcript text
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Sẵn sàng huấn luyện thuyết trình. Nhấn micro để bắt đầu thuyết trình Slide 1.');
  
  // Waveform animation
  const [bars, setBars] = useState(Array(18).fill(10));
  const animRef = useRef(null);

  // Scoring / Assessment States
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [activeTab, setActiveTab] = useState('delivery'); // delivery, slides, suggestions
  const [textInput, setTextInput] = useState('');
  const [isSTTSupported, setIsSTTSupported] = useState(true);

  // Refs for Speech API & Timers
  const mediaRecorderRef = useRef(null);
  const wavRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const audioUploadRef = useRef(null);
  const cardContainerRef = useRef(null);
  const recordingStartedAtRef = useRef(0);

  // Track state in refs to prevent stale closure bugs in browser speech events
  const isRecordingRef = useRef(false);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const activeSlideIdRef = useRef(activeSlide.id);
  useEffect(() => {
    activeSlideIdRef.current = activeSlide.id;
  }, [activeSlide.id]);

  // Save slides helper
  const saveSlides = (newSlides) => {
    setSlides(newSlides);
    localStorage.setItem('pres_coach_slides', JSON.stringify(newSlides));
  };

  // Setup Browser STT (Web Speech API)
  useEffect(() => {
    const hasSTT = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSTTSupported(hasSTT);

    if (!hasSTT) {
      setSttProvider(prev => prev === 'browser' ? 'cloud' : prev);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'vi-VN'; // Vietnamese voice-coaching capability

    rec.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setTranscript(prev => {
          const updated = (prev + ' ' + finalTranscript).trim();
          // Assign to active slide's transcript bucket
          setSpeechIntervals(prevBuckets => ({
            ...prevBuckets,
            [activeSlideIdRef.current]: updated
          }));
          return updated;
        });
      }
    };

    rec.onerror = (e) => {
      console.error('STT Error:', e);
      if (e.error === 'not-allowed') {
        setStatusMsg('Lỗi: Trình duyệt bị từ chối quyền truy cập Micro. Hãy cấp quyền truy cập thiết bị thu âm trong cài đặt trình duyệt để tiếp tục.');
      } else if (e.error === 'network') {
        setStatusMsg('Lỗi kết nối mạng: Engine Speech Recognition không thể liên lạc với máy chủ Google Speech.');
      } else if (e.error === 'no-speech') {
        console.warn('Không nghe thấy giọng nói từ micro.');
      } else {
        setStatusMsg(`Lỗi nhận diện giọng nói: ${e.error}`);
      }
    };

    rec.onend = () => {
      // Auto-restart if we are still supposed to be recording
      if (isRecordingRef.current) {
        try {
          rec.start();
          console.log('SpeechRecognition auto-restarted.');
        } catch (err) {
          console.error('SpeechRecognition auto-restart failed:', err);
        }
      }
    };

    recognitionRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {
        // Ignore cleanup errors when recognition was never started.
      }
    };
  }, []);

  // Sync edit fields when active slide changes
  useEffect(() => {
    if (activeSlide) {
      setEditTitle(activeSlide.title);
      setEditDesc(activeSlide.desc);
      setTranscript(speechIntervals[activeSlide.id] || '');
    }
  }, [activeSlide, activeSlideIndex, slides, speechIntervals]);

  // Waveform glowing plasma visualizer simulator
  useEffect(() => {
    if (isRecording) {
      animRef.current = setInterval(() => {
        setBars(Array(18).fill(0).map(() => Math.floor(Math.random() * 32) + 6));
      }, 90);
    } else {
      if (animRef.current) clearInterval(animRef.current);
      setBars(Array(18).fill(10));
    }
    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, [isRecording]);

  // Recording Timer effect
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

  // GSAP animation for mobile slide transitions
  useEffect(() => {
    gsap.fromTo('.slide-active-card', 
      { scale: 0.95, opacity: 0.8, y: 10 }, 
      { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.4)' }
    );
  }, [activeSlideIndex]);

  // Save general engine settings
  const handleSaveSettings = () => {
    const nextSttProvider = sttProvider === 'browser' ? 'cloud' : sttProvider;
    setSttProvider(nextSttProvider);
    localStorage.setItem('pres_coach_gemini_key', geminiKey);
    localStorage.setItem('pres_coach_stt', nextSttProvider);
    setStatusMsg('Cấu hình thuyết trình đã lưu thành công.');
    setActiveView('practice');
  };

  // Start Voice Capturing
  const startRecording = async () => {
    isRecordingRef.current = true;
    setTranscript('');
    setAssessment(null);
    audioChunksRef.current = [];
    
    if (sttProvider === 'browser' && recognitionRef.current) {
      try {
        // CALL SYNCHRONOUSLY FIRST to guarantee Safari/iOS user interaction gesture is preserved
        recognitionRef.current.start();
        setIsRecording(true);
        setRecordingTime(0);
        setStatusMsg(`Đang lắng nghe trực tiếp cho Slide ${activeSlideIndex + 1}... Hãy nói thuyết trình.`);
      } catch (err) {
        console.error('Web Speech API Start Error:', err);
        setStatusMsg('Lỗi kích hoạt micro nhận diện giọng nói Web Speech. Hãy cấp quyền Micro trong trình duyệt.');
      }
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatusMsg('Trình duyệt không hỗ trợ micro.');
        return;
      }
      const startTime = Date.now();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordingStartedAtRef.current = startTime;

        if (sttProvider === 'cloud') {
          // Use browser-native high-compatibility mono WAV recorder
          wavRecorderRef.current = new WavRecorder(stream);
          wavRecorderRef.current.start();
        } else {
          if (typeof MediaRecorder === 'undefined') {
            setStatusMsg('Trình duyệt không hỗ trợ ghi âm. Hãy mở bằng Chrome hoặc Safari bản mới.');
            return;
          }
          const { recorder } = createAudioRecorder(stream);
          mediaRecorderRef.current = recorder;
          mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };
          mediaRecorderRef.current.onstop = async () => {
            if (!audioChunksRef.current.length) {
              stopRecorderTracks();
              setStatusMsg('Không thu được dữ liệu âm thanh. Hãy thử lại và kiểm tra quyền Micro.');
              return;
            }
            setStatusMsg('Đã ghi âm xong. Chờ phân tích...');
            stopRecorderTracks();
          };
          mediaRecorderRef.current.start(1000);
        }

        setIsRecording(true);
        setRecordingTime(0);
        if (sttProvider === 'cloud') {
          setStatusMsg(`Đang ghi âm qua đám mây cho Slide ${activeSlideIndex + 1}... Hãy nói thuyết trình.`);
        } else {
          setStatusMsg('Đang ghi âm (Mô phỏng Sandbox)... Hãy nói thuyết trình, sau đó nhập văn bản.');
        }
      } catch (err) {
        console.error('Recording start error:', err);
        setStatusMsg('Lỗi bắt đầu ghi âm cơ học. Hãy cấp quyền truy cập Micro.');
      }
    }
  };

  // Stop Recording
  const stopRecording = async () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    
    if (sttProvider === 'browser' && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors when recognition is already inactive.
      }
      setStatusMsg('Đã ghi nhận bài thuyết trình. Nhấn "Chấm bài thuyết trình" để phân tích.');
    } else if (sttProvider === 'cloud' && wavRecorderRef.current) {
      try {
        setStatusMsg('Ghi âm hoàn tất. Đang chuyển đổi định dạng WAV...');
        const audioBlob = wavRecorderRef.current.stop();
        await uploadAudioForTranscription(audioBlob, 'wav');
      } catch (err) {
        console.error('Failed to stop WavRecorder:', err);
        setStatusMsg(`Lỗi mã hóa âm thanh WAV: ${err.message}`);
        stopRecorderTracks();
      }
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.requestData?.();
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop errors when recorder tracks were already released.
      }
      setStatusMsg('Đã ghi nhận bài thuyết trình. Nhấn "Chấm bài thuyết trình" để phân tích.');
    } else {
      setStatusMsg('Đã ghi nhận bài thuyết trình. Nhấn "Chấm bài thuyết trình" để phân tích.');
    }
  };

  const handleAudioUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setTranscript('');
    setTextInput('');
    setAssessment(null);
    setIsUploadingAudio(true);
    setStatusMsg(`Đang tải file voice "${file.name}" lên cho Slide ${activeSlideIndex + 1}...`);

    try {
      const formData = new FormData();
      formData.append('file', file, file.name || 'uploaded-audio');
      formData.append('language', 'vi');
      formData.append('client_duration', '0');

      const response = await fetch(`${apiBase}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Lỗi nhận dạng: HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        setStatusMsg(`Upload voice thất bại: ${data.error}`);
        return;
      }

      if (data.text) {
        const transcriptText = data.text.trim();
        setTranscript(transcriptText);
        setSpeechIntervals(prevBuckets => ({
          ...prevBuckets,
          [activeSlideIdRef.current]: transcriptText
        }));
        setStatusMsg('Upload voice và nhận dạng thành công!');
      } else {
        setStatusMsg('Không nhận diện được nội dung trong file voice.');
      }
    } catch (err) {
      console.error('Audio upload STT error:', err);
      setStatusMsg(`Upload voice thất bại: ${err.message || err}`);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const parseAIJsonResponse = (rawText) => {
    const text = String(rawText || '').trim();
    try {
      return JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = jsonMatch?.[1] || text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      return JSON.parse(candidate);
    }
  };

  const toList = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value.filter(Boolean) : [String(value)];
  };

  const categorySummary = (category) => {
    if (!category) return 'AI chưa trả đủ dữ liệu cho mục này.';
    return [
      ...toList(category.feedback),
      ...toList(category.strengths).map(item => `Điểm mạnh: ${item}`),
      ...toList(category.weaknesses).map(item => `Cần cải thiện: ${item}`),
    ].join(' ') || 'AI chưa trả đủ dữ liệu cho mục này.';
  };

  const normalizePresentationAssessment = (raw) => {
    const categories = raw.categories && typeof raw.categories === 'object' ? raw.categories : {};
    const rawScore = Number(raw.overall_score ?? raw.score ?? 0);
    const displayScore = Number.isFinite(rawScore) && rawScore <= 10 ? Math.round(rawScore * 10) : (raw.overall_score ?? 'N/A');
    const deliveryMetrics = raw.delivery_metrics && typeof raw.delivery_metrics === 'object'
      ? raw.delivery_metrics
      : Object.fromEntries(
        Object.entries(categories).map(([key, item]) => [key.replace(/_/g, ' '), categorySummary(item)])
      );
    const categoryFeedback = Object.entries(categories).flatMap(([key, item]) => [
      `${key.replace(/_/g, ' ')}: ${categorySummary(item)}`
    ]);
    const slideFeedback = toList(raw.slide_by_slide_feedback).length
      ? toList(raw.slide_by_slide_feedback)
      : [...toList(raw.top_5_improvements), ...categoryFeedback].slice(0, 6);

    return {
      ...raw,
      overall_score: displayScore,
      estimated_impact: raw.estimated_impact || (rawScore >= 8 ? 'High Impact' : rawScore >= 6 ? 'Good Potential' : 'Needs Sharpening'),
      brutally_honest_summary: raw.brutally_honest_summary || raw.summary || 'AI đã chấm xong nhưng chưa trả nhận xét tổng quan.',
      delivery_metrics: Object.keys(deliveryMetrics).length ? deliveryMetrics : { clarity: 'Cần nói rõ ý chính, nhịp nói và điểm nhấn.' },
      slide_by_slide_feedback: slideFeedback.length ? slideFeedback : ['Cần thêm nội dung cụ thể cho từng slide để AI phân tích sâu hơn.'],
      better_version: raw.better_version || raw.ideal_rewritten_answer || raw.natural_rewritten_answer || 'AI chưa trả bản nói mẫu cho bài thuyết trình này.',
      pro_presentation_tip: raw.pro_presentation_tip || toList(raw.top_5_improvements)[0] || 'Mở đầu bằng vấn đề cụ thể, sau đó chốt mỗi slide bằng một thông điệp chính.',
    };
  };

  // Call AI Coaching API via Unified Router AI Endpoint for Presentation
  const analyzeWithGemini = async (textToAnalyze) => {
    setIsLoading(true);
    setStatusMsg('Đang gửi dữ liệu phân tích tới AI Coach...');

    const slideStats = slides.map(s => `Slide ${s.id} [${s.title}]: "${speechIntervals[s.id] || ''}"`).join('\n');

    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (geminiKey.trim()) {
        headers['Authorization'] = `Bearer ${geminiKey}`;
      }

      const response = await fetch(
        `${apiBase}/v1/chat/presentation`,
        {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            query: `Văn bản bài thuyết trình của người dùng: "${textToAnalyze}"\n\nNội dung chi tiết từng slide:\n${slideStats}`,
            task: 'presentation'
          })
        }
      );

      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

      const data = await response.json();
      const rawText = data.answer;
      const parsed = normalizePresentationAssessment(parseAIJsonResponse(rawText));
      setAssessment(parsed);
      setStatusMsg('Đã kết xuất báo cáo phân tích từ AI Coach.');
      setActiveView('report');
    } catch (err) {
      console.error(err);
      setStatusMsg(`Phân tích thất bại: ${err.message || err}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = () => {
    // Combine all transcripts from all slides if possible
    const combinedTranscript = Object.values(speechIntervals).join(' ').trim() || transcript.trim() || textInput.trim();
    if (!combinedTranscript) {
      setStatusMsg('Hãy thuyết trình tối thiểu 1 slide hoặc gõ văn bản để chấm.');
      return;
    }

    setActiveTab('delivery');
    setActiveView('report');
    analyzeWithGemini(combinedTranscript);
  };

  // Slide Deck navigation helpers
  const handlePrevSlide = () => {
    if (activeSlideIndex > 0) {
      setActiveSlideIndex(prev => prev - 1);
    }
  };

  const handleNextSlide = () => {
    if (activeSlideIndex < slides.length - 1) {
      setActiveSlideIndex(prev => prev + 1);
    }
  };

  // Modify active slide structure
  const updateActiveSlide = () => {
    const updated = [...slides];
    updated[activeSlideIndex] = {
      ...updated[activeSlideIndex],
      title: editTitle,
      desc: editDesc
    };
    saveSlides(updated);
    setStatusMsg(`Đã cập nhật nội dung Slide ${activeSlideIndex + 1}.`);
  };

  // Add new slide
  const handleAddNewSlide = () => {
    const newId = slides.length > 0 ? Math.max(...slides.map(s => s.id)) + 1 : 1;
    const newSlide = {
      id: newId,
      title: `Slide ${newId}: Tiêu đề mới`,
      desc: "Mô tả mục tiêu thuyết trình của slide mới này..."
    };
    const updated = [...slides, newSlide];
    saveSlides(updated);
    setActiveSlideIndex(updated.length - 1);
    setStatusMsg('Đã chèn thêm Slide mới vào cuối hàng đợi.');
  };

  // Delete active slide
  const handleDeleteActiveSlide = () => {
    if (slides.length <= 1) {
      setStatusMsg('Không thể xóa toàn bộ slide. Phải giữ lại ít nhất 1 slide.');
      return;
    }
    const updated = slides.filter((_, idx) => idx !== activeSlideIndex);
    saveSlides(updated);
    setActiveSlideIndex(Math.max(0, activeSlideIndex - 1));
    setStatusMsg('Đã gỡ bỏ slide hiện tại.');
  };

  // Reset all transcripts
  const handleResetTranscripts = () => {
    setSpeechIntervals({});
    setTranscript('');
    setRecordingTime(0);
    setAssessment(null);
    setStatusMsg('Đã làm sạch toàn bộ bản ghi âm & báo cáo cũ.');
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getSupportedAudioMimeType = () => {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    return [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ].find(type => MediaRecorder.isTypeSupported(type)) || '';
  };


  const stopRecorderTracks = () => {
    const stream = mediaRecorderRef.current?.stream || wavRecorderRef.current?.stream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const uploadAudioForTranscription = async (audioBlob, extension) => {
    setStatusMsg('Đang tải lên dữ liệu ghi âm và nhận dạng tiếng Việt (Whisper)...');
    setIsLoading(true);
    try {
      const duration = ((Date.now() - recordingStartedAtRef.current) / 1000).toFixed(1);
      const formData = new FormData();
      formData.append('file', audioBlob, `speech.${extension}`);
      formData.append('language', 'vi');
      formData.append('client_duration', duration);
      
      const response = await fetch(`${apiBase}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Lỗi nhận dạng: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        setStatusMsg(`Nhận dạng thất bại: ${data.error}`);
        return;
      }
      
      if (data.text) {
        const transcriptText = data.text.trim();
        setTranscript(transcriptText);
        setSpeechIntervals(prevBuckets => ({
          ...prevBuckets,
          [activeSlideIdRef.current]: transcriptText
        }));
        setStatusMsg('Nhận dạng giọng nói đám mây thành công!');
      } else {
        setStatusMsg('Không nhận diện được giọng nói. Vui lòng nói to rõ hơn.');
      }
    } catch (err) {
      console.error('Cloud STT Error:', err);
      setStatusMsg(`Lỗi Cloud STT: ${err.message || err}`);
    } finally {
      setIsLoading(false);
      stopRecorderTracks();
    }
  };

  const createAudioRecorder = (stream) => {
    const mimeType = getSupportedAudioMimeType();
    if (mimeType) {
      try {
        return { recorder: new MediaRecorder(stream, { mimeType }), mimeType };
      } catch (err) {
        console.warn('Preferred MediaRecorder MIME failed, falling back:', err);
      }
    }
    return { recorder: new MediaRecorder(stream), mimeType: '' };
  };

  return (
    <div className="min-h-screen w-full bg-[#06060B] flex items-center justify-center font-sans p-0 sm:p-8 relative selection:bg-[#7B61FF] selection:text-white overflow-hidden text-[#F0EFF4]">
      {/* Global CSS noise overlay using inline SVG filter */}
      <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.05]" style={{ filter: 'url(#noiseFilter)' }}></div>
      <svg className="hidden">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
        </filter>
      </svg>

      {/* Cyberpunk Neon Glow Blobs for luxury spatial background */}
      <div className="absolute top-[-10%] left-[-15%] w-[55%] h-[55%] rounded-full bg-[#7B61FF]/10 blur-[130px] pointer-events-none hidden md:block"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00F0FF]/5 blur-[120px] pointer-events-none hidden md:block"></div>

      {/* Smartphone Chassis Viewport Mockup Container */}
      <div className="w-full h-screen sm:h-[844px] sm:w-[390px] sm:rounded-[3.2rem] sm:border-[10px] sm:border-neutral-900 sm:ring-4 sm:ring-[#18181B] bg-[#0A0A14] sm:shadow-[0_25px_60px_-10px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden">
        
        {/* iOS Status Bar and Notch Components */}
        <div className="h-11 px-6 pt-3 flex justify-between items-center bg-[#0A0A14]/90 backdrop-blur-md z-30 select-none text-[11px] font-fira text-[#F0EFF4]/70 shrink-0">
          <span>9:41</span>
          <div className="w-32 h-5 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-2.5 hidden sm:block"></div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-[#F0EFF4]/80" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L18.39 4.97C16.85 3.74 14.9 3 12 3zm6.03 3.39L4.97 18.03C6.51 19.26 8.46 20 12 20c4.97 0 9-4.03 9-9 0-2.12-.74-4.07-1.97-5.61z" />
            </svg>
            <span className="text-[9px] font-bold text-[#F0EFF4]/60">5G</span>
            <div className="w-5 h-2.5 border border-[#F0EFF4]/30 rounded-xs p-0.5 flex items-center">
              <div className="h-full w-3.5 bg-[#7B61FF] rounded-[1px]"></div>
            </div>
          </div>
        </div>

        {/* Spatial Floating Pill Header */}
        <header className="flex justify-between items-center px-5 py-3 border-b border-white/5 bg-[#12121E]/60 backdrop-blur-md z-20 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7B61FF] to-[#00F0FF] flex items-center justify-center text-white shadow-[0_0_12px_rgba(123,97,255,0.4)]">
              <Presentation size={15} />
            </div>
            <div>
              <h1 className="text-xs font-black tracking-tight text-white font-sora">VaporPitch</h1>
              <p className="text-[8px] text-[#7B61FF] font-fira tracking-widest uppercase font-bold">Pitch Coach</p>
            </div>
          </div>

          <div className="px-2 py-0.5 rounded border border-[#7B61FF]/30 bg-[#7B61FF]/10 text-[8px] text-[#00F0FF] font-fira font-bold shadow-[0_0_8px_rgba(0,240,255,0.15)]">
            GEMINI AI
          </div>
        </header>

        {/* Core Mobile Panels Wrapper */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* 1. PRACTICE PANELS VIEWPORT */}
          {activeView === 'practice' && (
            <div className="absolute inset-0 px-5 py-4 flex flex-col gap-4 overflow-y-auto pb-24">
              
              {/* Flickable Deck Presentation Cards */}
              <div className="relative shrink-0 select-none">
                <div 
                  ref={cardContainerRef}
                  className="slide-active-card bg-gradient-to-b from-[#18182A] to-[#11111E] text-[#F0EFF4] p-5 rounded-[2.2rem] shadow-[0_12px_24px_rgba(0,0,0,0.4)] border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[240px] md:min-h-[260px]"
                >
                  {/* Glowing futuristic tech overlays */}
                  <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-[#7B61FF]/5 blur-2xl pointer-events-none"></div>
                  
                  <div className="flex justify-between items-start mb-2 z-10">
                    <span className="text-[9px] font-fira text-[#00F0FF] uppercase tracking-widest bg-[#00F0FF]/10 px-2 py-0.5 rounded border border-[#00F0FF]/25 font-bold">
                      Slide {activeSlideIndex + 1} / {slides.length}
                    </span>
                    <span className="text-[9px] font-fira text-white/50">THUYẾT TRÌNH VAPOR</span>
                  </div>

                  <div className="space-y-2 z-10 flex-1 flex flex-col min-h-0 py-1">
                    <h3 className="text-xs font-black tracking-tight text-[#00F0FF] font-sora shrink-0">{activeSlide.title}</h3>
                    <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar text-left scroll-smooth min-h-[90px] max-h-[145px]">
                      <p className="text-xs leading-relaxed font-instrument italic text-[#F0EFF4]/90 text-justify select-text">
                        "{activeSlide.desc}"
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-white/5 pt-3.5 mt-3 z-10">
                    <div className="flex gap-1.5">
                      <button 
                        onClick={handlePrevSlide}
                        disabled={activeSlideIndex === 0}
                        className="w-7 h-7 rounded-lg bg-[#242436] hover:bg-[#32324F] flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button 
                        onClick={handleNextSlide}
                        disabled={activeSlideIndex === slides.length - 1}
                        className="w-7 h-7 rounded-lg bg-[#242436] hover:bg-[#32324F] flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <button 
                      onClick={() => setShowSlideDrawer(true)}
                      className="px-3 py-1 rounded-lg bg-[#7B61FF]/20 hover:bg-[#7B61FF]/30 border border-[#7B61FF]/30 text-[9px] font-bold text-white flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Edit3 size={10} /> Chỉnh sửa Slide
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Soundwave & Real-time pacing tracker */}
              <div className="bg-[#11111E] rounded-[2.2rem] border border-white/5 p-4 flex flex-col gap-3 shrink-0">
                <div className="flex justify-between items-center select-none">
                  <span className="text-[9px] font-fira text-[#7B61FF] uppercase tracking-wider font-bold">Sóng Âm Vapor</span>
                  {isRecording && (
                    <span className="text-[8px] font-fira text-red-400 bg-red-950/40 border border-red-900/60 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse font-bold">
                      <Activity size={10} /> ĐANG GHI ÂM
                    </span>
                  )}
                </div>

                {/* Plasma sound wave container */}
                <div className="h-10 bg-[#0A0A14] rounded-2xl border border-white/5 flex items-center justify-center gap-1 px-4">
                  {bars.map((bh, idx) => (
                    <div 
                      key={idx}
                      style={{ height: `${bh}px` }}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        isRecording ? 'bg-gradient-to-t from-[#7B61FF] to-[#00F0FF] shadow-[0_0_8px_rgba(123,97,255,0.4)]' : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex justify-between text-[9px] text-white/50 font-fira bg-[#0A0A14] p-2.5 rounded-xl border border-white/5 select-none">
                  <span>⏱️ Thời lượng: {formatTime(recordingTime)}</span>
                  <span>⚡ Nhịp điệu: {recordingTime > 0 ? Math.round((transcript.split(/\s+/).filter(Boolean).length / recordingTime) * 60) : 0} WPM</span>
                </div>
              </div>

              {/* Live Transcript / Input Panel */}
              <div className="bg-[#11111E] rounded-[2.2rem] border border-white/5 p-5 flex-1 flex flex-col gap-3 min-h-[260px] relative overflow-hidden">
                <div className="text-[9px] font-fira text-[#00F0FF] uppercase tracking-wider font-bold shrink-0">Live Dictation (Vietnamese)</div>
                
                {!isSTTSupported && (
                  <div className="text-[10px] bg-red-950/30 border border-red-900/40 text-red-300 p-2.5 rounded-xl leading-normal shrink-0">
                    ⚠️ Trình duyệt hiện tại không hỗ trợ nhận diện giọng nói trực tiếp (Web Speech API). Hãy mở ứng dụng bằng <strong>Google Chrome / Safari</strong> hoặc nhập văn bản thủ công bên dưới.
                  </div>
                )}

                <div className="flex-1 overflow-y-auto text-xs text-white/90 leading-relaxed pr-1 select-text">
                  {transcript ? (
                    <p className="font-semibold text-[#F0EFF4]">{transcript}</p>
                  ) : textInput && sttProvider !== 'browser' ? (
                    <p className="font-semibold text-[#F0EFF4]">{textInput}</p>
                  ) : (
                    <p className="text-[#88889C] italic">AI sẽ ghi lại bài nói thuyết trình bằng tiếng Việt của bạn khi bạn nhấn Ghi âm...</p>
                  )}
                </div>

                {(sttProvider !== 'browser' || !isSTTSupported) && (
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Gõ đoạn văn bản thuyết trình slide tại đây để kiểm tra..."
                    className="w-full h-28 bg-[#0A0A14] border border-white/5 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-[#7B61FF] resize-y min-h-[96px] shrink-0"
                  />
                )}
              </div>

              {/* Glowing Circle Record controls widget */}
              <div className="flex flex-col items-center justify-center py-1 shrink-0 relative select-none">
                <div className="relative flex items-center justify-center">
                  {isRecording && (
                    <>
                      <div className="absolute w-24 h-24 rounded-full bg-[#7B61FF]/10 animate-ping"></div>
                      <div className="absolute w-20 h-20 rounded-full bg-[#00F0FF]/15 animate-pulse"></div>
                    </>
                  )}
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isUploadingAudio}
                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all transform cursor-pointer z-10 border disabled:opacity-50 disabled:cursor-not-allowed ${
                      isRecording 
                        ? 'bg-gradient-to-tr from-red-500 to-amber-500 text-white border-red-400 hover:scale-95' 
                        : 'bg-gradient-to-tr from-[#7B61FF] to-[#00F0FF] hover:scale-105 border-white/10 text-white shadow-[0_0_20px_rgba(123,97,255,0.4)]'
                    }`}
                  >
                    {isRecording ? <Square size={16} fill="white" className="text-white" /> : <Mic size={22} className="text-white" />}
                  </button>
                </div>
                
                <p className="text-[9px] font-fira text-[#88889C] mt-2 tracking-widest font-bold">
                  {isRecording ? 'NHẤN ĐỂ DỪNG THUYẾT TRÌNH' : 'NHẤN ĐỂ GHI ÂM BÀI NÓI'}
                </p>
                <input
                  ref={audioUploadRef}
                  type="file"
                  accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.aac"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioUploadRef.current?.click()}
                  disabled={isRecording || isUploadingAudio}
                  className="mt-2 h-8 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[#F0EFF4] text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isUploadingAudio ? <Loader2 className="animate-spin" size={12} /> : <Upload size={12} />}
                  Upload voice
                </button>
              </div>

              {/* Action operations pill buttons */}
              <div className="flex gap-2 shrink-0 select-none">
                <button
                  onClick={handleResetTranscripts}
                  className="px-4 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white text-[10px] font-bold transition-all cursor-pointer"
                >
                  Xóa tất cả
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={isLoading || isRecording || isUploadingAudio}
                  className="flex-1 h-11 rounded-xl bg-[#7B61FF] hover:bg-[#684CFF] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 shadow-[0_4px_12px_rgba(123,97,255,0.3)] cursor-pointer"
                >
                  {isLoading ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  Chấm bài thuyết trình
                </button>
              </div>

              {/* Inline status log drawer */}
              <p className="text-[9px] text-[#88889C] font-fira leading-relaxed bg-[#11111E] p-2.5 rounded-xl border border-white/5 shrink-0 select-none">
                {statusMsg}
              </p>
            </div>
          )}

          {/* 2. REPORT METRICS VIEWPORT */}
          {activeView === 'report' && (
            <div className="absolute inset-0 px-5 py-4 flex flex-col gap-4 overflow-y-auto pb-24">
              
              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center select-none">
                  <RefreshCw className="animate-spin text-[#7B61FF]" size={36} />
                  <h3 className="font-bold text-sm text-white font-sora">Đang phân tích slide deck...</h3>
                  <p className="text-[11px] text-[#88889C] max-w-[240px]">AI đang giải mã cấu trúc bài thuyết trình, ước lượng nhịp điệu và tốc độ nói WPM.</p>
                </div>
              ) : assessment ? (
                <>
                  {/* Cyberpunk overall score widget */}
                  <div className="bg-gradient-to-tr from-[#11111E] to-[#18182A] border border-white/5 p-4 rounded-[2.2rem] flex justify-between items-center shrink-0 shadow-lg">
                    <div>
                      <h3 className="text-[9px] font-fira text-[#7B61FF] uppercase tracking-widest font-bold">Báo Cáo Điểm Zen</h3>
                      <p className="text-base font-black text-white font-sora">{assessment.estimated_impact}</p>
                    </div>
                    
                    <div className="text-center bg-[#0A0A14] px-4 py-2 rounded-2xl border border-white/5 shadow-inner">
                      <p className="text-[8px] text-[#88889C] font-fira uppercase font-bold">ẢNH HƯỞNG</p>
                      <p className="text-base font-black text-[#00F0FF] font-fira">
                        {assessment.overall_score}<span className="text-[9px] text-white/40 font-normal">/100</span>
                      </p>
                    </div>
                  </div>

                  {/* Inner report view tabs selector */}
                  <div className="flex border-b border-white/5 text-xs shrink-0 font-bold select-none font-sora">
                    <button
                      onClick={() => setActiveTab('delivery')}
                      className={`flex-1 pb-2 text-center border-b-2 transition-all ${
                        activeTab === 'delivery' ? 'border-[#7B61FF] text-[#7B61FF]' : 'border-transparent text-[#88889C]'
                      }`}
                    >
                      Nhịp diễn đạt
                    </button>
                    <button
                      onClick={() => setActiveTab('slides')}
                      className={`flex-1 pb-2 text-center border-b-2 transition-all ${
                        activeTab === 'slides' ? 'border-[#7B61FF] text-[#7B61FF]' : 'border-transparent text-[#88889C]'
                      }`}
                    >
                      Trang slide
                    </button>
                    <button
                      onClick={() => setActiveTab('suggestions')}
                      className={`flex-1 pb-2 text-center border-b-2 transition-all ${
                        activeTab === 'suggestions' ? 'border-[#7B61FF] text-[#7B61FF]' : 'border-transparent text-[#88889C]'
                      }`}
                    >
                      Viết lại mẫu
                    </button>
                  </div>

                  {/* Display active report tab panel */}
                  <div className="flex-1 space-y-4">
                    
                    {activeTab === 'delivery' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="p-4 rounded-[1.6rem] bg-[#11111E] border border-white/5 space-y-1.5 shadow-sm">
                          <p className="text-[9px] font-fira text-[#7B61FF] uppercase tracking-wider flex items-center gap-1 font-bold">
                            <Sparkle size={12} className="text-[#00F0FF]" /> Nhận xét tổng quan:
                          </p>
                          <p className="text-[11px] leading-relaxed text-white/90 font-instrument italic">
                            "{assessment.brutally_honest_summary}"
                          </p>
                          <SpeakFeedback 
                            text={assessment.brutally_honest_summary} 
                            voiceName="M1" 
                            speed={1.05} 
                            lang="vi" 
                            accentColor="#7B61FF" 
                          />
                        </div>

                        <div className="space-y-2.5">
                          {Object.entries(assessment.delivery_metrics).map(([metric, descText]) => (
                            <div key={metric} className="p-3.5 rounded-[1.6rem] border border-white/5 bg-[#11111E]/40 space-y-1">
                              <span className="text-[8px] font-fira text-[#00F0FF] uppercase tracking-wider font-bold">
                                {metric.toUpperCase()}
                              </span>
                              <p className="text-[11px] leading-relaxed text-white/80">
                                {descText}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === 'slides' && (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        <h4 className="text-[9px] font-fira text-[#7B61FF] uppercase tracking-wider font-bold">Phân tích chi tiết từng slide:</h4>
                        {assessment.slide_by_slide_feedback.map((feedItem, index) => (
                          <div key={index} className="p-3.5 rounded-[1.6rem] border border-white/5 bg-[#11111E]/30 text-[11px] leading-relaxed text-white/80 flex items-start gap-2">
                            <span className="text-[#7B61FF] font-extrabold text-xs leading-none">•</span>
                            <span>{feedItem}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'suggestions' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="p-4 rounded-[1.8rem] border border-white/5 bg-[#11111E] space-y-2">
                          <p className="text-[9px] font-fira text-[#7B61FF] uppercase tracking-wider flex items-center gap-1 font-bold">
                            <Sparkles size={11} className="text-[#00F0FF]" /> Bản mẫu cải thiện (TED Style):
                          </p>
                          <p className="text-[11px] leading-relaxed text-white/90 whitespace-pre-line font-instrument italic bg-[#0A0A14] p-3.5 rounded-2xl border border-white/5">
                            {assessment.better_version}
                          </p>
                          <SpeakFeedback 
                            text={assessment.better_version} 
                            voiceName="M1" 
                            speed={1.05} 
                            lang="vi" 
                            accentColor="#7B61FF" 
                          />
                        </div>

                        <div className="p-3.5 rounded-[1.6rem] bg-[#7B61FF]/10 border border-[#7B61FF]/20 text-[10px] text-[#F0EFF4] leading-relaxed flex gap-2">
                          <span>💡</span>
                          <p><strong>Mẹo thiết kế bài thuyết trình:</strong> {assessment.pro_presentation_tip}</p>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Return buttons */}
                  <button
                    onClick={() => setActiveView('practice')}
                    className="w-full h-11 shrink-0 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold transition-all select-none cursor-pointer"
                  >
                    Quay lại luyện tập
                  </button>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center select-none">
                  <div className="w-14 h-14 rounded-full bg-[#11111E] border border-white/5 flex items-center justify-center text-[#7B61FF]">
                    <Layout size={22} />
                  </div>
                  <h3 className="font-bold text-sm text-white font-sora">Chưa có dữ liệu bài nói</h3>
                  <p className="text-[11px] text-[#88889C] max-w-[240px]">Hãy chọn slide bên tab Luyện tập, ghi âm bài phát biểu của bạn và nhấn Phân tích để nhận báo cáo.</p>
                </div>
              )}

            </div>
          )}

          {/* 3. SETTINGS & CONFIG VIEWPORT */}
          {activeView === 'settings' && (
            <div className="absolute inset-0 px-5 py-4 flex flex-col gap-4 overflow-y-auto pb-24">
              
              <div className="bg-[#11111E] rounded-[2.2rem] border border-white/5 p-5 space-y-5">
                <div className="flex items-center gap-2 select-none border-b border-white/5 pb-3">
                  <Settings size={18} className="text-[#7B61FF]" />
                  <h3 className="font-bold text-xs text-white font-sora">Cấu hình thuyết trình</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1 animate-in fade-in duration-200">
                    <label className="block text-[9px] font-fira text-[#7B61FF] uppercase tracking-wider mb-1 font-bold">Google Gemini API Key</label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="Nhập API Key: AIzaSy..."
                      className="w-full bg-[#0A0A14] border border-white/5 rounded-xl p-3 text-xs focus:outline-none focus:border-[#7B61FF] text-white"
                    />
                    <p className="text-[8px] text-[#88889C] leading-normal pt-1">
                      🔒 API Key được lưu trực tiếp trong LocalStorage trên máy khách, tuyệt đối an toàn.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[9px] font-fira text-[#7B61FF] uppercase tracking-wider mb-2 font-bold">Nhận diện giọng nói (STT)</label>
                    <select
                      value={sttProvider}
                      onChange={(e) => setSttProvider(e.target.value)}
                      className="w-full bg-[#0A0A14] border border-white/5 rounded-xl p-3 text-xs focus:outline-none focus:border-[#7B61FF] text-white"
                    >
                      <option value="cloud">Cloud Whisper API (Đám mây siêu chính xác)</option>
                      <option value="manual">Nhập văn bản thủ công (Sandbox Textbox)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSaveSettings}
                  className="w-full h-11 rounded-xl bg-[#7B61FF] hover:bg-[#684CFF] text-white text-xs font-bold transition-all shadow-[0_4px_12px_rgba(123,97,255,0.3)] cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>

              {/* Status info bar */}
              <div className="p-4 rounded-[1.8rem] border border-white/5 bg-[#11111E]/40 text-[9px] text-[#88889C] leading-relaxed">
                🚀 AuraSpeak Presentation Engine thiết lập môi trường phân tích nhịp độ tiếng Việt chuẩn TED. 
                Bạn có thể sửa đổi danh sách slide ngay ở nút chỉnh sửa trên từng trang slide ở tab Luyện tập.
              </div>
            </div>
          )}

        </div>

        {/* Slide-Up Bottom Sheet Drawer for Editing Current Slide */}
        {showSlideDrawer && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-end animate-in fade-in duration-200">
            {/* Click to close backdrop layer */}
            <div className="absolute inset-0" onClick={() => setShowSlideDrawer(false)}></div>
            
            {/* Sliding Drawer Container */}
            <div className="w-full bg-[#11111E] rounded-t-[2.5rem] border-t border-white/10 p-6 z-50 space-y-4 max-h-[75%] overflow-y-auto animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 size={15} className="text-[#7B61FF]" />
                  <h3 className="font-bold text-xs text-white font-sora">Chỉnh sửa Slide {activeSlideIndex + 1}</h3>
                </div>
                <button 
                  onClick={() => setShowSlideDrawer(false)}
                  className="text-[10px] font-fira text-[#88889C] hover:text-white uppercase font-bold"
                >
                  Xong
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-fira text-[#7B61FF] uppercase tracking-wider mb-1.5 font-bold">Tiêu đề slide</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#0A0A14] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-fira text-[#7B61FF] uppercase tracking-wider mb-1.5 font-bold">Mô tả mục tiêu thuyết trình</label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full h-32 min-h-[96px] bg-[#0A0A14] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#7B61FF] resize-y"
                  />
                </div>

                <div className="flex gap-2 pt-1 border-t border-white/5">
                  <button
                    onClick={updateActiveSlide}
                    className="flex-1 h-10 rounded-xl bg-[#7B61FF]/20 hover:bg-[#7B61FF]/30 border border-[#7B61FF]/30 text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check size={12} /> Cập nhật trang
                  </button>
                  <button
                    onClick={handleDeleteActiveSlide}
                    className="px-3.5 h-10 rounded-xl bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 text-red-400 text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer"
                    title="Xóa slide này"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Additional list management options */}
                <div className="pt-3 border-t border-white/5 flex gap-2">
                  <button
                    onClick={handleAddNewSlide}
                    className="w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[#00F0FF] text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={12} /> Chèn thêm Slide mới
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Floating Pill Bottom Navigation Tab Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#12121E]/85 backdrop-blur-md border-t border-white/5 flex items-center justify-around px-6 z-30 pb-2 shrink-0 select-none">
          <button 
            onClick={() => setActiveView('practice')}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeView === 'practice' ? 'text-[#7B61FF] scale-105 shadow-[0_-8px_16px_rgba(123,97,255,0.15)]' : 'text-[#88889C] hover:text-white'
            }`}
          >
            <Mic size={18} className={activeView === 'practice' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[9px] font-fira tracking-wide font-bold">Luyện tập</span>
          </button>
          
          <button 
            onClick={() => {
              if (assessment) {
                setActiveView('report');
              } else {
                setStatusMsg('Hãy nói tối thiểu 1 slide và bấm Chấm bài để mở khóa Báo cáo AI!');
              }
            }}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeView === 'report' ? 'text-[#7B61FF] scale-105 shadow-[0_-8px_16px_rgba(123,97,255,0.15)]' : 'text-[#88889C] hover:text-white'
            } ${!assessment ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Award size={18} className={activeView === 'report' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[9px] font-fira tracking-wide font-bold">Báo cáo AI</span>
          </button>

          <button 
            onClick={() => setActiveView('settings')}
            className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeView === 'settings' ? 'text-[#7B61FF] scale-105 shadow-[0_-8px_16px_rgba(123,97,255,0.15)]' : 'text-[#88889C] hover:text-white'
            }`}
          >
            <Settings size={18} className={activeView === 'settings' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[9px] font-fira tracking-wide font-bold">Cấu hình</span>
          </button>
        </div>

      </div>
    </div>
  );
}

function SpeakFeedback({ text, voiceName, speed = 1.05, lang = "en", accentColor = "#7B61FF" }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (isOffline) {
        window.speechSynthesis.cancel();
      }
    };
  }, [audioUrl, isOffline]);

  const handleSpeech = async () => {
    if (isPlaying) {
      if (isOffline) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      } else if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (audioRef.current && !isOffline) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    setIsOffline(false);

    try {
      const backendUrl = import.meta.env.VITE_AI_TO_VOICE_URL || 'http://localhost:8002';
      const response = await fetch(`${backendUrl}/v1/tts/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_name: voiceName, lang, speed }),
      });

      if (!response.ok) {
        throw new Error('Backend synthesis failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      setIsLoading(false);
      setIsPlaying(true);
      audio.play().catch(() => {
        setIsPlaying(false);
      });

    } catch (err) {
      console.warn("Speech synthesis backend failed, falling back to local speech synthesis:", err);
      setIsOffline(true);
      setIsLoading(false);
      setIsPlaying(true);

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'en' ? 'en-US' : 'vi-VN';
      utterance.rate = speed;

      const voices = window.speechSynthesis.getVoices();
      const isFemale = voiceName && voiceName.startsWith('F');
      const matchingVoice = voices.find(v => {
        const nameLower = v.name.toLowerCase();
        if (isFemale) {
          return nameLower.includes('female') || nameLower.includes('google us english') || nameLower.includes('samantha') || nameLower.includes('zira');
        } else {
          return nameLower.includes('male') || nameLower.includes('google uk english male') || nameLower.includes('daniel') || nameLower.includes('david');
        }
      });
      if (matchingVoice) utterance.voice = matchingVoice;

      utterance.onend = () => {
        setIsPlaying(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleScrub = (e) => {
    if (audioRef.current && !isOffline) {
      const val = parseFloat(e.target.value);
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const formatTime = (timeInSec) => {
    if (isNaN(timeInSec)) return "00:00";
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-[#FAF8F5]/10 backdrop-blur-md rounded-2xl border border-white/10 p-3 flex flex-col gap-2 mt-2 transition-all">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleSpeech}
          disabled={isLoading}
          style={{ '--accent-color': accentColor }}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent-color)] text-[#0D0D12] hover:scale-105 active:scale-95 transition-all shadow-md shrink-0 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" fill="currentColor" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
          )}
        </button>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-wider text-[#FAF8F5]/60 font-bold uppercase">
              {isOffline ? 'Local Speech Synthesis' : 'AI Voice Synthesis'}
            </span>
            {isOffline && (
              <span className="text-[8px] font-mono bg-[#C9A84C]/20 text-[#C9A84C] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                Offline Mode
              </span>
            )}
          </div>
          <p className="text-[11px] truncate text-[#FAF8F5]/80 mt-0.5">
            {isPlaying ? 'Đang phát âm thanh nhận xét...' : 'Nhấp để nghe nhận xét bằng giọng nói.'}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
          <Volume2 className="w-3.5 h-3.5 text-[#FAF8F5]/60" />
          <span className="text-[9px] font-mono font-bold text-[#FAF8F5]/70">
            {voiceName}
          </span>
        </div>
      </div>

      {(isPlaying || duration > 0) && (
        <div className="flex items-center gap-3 mt-1 px-1 animate-in fade-in duration-200">
          <span className="text-[9px] font-mono text-[#FAF8F5]/50 w-7 shrink-0 text-left">
            {formatTime(currentTime)}
          </span>

          {isOffline ? (
            <div className="flex-1 h-1.5 flex items-center gap-0.5 justify-center">
              {[...Array(12)].map((_, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: accentColor,
                    animationDelay: `${i * 0.08}s`,
                    height: isPlaying ? '100%' : '20%'
                  }}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isPlaying ? 'animate-pulse' : ''
                  }`}
                />
              ))}
            </div>
          ) : (
            <input
              type="range"
              min="0"
              max={duration || 1}
              step="0.05"
              value={currentTime}
              onChange={handleScrub}
              style={{ accentColor: accentColor }}
              className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer range-xs"
            />
          )}

          <span className="text-[9px] font-mono text-[#FAF8F5]/50 w-7 shrink-0 text-right">
            {isOffline ? '--:--' : formatTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
