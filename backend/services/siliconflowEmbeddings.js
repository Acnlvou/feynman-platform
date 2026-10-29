const ENDPOINT = 'https://api.siliconflow.cn/v1/embeddings';
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_BATCH_SIZE = 8;

function providerError(message, code, status = 503, requestId = null) {
  return Object.assign(new Error(message), {
    name: 'SiliconFlowEmbeddingError',
    code,
    status,
    requestId,
  });
}

function getConfig() {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim();
  const model = process.env.SILICONFLOW_EMBEDDING_MODEL?.trim();
  if (!apiKey || !model) {
    throw providerError(
      '未配置硅基流动 Embedding 服务',
      'SILICONFLOW_EMBEDDING_NOT_CONFIGURED',
    );
  }
  return { apiKey, model };
}

function currentModel() {
  return process.env.SILICONFLOW_EMBEDDING_MODEL?.trim() || null;
}

async function readBodyLimited(response) {
  const reader = response.body?.getReader();
  if (!reader) throw providerError('硅基流动响应为空', 'SILICONFLOW_EMPTY_RESPONSE');

  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw providerError('硅基流动响应过大', 'SILICONFLOW_RESPONSE_TOO_LARGE');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function safeProviderCode(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const code = String(value);
  return /^[A-Za-z0-9_.-]{1,80}$/.test(code) ? code : null;
}

async function embedBatch(texts) {
  const { apiKey, model } = getConfig();
  if (
    !Array.isArray(texts) ||
    !texts.length ||
    texts.length > MAX_BATCH_SIZE ||
    texts.some(
      (text) =>
        typeof text !== 'string' || !text.trim() || Array.from(text).length > 500,
    )
  ) {
    throw providerError('Embedding 输入不符合要求', 'SILICONFLOW_INVALID_INPUT', 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: texts }),
    });
    const requestId =
      response.headers.get('x-siliconcloud-trace-id') ||
      response.headers.get('x-request-id') ||
      null;
    const raw = await readBodyLimited(response);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw providerError('硅基流动响应格式错误', 'SILICONFLOW_INVALID_RESPONSE', 503, requestId);
    }

    if (!response.ok || payload?.error || payload?.error_code) {
      const code =
        safeProviderCode(payload?.error?.code) ||
        safeProviderCode(payload?.error_code) ||
        safeProviderCode(payload?.code) ||
        'SILICONFLOW_HTTP_' + response.status;
      throw providerError('硅基流动 Embedding 请求失败', code, 503, requestId);
    }

    if (!Array.isArray(payload?.data) || payload.data.length !== texts.length) {
      throw providerError('硅基流动向量数量与输入不匹配', 'SILICONFLOW_INVALID_RESPONSE', 503, requestId);
    }

    const ordered = new Array(texts.length);
    for (let position = 0; position < payload.data.length; position += 1) {
      const row = payload.data[position];
      const index = Number.isInteger(row?.index) ? row.index : position;
      if (
        index < 0 ||
        index >= texts.length ||
        ordered[index] ||
        !Array.isArray(row?.embedding) ||
        !row.embedding.length ||
        row.embedding.some((value) => typeof value !== 'number' || !Number.isFinite(value))
      ) {
        throw providerError('硅基流动返回的向量无效', 'SILICONFLOW_INVALID_VECTOR', 503, requestId);
      }
      ordered[index] = row.embedding;
    }

    const dimension = ordered[0]?.length;
    if (
      !dimension ||
      ordered.some((vector) => !vector || vector.length !== dimension)
    ) {
      throw providerError('硅基流动返回的向量维度不一致', 'SILICONFLOW_INVALID_DIMENSION', 503, requestId);
    }
    return ordered;
  } catch (error) {
    if (error?.name === 'SiliconFlowEmbeddingError') throw error;
    if (controller.signal.aborted) {
      throw providerError('硅基流动 Embedding 请求超时', 'SILICONFLOW_TIMEOUT', 504);
    }
    throw providerError('无法连接硅基流动 Embedding 服务', 'SILICONFLOW_NETWORK_ERROR', 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function embedTexts(texts) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const vectors = [];
  const batchSize = MAX_BATCH_SIZE;
  for (let start = 0; start < texts.length; start += batchSize) {
    vectors.push(...(await embedBatch(texts.slice(start, start + batchSize))));
  }
  return vectors;
}

module.exports = { currentModel, embedTexts };
