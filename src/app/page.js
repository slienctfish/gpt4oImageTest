'use client';

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Home() {
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [baseImage, setBaseImage] = useState(null);
  const [baseImagePreview, setBaseImagePreview] = useState(null);
  const [countdown, setCountdown] = useState(300);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const countdownRef = useRef(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    if (isLoading) {
      setCountdown(90);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isLoading]);

  // 添加轮询效果
  useEffect(() => {
    if (taskId && pollingActive) {
      // 设置轮询间隔
      pollingRef.current = setInterval(async () => {
        try {
          // 检查任务状态
          const response = await fetch(`/api/predictions/${taskId}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              setError('任务不存在或已过期');
              stopPolling();
              return;
            }
            throw new Error(`API错误 ${response.status}`);
          }
          
          const result = await response.json();
          
          // 更新进度
          if (result.status === "processing") {
            // 模拟进度
            setProgress(prev => Math.min(prev + 5, 95));
          }
          
          // 检查是否完成
          if (result.status === "completed") {
            setProgress(100);
            setImageUrl(result.image_url);
            setIsLoading(false);
            stopPolling();
          } 
          // 检查是否失败
          else if (result.status === "failed") {
            setError(result.error || '图像生成失败');
            setIsLoading(false);
            stopPolling();
          }
        } catch (err) {
          console.error("轮询出错:", err);
          // 不停止轮询，继续尝试
        }
      }, 5000); // 每5秒检查一次
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [taskId, pollingActive]);
  
  const stopPolling = () => {
    setPollingActive(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const extractImageUrl = (content) => {
    const regex = /!\[图片\]\((https:\/\/[^)]+)\)/;
    const match = content.match(regex);
    return match ? match[1] : null;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }
    setError(null);
    // 检查文件大小（10MB = 10 * 1024 * 1024 bytes）
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过10MB');
      return;
    }

    // 直接创建预览
    const reader = new FileReader();
    reader.onload = (event) => {
      setBaseImagePreview(event.target.result);
      setBaseImage(file);
    };
    reader.readAsDataURL(file);
  };

  const clearBaseImage = () => {
    setBaseImage(null);
    setBaseImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    setTaskId(null);
    setProgress(0);
    
    try {
      const promptText = e.target.prompt.value;
      
      const requestBody = { prompt: promptText };
      
      // 如果有基础图片，添加到请求中
      if (baseImage) {
        const base64Image = await convertToBase64(baseImage);
        requestBody.image = base64Image;
        requestBody.imageType = baseImage.type;
      }
      
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API错误 ${response.status}`);
      }
      
      const result = await response.json();
      
      // 检查是否有任务ID
      if (result.id) {
        setTaskId(result.id);
        // 启动轮询
        setPollingActive(true);
      } else {
        throw new Error('服务器未返回任务ID');
      }
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === 'flzbydfcq') {
      setIsAuthenticated(true);
    } else {
      setError('密码错误');
    }
  };

  // 渲染加载状态
  const renderLoadingState = () => {
    return (
      <div className="loading-overlay">
        <div className="text-center">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            生成图片大约需要5分钟，请继续等待 {countdown}s
          </div>
          
          {/* 进度条 */}
          <div className="progress-bar-container">
            <div 
              className="progress-bar" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">
            {progress < 10 ? '准备中...' : 
             progress < 40 ? '正在分析请求...' : 
             progress < 70 ? '生成图像中...' : 
             progress < 95 ? '即将完成...' : 
             '处理完成!'}
          </div>
          
          {taskId && (
            <div className="task-id">
              任务ID: {taskId.substring(0, 8)}...
            </div>
          )}
        </div>
      </div>
    );
  };

  // ... add these styles to your CSS or add them inline
  const styles = `
    .progress-bar-container {
      width: 80%;
      margin: 20px auto;
      height: 10px;
      background-color: #f0f0f0;
      border-radius: 5px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      background-color: #4CAF50;
      transition: width 0.3s ease;
    }
    
    .progress-text {
      margin-top: 10px;
      font-size: 14px;
      color: #555;
    }
    
    .task-id {
      margin-top: 10px;
      font-size: 12px;
      color: #777;
    }
  `;

  if (!isAuthenticated) {
return (
      <div className="container">
        <div className="auth-container">
          <form onSubmit={handlePasswordSubmit} className="auth-form">
            <h2 className="text-2xl font-bold mb-4">请输入访问密码</h2>
      <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              placeholder="请输入密码"
      />
            <button type="submit" className="auth-button">
              验证
      </button>
            {error && <div className="error-message">{error}</div>}
          </form>
        </div>
    </div>
    );
  }

  return (   
    <div className="container">
      <style jsx>{styles}</style>
      
      {isLoading && renderLoadingState()}
      
      <div className="left-panel">
        <form onSubmit={handleSubmit}>
          <button 
            className="submit-button w-full mt-4"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? '处理中...' : '生成图片'}
          </button>
          <textarea
            className="prompt-editor"
            name="prompt"
            placeholder="输入提示词生成或修改图片"
            rows={5}
          />
          
          <div className="file-upload">
      <input 
        type="file" 
        accept="image/*"
        onChange={handleImageUpload}
        ref={fileInputRef}
              className="hidden"
            />
            <div className="text-center" onClick={(e) => {
              // 如果点击的是清除按钮或其子元素，不触发文件选择
              if (e.target.closest('.clear-image-button')) {
                return;
              }
              fileInputRef.current?.click();
            }}>
              {baseImagePreview ? (
                <div>
              <img 
                src={baseImagePreview} 
                alt="上传的图片" 
                    className="uploaded-preview-image mb-2"
                  />
                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      clearBaseImage();
                    }}
                    className="clear-image-button"
                  >
                    清除图片
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500">点击或拖放图片到此处</p>
                  <p className="text-sm text-gray-400 mt-1">图片将自动调整为 512x768</p>
                </div>
              )}
            </div>
    </div>
  </form>

        {error && <div className="error-message">{error}</div>}
      </div>
      
      <div className="right-panel">
        {imageUrl && (
          <div className="w-full">
            <div className="relative">
            <a 
                href={imageUrl}
                download
                className="download-button"
                target="_blank"
                rel="noopener noreferrer"
              >
                下载图片
              </a>
          <Image               
            src={imageUrl}
            alt="Generated image"               
                className="generated-preview-image"
            width={512}
                height={768}
            style={{ objectFit: 'contain' }}
            priority
          />  
        </div>
      </div>         
        )}
      </div>
      
      {/* 可以添加重试按钮 */}
      {error && taskId && (
        <button 
          onClick={() => {
            setPollingActive(true);
            setError(null);
          }}
          className="retry-button"
        >
          重试获取结果
        </button>
  )}   
</div>                
  );
} 