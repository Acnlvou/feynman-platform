const { createHash } = require('node:crypto');
let cachedToken = null;
let tokenFlight = null;
const fail = (message, status = 502) =>
  Object.assign(new Error(message), { status });
function credentials() {
  const key = process.env.BAIDU_API_KEY?.trim();
  const secret = process.env.BAIDU_SECRET_KEY?.trim();
  if (!key || !secret)
    throw fail('语音识别尚未配置，请在后端填写百度 API Key 和 Secret Key', 503);
  return {
    key,
    secret,
    fingerprint: createHash('sha256')
      .update(JSON.stringify([key, secret]))
      .digest('hex'),
  };
}
async function getToken(config) {
  if (
    cachedToken?.fingerprint === config.fingerprint &&
    cachedToken.expires > Date.now()
  )
    return cachedToken.value;
  if (tokenFlight?.fingerprint === config.fingerprint)
    return tokenFlight.promise;
  const flight = { fingerprint: config.fingerprint };
  flight.promise = (async () => {
    try {
      const response = await fetch('https://aip.baidubce.com/oauth/2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.key,
          client_secret: config.secret,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (
        !response.ok ||
        typeof data.access_token !== 'string' ||
        !(Number(data.expires_in) > 60)
      )
        throw fail('百度语音认证失败，请检查凭据及语音识别服务权限', 503);
      cachedToken = {
        fingerprint: config.fingerprint,
        value: data.access_token,
        expires: Date.now() + (Number(data.expires_in) - 60) * 1000,
      };
      return cachedToken.value;
    } catch (error) {
      if (error.status) throw error;
      throw fail('百度语音认证暂不可用，请稍后重试', 503);
    } finally {
      if (tokenFlight === flight) tokenFlight = null;
    }
  })();
  tokenFlight = flight;
  return flight.promise;
}
function readWav(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw fail('请上传实际的PCM WAV录音文件', 400);
  if (buffer.readUInt32LE(4) + 8 !== buffer.length)
    throw fail('WAV文件长度不正确', 400);
  let format, audio;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const kind = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8,
      end = start + size;
    if (end > buffer.length) throw fail('WAV数据不完整', 400);
    if (kind === 'fmt ') {
      if (format || size < 16) throw fail('WAV格式块不正确', 400);
      format = {
        codec: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        rate: buffer.readUInt32LE(start + 4),
        byteRate: buffer.readUInt32LE(start + 8),
        align: buffer.readUInt16LE(start + 12),
        bits: buffer.readUInt16LE(start + 14),
      };
    }
    if (kind === 'data') {
      if (audio) throw fail('WAV包含重复音频块', 400);
      audio = buffer.subarray(start, end);
    }
    offset = end + (size % 2);
  }
  if (
    offset !== buffer.length ||
    !format ||
    !audio?.length ||
    audio.length % 2 ||
    format.codec !== 1 ||
    format.channels !== 1 ||
    format.rate !== 16000 ||
    format.bits !== 16 ||
    format.align !== 2 ||
    format.byteRate !== 32000
  )
    throw fail('录音须为16kHz、单声道、16位PCM WAV', 400);
  const duration = audio.length / 32000;
  if (duration <= 0 || duration > 60)
    throw fail('录音须大于0且不超过60秒', 400);
  return { audio, duration };
}
async function transcribe(buffer, userId, signal) {
  const { audio, duration } = readWav(buffer);
  const config = credentials();
  const token = await getToken(config);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 30000);
  try {
    const response = await fetch('https://vop.baidu.com/server_api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        format: 'pcm',
        rate: 16000,
        channel: 1,
        token,
        dev_pid: 1537,
        cuid: createHash('sha256')
          .update(String(userId))
          .digest('hex')
          .slice(0, 32),
        len: audio.length,
        speech: audio.toString('base64'),
      }),
    });
    const result = await response.json();
    if (result.err_no === 110 || result.err_no === 111) {
      if (cachedToken?.value === token) cachedToken = null;
      throw fail('百度语音认证已失效，请重试；持续失败请检查服务权限', 503);
    }
    if (!response.ok) throw fail('百度语音服务暂不可用，请稍后重试');
    if (result.err_no === 3302)
      throw fail('百度语音权限不足，请确认已开通短语音识别标准版', 503);
    if ([3304, 3305].includes(result.err_no))
      throw fail('百度语音额度或频率受限，请检查服务用量', 503);
    if (result.err_no === 3301)
      throw fail('未识别到清晰语音，请检查录音后重试', 422);
    if (result.err_no !== 0 || !Array.isArray(result.result))
      throw fail('语音识别未成功，请稍后重试');
    const text = result.result
      .filter((item) => typeof item === 'string')
      .join('')
      .trim();
    if (!text) throw fail('未识别到文字，请检查录音后重试', 422);
    if (text.length > 5000) throw fail('识别结果超过5000字符，请缩短录音', 422);
    return { text, duration };
  } catch (error) {
    if (error.status) throw error;
    if (controller.signal.aborted)
      throw fail('语音识别已取消或超时，录音已保留，可手动重试', 504);
    throw fail('无法连接百度语音服务，请稍后重试');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
module.exports = { transcribe };
