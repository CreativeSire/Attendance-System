import * as faceapi from '@vladmandic/face-api';

type DetectionWithLandmarks = faceapi.WithFaceDescriptor<
  faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
>;

export type FaceAnalysis = {
  descriptor: number[];
  qualityScore: number;
  detectionScore: number;
  eyeAspectRatio: number;
  box: { x: number; y: number; width: number; height: number };
  landmarks: {
    leftEyeCenter: { x: number; y: number };
    rightEyeCenter: { x: number; y: number };
    noseTip: { x: number; y: number };
    jawCenter: { x: number; y: number };
  };
};

type ChallengeMetrics = {
  eyeAspectRatio?: number;
  yawRatio?: number;
  nodOffset?: number;
};

let modelsPromise: Promise<void> | null = null;

function averagePoint(points: faceapi.Point[]) {
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function eyeAspectRatio(points: faceapi.Point[]) {
  if (points.length < 6) return 0;
  const vertical1 = distance(points[1]!, points[5]!);
  const vertical2 = distance(points[2]!, points[4]!);
  const horizontal = distance(points[0]!, points[3]!);
  return (vertical1 + vertical2) / (2 * (horizontal || 1));
}

function buildAnalysis(detection: DetectionWithLandmarks): FaceAnalysis {
  const landmarks = detection.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const jawOutline = landmarks.getJawOutline();
  const nose = landmarks.getNose();
  const leftEyeCenter = averagePoint(leftEye);
  const rightEyeCenter = averagePoint(rightEye);
  const noseTip = nose[Math.floor(nose.length / 2)] ?? averagePoint(nose);
  const jawCenter = jawOutline[Math.floor(jawOutline.length / 2)] ?? averagePoint(jawOutline);
  const box = detection.detection.box;

  const faceCoverage = Math.min(1, (box.width * box.height) / (280 * 280));
  const centeredness = 1 - Math.min(1, Math.abs((box.x + box.width / 2) - 160) / 160);
  const qualityScore = Number(Math.max(0.35, Math.min(0.99, (detection.detection.score * 0.5) + (faceCoverage * 0.3) + (centeredness * 0.2))).toFixed(4));

  return {
    descriptor: Array.from(detection.descriptor),
    qualityScore,
    detectionScore: Number(detection.detection.score.toFixed(4)),
    eyeAspectRatio: Number((((eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2) || 0).toFixed(4)),
    box: {
      x: Number(box.x.toFixed(2)),
      y: Number(box.y.toFixed(2)),
      width: Number(box.width.toFixed(2)),
      height: Number(box.height.toFixed(2)),
    },
    landmarks: {
      leftEyeCenter,
      rightEyeCenter,
      noseTip: { x: noseTip.x, y: noseTip.y },
      jawCenter,
    },
  };
}

export async function ensureFaceModels() {
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/face-models'),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri('/face-models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/face-models'),
    ]).then(() => undefined);
  }

  return modelsPromise;
}

export async function analyzeFaceFromImageElement(image: HTMLImageElement | HTMLVideoElement) {
  await ensureFaceModels();
  const detection = await faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!detection) return null;
  return buildAnalysis(detection);
}

export async function analyzeFaceImage(dataUrl: string) {
  const image = new Image();
  image.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to load face image.'));
  });

  return analyzeFaceFromImageElement(image);
}

export async function measureVideoFrame(video: HTMLVideoElement): Promise<(FaceAnalysis & { challengeMetrics: ChallengeMetrics }) | null> {
  const analysis = await analyzeFaceFromImageElement(video);
  if (!analysis) return null;

  const leftEyeCenter = analysis.landmarks.leftEyeCenter;
  const rightEyeCenter = analysis.landmarks.rightEyeCenter;
  const noseTip = analysis.landmarks.noseTip;
  const jawCenter = analysis.landmarks.jawCenter;
  const eyesDistance = Math.max(1, distance(leftEyeCenter, rightEyeCenter));
  const eyeLineCenterX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
  const eyeLineCenterY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

  const challengeMetrics: ChallengeMetrics = {
    eyeAspectRatio: analysis.eyeAspectRatio,
    yawRatio: Number(((noseTip.x - eyeLineCenterX) / eyesDistance).toFixed(4)),
    nodOffset: Number(((noseTip.y - eyeLineCenterY) / eyesDistance).toFixed(4)),
  };

  return {
    ...analysis,
    challengeMetrics,
  };
}

export function evaluateBlinkSequence(history: ChallengeMetrics[]) {
  const ratios = history.map((item) => item.eyeAspectRatio ?? 0);
  let blinkCount = 0;
  let wasClosed = false;

  for (const ratio of ratios) {
    const isClosed = ratio < 0.22;
    if (isClosed && !wasClosed) {
      blinkCount += 1;
    }
    wasClosed = isClosed;
  }

  return blinkCount >= 2;
}

export function evaluateTurn(history: ChallengeMetrics[], direction: 'left' | 'right') {
  const yawValues = history.map((item) => item.yawRatio ?? 0);
  if (direction === 'left') {
    return yawValues.some((value) => value < -0.12);
  }
  return yawValues.some((value) => value > 0.12);
}

export function evaluateNod(history: ChallengeMetrics[]) {
  const offsets = history.map((item) => item.nodOffset ?? 0);
  const min = Math.min(...offsets);
  const max = Math.max(...offsets);
  return max - min > 0.12;
}
