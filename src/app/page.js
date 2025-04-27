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
  const [countdown, setCountdown] = useState(60);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const fileInputRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (isLoading) {
      setCountdown(70);
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

      let prediction = await response.json();
      if(response.status !== 201){
        setError(prediction.error);
        return;
      }
      setPrediction(prediction);
      
      // 提取图片URL
      if (prediction.choices && prediction.choices[0] && prediction.choices[0].message) {
        debugger
        const content = prediction.choices[0].message.content;
        const url = extractImageUrl(content);
        if (url) {
          setImageUrl(url);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
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
      {isLoading && (
        <div className="loading-overlay">
          <div className="text-center">
            <div className="loading-spinner"></div>
            <div className="loading-text">
              生成图片大约需要1分钟，请继续等待 {countdown}s
            </div>
          </div>
        </div>
      )}
      
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
    </div>                
  );
} 