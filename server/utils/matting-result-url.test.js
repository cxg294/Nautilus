import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMattingResultUrl } from './matting-result-url.js';

test('HTTP 抠图结果升级 HTTPS 且不改变 OSS 签名', () => {
  const suffix = '//result.oss-cn-shanghai.aliyuncs.com/image.png?Expires=123&Signature=a%2Bb%2Fc%3D';
  assert.equal(normalizeMattingResultUrl(`http:${suffix}`), `https:${suffix}`);
  assert.equal(normalizeMattingResultUrl(`https:${suffix}`), `https:${suffix}`);
});

test('升级协议不会放行内网、外部域名、伪造后缀或非法输入', () => {
  for (const url of [
    'http://127.0.0.1/image.png',
    'http://localhost/image.png',
    'http://example.com/image.png',
    'https://oss.aliyuncs.com.example.com/image.png',
    'https://oss.aliyuncs.com@127.0.0.1/image.png',
    'ftp://result.aliyuncs.com/image.png',
    'file:///etc/passwd',
    '/image.png',
    ['https://result.aliyuncs.com/image.png'],
    undefined
  ]) {
    assert.throws(() => normalizeMattingResultUrl(url), { statusCode: 403 });
  }
});
