// 将浏览器实际录音解码后转换，不依赖文件后缀推断编码。
export async function toSpeechWav(blob, context) {
  if (!blob.size) throw new Error('录音为空，请重新录制')
  const decoded = await context.decodeAudioData(await blob.arrayBuffer())
  if (
    !Number.isFinite(decoded.duration) ||
    decoded.duration <= 0 ||
    decoded.duration > 60
  )
    throw new Error('录音时长须大于0且不超过60秒，请重新录制')
  const OfflineContext =
    window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!OfflineContext)
    throw new Error(
      '当前浏览器不支持音频转换，请使用新版 Chrome、Edge 或 Safari',
    )
  const frames = Math.ceil(decoded.duration * 16000)
  const offline = new OfflineContext(1, frames, 16000)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  const samples = rendered.getChannelData(0)
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const ascii = (offset, value) =>
    [...value].forEach((letter, i) =>
      view.setUint8(offset + i, letter.charCodeAt(0)),
    )
  ascii(0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true)
  view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(
      44 + i * 2,
      Math.round(sample * (sample < 0 ? 32768 : 32767)),
      true,
    )
  }
  return {
    blob: new Blob([buffer], { type: 'audio/wav' }),
    duration: samples.length / 16000,
  }
}
export function recordingSupport() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  const OfflineContext =
    window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!window.isSecureContext) return '录音需要 HTTPS 或本机 localhost 地址'
  if (
    !navigator.mediaDevices?.getUserMedia ||
    !window.MediaRecorder ||
    !AudioContext ||
    !OfflineContext
  )
    return '当前浏览器不支持完整录音和音频转换，请使用新版 Chrome、Edge 或 Safari'
  return ''
}
