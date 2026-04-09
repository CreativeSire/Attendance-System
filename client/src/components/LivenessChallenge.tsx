import { useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, Mic, MicOff, RotateCcw, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LivenessResponse, VerificationPrompt } from '@/types';
import {
  ensureFaceModels,
  evaluateBlinkSequence,
  evaluateNod,
  evaluateTurn,
  measureVideoFrame,
} from '@/lib/face-verification';

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return (window as typeof window & {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }).SpeechRecognition || (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition || null;
}

interface LivenessChallengeProps {
  prompts: VerificationPrompt[];
  onComplete: (responses: LivenessResponse[]) => void;
}

type MetricsPoint = { eyeAspectRatio?: number; yawRatio?: number; nodOffset?: number };

const WINDOW_SIZE = 18;

export default function LivenessChallenge({ prompts, onComplete }: LivenessChallengeProps) {
  const webcamRef = useRef<Webcam>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const [responses, setResponses] = useState<Record<string, LivenessResponse>>({});
  const [spokenDigits, setSpokenDigits] = useState('');
  const [speechListening, setSpeechListening] = useState(false);
  const [speechSupported] = useState(Boolean(getSpeechRecognition()));
  const [frameError, setFrameError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<MetricsPoint[]>([]);

  const voicePrompt = useMemo(
    () => prompts.find((prompt) => prompt.type === 'say_digits'),
    [prompts]
  );

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const loop = async () => {
      if (!active || !cameraReady || !webcamRef.current?.video) {
        timer = window.setTimeout(loop, 450);
        return;
      }

      try {
        await ensureFaceModels();
        const measurement = await measureVideoFrame(webcamRef.current.video as HTMLVideoElement);
        if (measurement?.challengeMetrics) {
          setFrameError(null);
          setMetricsHistory((current) => [...current, measurement.challengeMetrics].slice(-WINDOW_SIZE));
        }
      } catch {
        setFrameError('Unable to analyze the live camera feed for liveness right now.');
      }

      timer = window.setTimeout(loop, 450);
    };

    timer = window.setTimeout(loop, 300);

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      recognitionRef.current?.stop();
    };
  }, [cameraReady]);

  useEffect(() => {
    prompts.forEach((prompt) => {
      if (responses[prompt.type]?.passed) return;

      if (prompt.type === 'blink_twice' && evaluateBlinkSequence(metricsHistory)) {
        setResponses((current) => ({
          ...current,
          blink_twice: {
            type: 'blink_twice',
            passed: true,
            confidence: 0.9,
            metrics: { blinkWindow: metricsHistory },
          },
        }));
      }

      if (prompt.type === 'turn_left' && evaluateTurn(metricsHistory, 'left')) {
        setResponses((current) => ({
          ...current,
          turn_left: {
            type: 'turn_left',
            passed: true,
            confidence: 0.87,
            metrics: { yawWindow: metricsHistory },
          },
        }));
      }

      if (prompt.type === 'turn_right' && evaluateTurn(metricsHistory, 'right')) {
        setResponses((current) => ({
          ...current,
          turn_right: {
            type: 'turn_right',
            passed: true,
            confidence: 0.87,
            metrics: { yawWindow: metricsHistory },
          },
        }));
      }

      if (prompt.type === 'nod_slowly' && evaluateNod(metricsHistory)) {
        setResponses((current) => ({
          ...current,
          nod_slowly: {
            type: 'nod_slowly',
            passed: true,
            confidence: 0.86,
            metrics: { nodWindow: metricsHistory },
          },
        }));
      }
    });
  }, [metricsHistory, prompts, responses]);

  useEffect(() => {
    if (!voicePrompt || !spokenDigits.trim()) return;
    const promptDigits = voicePrompt.prompt.replace(/\D/g, '');
    if (!promptDigits) return;

    const passed = spokenDigits.includes(promptDigits);
    setResponses((current) => ({
      ...current,
      say_digits: {
        type: 'say_digits',
        passed,
        confidence: passed ? 0.84 : 0.35,
        spokenDigits,
        metrics: { expectedDigits: promptDigits, heardDigits: spokenDigits },
      },
    }));
  }, [spokenDigits, voicePrompt]);

  const startVoiceCapture = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .flatMap((result) => Array.from(result))
        .map((alt) => alt.transcript)
        .join(' ')
        .replace(/\D/g, '');
      setSpokenDigits(transcript);
    };
    recognition.onerror = () => setSpeechListening(false);
    recognition.onend = () => setSpeechListening(false);

    recognitionRef.current = recognition;
    setSpeechListening(true);
    recognition.start();
  };

  const resetPrompt = (prompt: VerificationPrompt) => {
    setResponses((current) => {
      const next = { ...current };
      delete next[prompt.type];
      return next;
    });

    if (prompt.type === 'say_digits') {
      setSpokenDigits('');
    }
    setMetricsHistory([]);
  };

  const allPromptsHandled = prompts.every((prompt) => responses[prompt.type]?.passed);
  const completedCount = prompts.filter((prompt) => responses[prompt.type]?.passed).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-2/80 p-5">
        <div className="flex items-center gap-2 text-accent">
          <Sparkles size={16} />
          <span className="text-sm font-medium">Measured liveness challenge</span>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Keep your face in frame. The system watches real eye, head, and motion cues instead of asking you to simply confirm that you did them.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
        <div className="relative mx-auto h-72 max-w-sm overflow-hidden rounded-2xl border border-border bg-background">
          <Webcam
            ref={webcamRef}
            audio={Boolean(voicePrompt)}
            mirrored
            className="h-full w-full object-cover"
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
            onUserMedia={() => setCameraReady(true)}
            onUserMediaError={() => setFrameError('Camera access failed during the liveness step.')}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-52 w-40 rounded-[999px] border-2 border-accent/70" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-gray-300">
            <div className="flex items-center gap-2 text-white"><Camera size={14} /> Camera</div>
            <p className="mt-2">{cameraReady ? 'Live feed connected.' : 'Waiting for camera permission.'}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-gray-300">
            <div className="flex items-center gap-2 text-white"><ShieldCheck size={14} /> Progress</div>
            <p className="mt-2">{completedCount} of {prompts.length} challenge{prompts.length === 1 ? '' : 's'} completed.</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-gray-300">
            <div className="flex items-center gap-2 text-white"><Sparkles size={14} /> Frame analysis</div>
            <p className="mt-2">{frameError ? frameError : 'Landmarks and movement cues are being tracked live.'}</p>
          </div>
        </div>
      </div>

      {prompts.map((prompt, index) => {
        const response = responses[prompt.type];
        return (
          <div key={`${prompt.type}-${index}`} className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Challenge {index + 1}</p>
                <p className="mt-1 text-white font-semibold">{prompt.prompt}</p>
              </div>
              {response?.passed ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                  <ShieldCheck size={13} />
                  Detected
                </div>
              ) : null}
            </div>

            {prompt.type === 'say_digits' ? (
              <div className="space-y-3 rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Volume2 size={15} />
                  Speak the digits shown in the prompt. You can also type what you said if voice capture is unsupported.
                </div>
                <input
                  value={spokenDigits}
                  onChange={(event) => setSpokenDigits(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Type or capture spoken digits"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-white placeholder:text-gray-500 focus:border-accent focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startVoiceCapture}
                    disabled={!speechSupported || speechListening}
                  >
                    {speechListening ? <MicOff size={14} /> : <Mic size={14} />}
                    {speechSupported ? (speechListening ? 'Listening...' : 'Use microphone') : 'Microphone unsupported'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-background/50 p-4 text-sm text-gray-400">
                Keep your face in the guide and perform the action once. The app will auto-detect it and mark the challenge complete.
              </div>
            )}

            {!response?.passed ? (
              <Button type="button" variant="outline" onClick={() => resetPrompt(prompt)}>
                <RotateCcw size={14} />
                Reset challenge
              </Button>
            ) : null}
          </div>
        );
      })}

      <div className="rounded-2xl border border-border bg-surface-2/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">Liveness progress</p>
            <p className="text-xs text-gray-400">{completedCount} of {prompts.length} challenge{prompts.length === 1 ? '' : 's'} completed</p>
          </div>
          <Button
            type="button"
            size="lg"
            disabled={!allPromptsHandled}
            onClick={() => onComplete(prompts.map((prompt) => responses[prompt.type]).filter(Boolean))}
          >
            Continue verification
          </Button>
        </div>
      </div>
    </div>
  );
}
