/**
 * Digital Human Video API Module
 * 数字人视频生成API接口模块
 */

import type { ApiResponse } from '~/types/global'

interface TTSRequest {
  text: string
  voice: string
  language_type: string
}

interface FaceDetectRequest {
  image_url: string
}

interface VideoGenerateRequest {
  image_url: string
  audio_url: string
  parameters: {
    template_id: string
    eye_move_freq: number
    video_fps: number
    mouth_move_strength: number
    paste_back: boolean
    head_move_strength: number
  }
}

interface VoiceEnrollmentRequest {
  action: 'create_voice' | 'list_voice' | 'query_voice'
  target_model?: string
  prefix?: string
  url?: string
  language_hints?: string[]
  voice_id?: string
  page_index?: number
  page_size?: number
}

const digitalHumanAPI = {
  /**
   * 生成TTS语音
   */
  async generateTTS(params: TTSRequest): Promise<ApiResponse<any>> {
    try {
      const response = await $fetch('/api/digital-human/tts', {
        method: 'POST',
        body: params
      })
      return response as ApiResponse<any>
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'TTS generation failed'
      }
    }
  },

  /**
   * 人脸检测
   */
  async detectFace(params: FaceDetectRequest): Promise<ApiResponse<any>> {
    try {
      const response = await $fetch('/api/digital-human/face-detect', {
        method: 'POST',
        body: params
      })
      return response as ApiResponse<any>
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Face detection failed'
      }
    }
  },

  /**
   * 生成数字人视频
   */
  async generateVideo(params: VideoGenerateRequest): Promise<ApiResponse<any>> {
    try {
      const response = await $fetch('/api/digital-human/generate-video', {
        method: 'POST',
        body: params
      })
      return response as ApiResponse<any>
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Video generation failed'
      }
    }
  },

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<ApiResponse<any>> {
    try {
      const response = await $fetch('/api/digital-human/task-status', {
        method: 'GET',
        query: { taskId }
      })
      return response as ApiResponse<any>
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get task status'
      }
    }
  },

  /**
   * 音色注册 - 创建音色
   */
  async voiceEnrollment(params: VoiceEnrollmentRequest): Promise<ApiResponse<any>> {
    try {
      const response = await $fetch('/api/digital-human/voice-enrollment', {
        method: 'POST',
        body: params
      })
      return response as ApiResponse<any>
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Voice enrollment failed'
      }
    }
  },

  /**
   * 查询音色列表
   */
  async listVoices(prefix?: string, pageIndex: number = 0, pageSize: number = 10): Promise<ApiResponse<any>> {
    try {
      const response = await $fetch('/api/digital-human/voice-enrollment', {
        method: 'POST',
        body: {
          action: 'list_voice',
          prefix,
          page_index: pageIndex,
          page_size: pageSize
        }
      })
      return response as ApiResponse<any>
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to list voices'
      }
    }
  },

  /**
   * 查询指定音色
   */
  async queryVoice(voiceId: string): Promise<ApiResponse<any>> {
    try {
      const response = await $fetch('/api/digital-human/voice-enrollment', {
        method: 'POST',
        body: {
          action: 'query_voice',
          voice_id: voiceId
        }
      })
      return response as ApiResponse<any>
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to query voice'
      }
    }
  }
}

export default digitalHumanAPI
