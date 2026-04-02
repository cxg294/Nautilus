import imageseg, { SegmentCommonImageAdvanceRequest } from '@alicloud/imageseg20191230';
import * as $OpenApi from '@alicloud/openapi-client';
import { RuntimeOptions } from '@alicloud/tea-util';
import fs from 'fs';
import config from '../config/env.js';

/**
 * 初始化阿里云视觉智能客户端
 */
export function createClient() {
  const { accessKeyId, accessKeySecret, endpoint } = config.aliyun;
  
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('未配置阿里云 AccessKey，无法调用分割抠图服务。请检查 .env 文件。');
  }

  const openapiConfig = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret,
  });
  
  // 访问的域名
  openapiConfig.endpoint = endpoint || 'imageseg.cn-shanghai.aliyuncs.com';
  
  return new imageseg.default(openapiConfig);
}

/**
 * 通用分割抠图（去背景）
 * @param {string} localFilePath - 本地缓存的图片文件路径
 * @returns {Promise<string>} 返回去背景后的图像 URL
 */
export async function removeBackground(localFilePath) {
  const client = createClient();
  
  // 使用 Advance 接口以支持本地文件流形式上传
  const request = new SegmentCommonImageAdvanceRequest();
  request.imageURLObject = fs.createReadStream(localFilePath);
  
  const runtime = new RuntimeOptions({});

  try {
    const response = await client.segmentCommonImageAdvance(request, runtime);
    
    // 返回格式参考：
    // {
    //   body: {
    //     data: { imageURL: 'http://...' },
    //     requestId: '...'
    //   }
    // }
    if (response.body && response.body.data && response.body.data.imageURL) {
      return response.body.data.imageURL;
    }
    
    throw new Error('阿里云返回结果中没有找到 ImageURL');
  } catch (error) {
    console.error('【阿里云分割抠图失败】:', error.message || error);
    throw new Error(error.message || '抠图服务调用失败', { cause: error });
  }
}
