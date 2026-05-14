import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DecodeHintType, Result } from '@zxing/library';
import { CenterCropBrowserMultiFormatReader } from '@/lib/zxingCenterCropReader';

type Base = {
  paused?: boolean;
  hints?: Map<DecodeHintType, unknown>;
  timeBetweenDecodingAttempts?: number;
  onResult?: (result: Result) => void;
  onError?: (error: Error) => void;
};

export type UseZxingCenterCropOptions =
  | (Base & { constraints?: MediaStreamConstraints; deviceId?: never })
  | (Base & { deviceId: string; constraints?: never });

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: 'environment' },
};

function deepEqConstraints(a?: MediaStreamConstraints, b?: MediaStreamConstraints): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Igual que `useZxing` de react-zxing, pero con {@link CenterCropBrowserMultiFormatReader}
 * para decodificar solo el centro del fotograma (se adapta a `videoWidth`/`videoHeight`).
 */
export function useZxingCenterCrop(options: UseZxingCenterCropOptions = {}) {
  const {
    paused = false,
    hints,
    timeBetweenDecodingAttempts = 300,
    onResult = () => {},
    onError = () => {},
  } = options;

  const deviceId = 'deviceId' in options && options.deviceId ? options.deviceId : undefined;

  const [constraints, setConstraints] = useState<MediaStreamConstraints | undefined>(
    deviceId ? undefined : options.constraints,
  );

  const resultHandlerRef = useRef(onResult);
  const errorHandlerRef = useRef(onError);
  const ref = useRef<HTMLVideoElement>(null);

  const requestedConstraints =
    deviceId ? undefined : 'constraints' in options ? options.constraints : undefined;

  const reader = useMemo(() => {
    const instance = new CenterCropBrowserMultiFormatReader(hints);
    instance.timeBetweenDecodingAttempts = timeBetweenDecodingAttempts;
    return instance;
  }, [hints, timeBetweenDecodingAttempts]);

  const decodeCallback = useCallback((result: Result | undefined, error: Error | undefined) => {
    if (result) resultHandlerRef.current(result);
    if (error) errorHandlerRef.current(error);
  }, []);

  const stopDecoding = useCallback(() => {
    reader.reset();
  }, [reader]);

  const startDecoding = useCallback(async () => {
    const el = ref.current;
    if (!el || paused) return;
    if (deviceId) {
      await reader.decodeFromVideoDevice(deviceId, el, decodeCallback);
      return;
    }
    await reader.decodeFromConstraints(constraints ?? DEFAULT_CONSTRAINTS, el, decodeCallback);
  }, [reader, deviceId, constraints, paused, decodeCallback]);

  useEffect(() => {
    resultHandlerRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    errorHandlerRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (deviceId) return;
    if (!deepEqConstraints(constraints, requestedConstraints)) {
      setConstraints(requestedConstraints);
    }
  }, [deviceId, constraints, requestedConstraints]);

  useEffect(() => {
    void startDecoding();
    return () => {
      stopDecoding();
    };
  }, [startDecoding, stopDecoding]);

  return { ref };
}
