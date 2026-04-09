import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, RotateCcw, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LivenessResponse, VerificationPrompt } from '@/types';

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

export default function LivenessChallenge({ prompts, onComplete }: LivenessChallengeProps) {
  const [responses, setResponses] = useState<Record<string, LivenessResponse>>({});
  const [spokenDigits, setSpokenDigits] = useState('');
  const [speechListening, setSpeechListening] = useState(false);
  const [speechSupported] = useState(Boolean(getSpeechRecognition()));
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  const voicePrompt = useMemo(
    () => prompts.find((prompt) => prompt.type === 'say_digits'),
    [prompts]
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const markPassed = (prompt: VerificationPrompt) => {
    setResponses((current) => ({
      ...current,
      [prompt.type]: {
        type: prompt.type,
        passed: true,
        confidence: prompt.type === 'say_digits' ? 0.72 : 0.88,
        spokenDigits: prompt.type === 'say_digits' ? spokenDigits : undefined,
      },
    }));
  };

  const markRetry = (prompt: VerificationPrompt) => {
    setResponses((current) => ({
      ...current,
      [prompt.type]: {
        type: prompt.type,
        passed: false,
        confidence: 0.35,
        spokenDigits: prompt.type === 'say_digits' ? spokenDigits : undefined,
      },
    }));
  };

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
    recognition.onerror = () => {
      setSpeechListening(false);
    };
    recognition.onend = () => {
      setSpeechListening(false);
    };

    recognitionRef.current = recognition;
    setSpeechListening(true);
    recognition.start();
  };

  const completedCount = Object.values(responses).filter((response) => response.passed).length;
  const allPromptsHandled = prompts.every((prompt) => responses[prompt.type]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-2/80 p-5">
        <div className="flex items-center gap-2 text-accent">
          <Sparkles size={16} />
          <span className="text-sm font-medium">Randomized liveness challenge</span>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Complete {prompts.length === 1 ? 'this challenge' : 'these challenges'} live so the system can confirm it is really you.
        </p>
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
                  Completed
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
                  <Button type="button" variant="outline" onClick={() => setSpokenDigits('')}>
                    <RotateCcw size={14} />
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-background/50 p-4 text-sm text-gray-400">
                Perform the action now, keep your face inside the frame, then confirm below once you have done it cleanly.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => markPassed(prompt)}>
                I completed this
              </Button>
              <Button type="button" variant="outline" onClick={() => markRetry(prompt)}>
                Retry challenge
              </Button>
            </div>
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
            disabled={!allPromptsHandled || prompts.some((prompt) => !responses[prompt.type]?.passed)}
            onClick={() => onComplete(prompts.map((prompt) => responses[prompt.type]).filter(Boolean))}
          >
            Continue verification
          </Button>
        </div>
      </div>

      {voicePrompt && !speechSupported ? (
        <p className="text-xs text-warning">
          Voice capture is not supported by this browser, so manual spoken-digit confirmation is being used for this attempt.
        </p>
      ) : null}
    </div>
  );
}

