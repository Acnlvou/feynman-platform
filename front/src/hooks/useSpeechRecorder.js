import { useEffect, useRef, useState } from 'react'
import { recordingSupport, toSpeechWav } from '../utils/recordingAudio'

const microphoneMessage = (error) => {
  if (error.name === 'NotAllowedError')
    return '麦克风权限未获允许，请在浏览器站点设置中允许后重试'
  if (error.name === 'NotFoundError') return '没有找到麦克风，请连接设备后重试'
  if (error.name === 'NotReadableError')
    return '麦克风无法使用，可能正被其他应用占用'
  return error.message || '录音失败，请检查麦克风后重试'
}
export default function useSpeechRecorder() {
  const [status, setStatus] = useState('idle')
  const [seconds, setSeconds] = useState(0)
  const [audio, setAudio] = useState(null)
  const [playback, setPlayback] = useState('')
  const [error, setError] = useState('')
  const refs = useRef({
    generation: 0,
    stream: null,
    recorder: null,
    context: null,
    timer: null,
    url: '',
    elapsed: 0,
    started: 0,
    pending: false,
  })
  const clearTimer = () => {
    clearInterval(refs.current.timer)
    refs.current.timer = null
  }
  const closeContext = () => {
    const context = refs.current.context
    refs.current.context = null
    if (context && context.state !== 'closed') context.close().catch(() => {})
  }
  const stopTracks = () => {
    refs.current.stream?.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
    refs.current.stream = null
  }
  const dispose = () => {
    const r = refs.current
    r.generation++
    r.pending = false
    clearTimer()
    if (r.recorder) {
      r.recorder.ondataavailable = r.recorder.onstop = r.recorder.onerror = null
      if (r.recorder.state !== 'inactive') r.recorder.stop()
      r.recorder = null
    }
    stopTracks()
    closeContext()
    if (r.url) URL.revokeObjectURL(r.url)
    r.url = ''
  }
  useEffect(() => () => dispose(), [])
  const publishPlayback = (blob) => {
    if (refs.current.url) URL.revokeObjectURL(refs.current.url)
    refs.current.url = URL.createObjectURL(blob)
    setPlayback(refs.current.url)
  }
  const elapsedNow = () =>
    refs.current.elapsed +
    (refs.current.started
      ? (performance.now() - refs.current.started) / 1000
      : 0)
  const stop = () => {
    const r = refs.current
    if (!r.recorder || r.recorder.state === 'inactive') return
    r.elapsed = elapsedNow()
    r.started = 0
    clearTimer()
    setSeconds(Math.min(59, r.elapsed))
    setStatus('processing')
    r.recorder.stop()
    stopTracks()
  }
  const startTimer = () => {
    clearTimer()
    refs.current.timer = setInterval(() => {
      const elapsed = elapsedNow()
      setSeconds(Math.min(59, elapsed))
      if (elapsed >= 59) stop()
    }, 100)
  }
  const start = async () => {
    if (
      refs.current.pending ||
      (refs.current.recorder && refs.current.recorder.state !== 'inactive')
    )
      return false
    const unsupported = recordingSupport()
    if (unsupported) {
      setError(unsupported)
      return false
    }
    dispose()
    setAudio(null)
    setPlayback('')
    setSeconds(0)
    setError('')
    setStatus('requesting')
    const r = refs.current,
      generation = r.generation
    r.pending = true
    const current = () => refs.current.generation === generation
    try {
      const Context = window.AudioContext || window.webkitAudioContext
      r.context = new Context()
      if (r.context.state === 'suspended') await r.context.resume()
      if (!current()) return false
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
        video: false,
      })
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }
      r.stream = stream
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/webm',
      ].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000,
      })
      r.recorder = recorder
      const chunks = []
      let bytes = 0,
        failed = false
      const fail = (message) => {
        if (!current()) return
        failed = true
        clearTimer()
        stopTracks()
        closeContext()
        if (recorder.state !== 'inactive') recorder.stop()
        setError(message)
        setStatus('idle')
      }
      recorder.ondataavailable = (event) => {
        if (!current() || failed || !event.data.size) return
        bytes += event.data.size
        if (bytes > 8 * 1024 * 1024) {
          fail('录音数据过大，请重新录制更短的内容')
          return
        }
        chunks.push(event.data)
      }
      recorder.onerror = () => fail('录音设备发生错误，请重新录制')
      recorder.onstop = async () => {
        if (!current() || failed) return
        clearTimer()
        stopTracks()
        setStatus('processing')
        try {
          const raw = new Blob(chunks, {
            type: recorder.mimeType || chunks[0]?.type,
          })
          if (!raw.size) throw new Error('没有录到声音，请重新录制')
          publishPlayback(raw)
          const converted = await toSpeechWav(raw, r.context)
          if (!current()) return
          publishPlayback(converted.blob)
          setAudio(converted)
          setSeconds(converted.duration)
          setStatus('ready')
        } catch (error) {
          if (current()) {
            setError(
              error.name === 'EncodingError'
                ? '浏览器无法解码本次录音。可先回放检查，再使用新版浏览器重新录制'
                : error.message || '录音转换失败，请重新录制',
            )
            setStatus('ready')
          }
        } finally {
          if (current()) closeContext()
        }
      }
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (current()) {
            setError('麦克风已断开，录音已停止')
            stop()
          }
        }
      })
      r.elapsed = 0
      r.started = performance.now()
      recorder.start(250)
      setStatus('recording')
      startTimer()
      return true
    } catch (error) {
      if (current()) {
        dispose()
        setStatus('idle')
        setError(microphoneMessage(error))
      }
      return false
    } finally {
      if (current()) r.pending = false
    }
  }
  const pause = () => {
    const r = refs.current
    if (r.recorder?.state !== 'recording') return
    r.recorder.pause()
    r.elapsed = elapsedNow()
    r.started = 0
    clearTimer()
    setSeconds(Math.min(59, r.elapsed))
    setStatus('paused')
  }
  const resume = () => {
    const r = refs.current
    if (r.recorder?.state !== 'paused') return
    r.recorder.resume()
    r.started = performance.now()
    setStatus('recording')
    startTimer()
  }
  const stopForSession = () => {
    // 麦克风授权弹窗尚未完成时也要作废请求，授权后立即释放迟到的音轨。
    if (refs.current.pending && !refs.current.recorder) {
      dispose()
      setStatus('idle')
      return
    }
    stop()
  }
  return {
    status,
    seconds,
    audio,
    playback,
    error,
    start,
    pause,
    resume,
    stop,
    stopForSession,
    unsupported: recordingSupport(),
  }
}
