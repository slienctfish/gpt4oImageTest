'use client';

import { useState, useRef } from "react";
import Image from "next/image";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Home() {
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [extractedPrompt, setExtractedPrompt] = useState(null);
  const [baseImage, setBaseImage] = useState(null);
  const [baseImagePreview, setBaseImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const extractImageUrl = (content) => {
    const regex = /!\[image\]\((https:\/\/[^)]+)\)/;
    const match = content.match(regex);
    return match ? match[1] : null;
  };

  const extractPrompt = (content) => {
    try {
      const jsonMatch = content.match(/\{.*"prompt":\s*"([^"]+)".*\}/s);
      if (jsonMatch && jsonMatch[1]) {
        return jsonMatch[1];
      }
      return null;
    } catch (err) {
      console.error('Error extracting prompt:', err);
      return null;
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }

    // 使用图片加载和调整大小
    const reader = new FileReader();
    reader.onload = (event) => {
      // 使用 window.Image 而不是 Image，避免与 Next.js 的 Image 组件冲突
      const imgElement = new window.Image();
      imgElement.onload = () => {
        // 创建 canvas 调整图片大小
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 768;
        const ctx = canvas.getContext('2d');
        
        // 计算缩放和裁剪参数以保持宽高比
        const imgRatio = imgElement.width / imgElement.height;
        const targetRatio = 512 / 768;
        
        let drawWidth, drawHeight, startX = 0, startY = 0;
        
        if (imgRatio > targetRatio) {
          // 图片较宽，以高度为基准进行缩放
          drawHeight = 768;
          drawWidth = imgElement.width * (768 / imgElement.height);
          startX = (drawWidth - 512) / 2; // 居中裁剪
        } else {
          // 图片较高，以宽度为基准进行缩放
          drawWidth = 512;
          drawHeight = imgElement.height * (512 / imgElement.width);
          startY = (drawHeight - 768) / 2; // 居中裁剪
        }
        
        // 清空画布并绘制调整大小和裁剪后的图片
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 512, 768);
        ctx.drawImage(imgElement, -startX, -startY, drawWidth, drawHeight);
        
        // 转换为 blob
        canvas.toBlob((blob) => {
          // 设置基础图片
          const resizedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: new Date().getTime()
          });
          setBaseImage(resizedFile);
          setBaseImagePreview(canvas.toDataURL(file.type));
          
          // 添加尺寸显示
          const imgDimensions = document.createElement('div');
          imgDimensions.innerHTML = `已调整为 512 x 768`;
          
        }, file.type);
      };
      
      imgElement.src = event.target.result;
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
    setExtractedPrompt(null);
    
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
      
      // 提取图片URL和prompt
      if (prediction.choices && prediction.choices[0] && prediction.choices[0].message) {
        const content = prediction.choices[0].message.content;
        const url = extractImageUrl(content);
        const prompt = extractPrompt(content);
        if (url) {
          setImageUrl(url);
        }
        if (prompt) {
          setExtractedPrompt(prompt);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
return (
<div className="container max-w-2xl mx-auto p-5">     
  {/* <h1 className="py-6 text-center font-bold text-2xl">       
    Dream something with{" "}
    <a href="https://replicate.com/black-forest-labs/flux-schnell?utm_source=project&utm_project=getting-started">         
    Flux Schnell       
    </a>     
  </h1> */}
  <form className="w-full" onSubmit={handleSubmit}>
    <div className="flex mb-8">
      <input 
        type="text" 
        className="flex-grow py-2 px-4 border rounded-l" 
        name="prompt" 
        placeholder="输入提示词生成或修改图片"
      />
      <button 
        className={`px-4 py-2 bg-blue-500 text-white rounded-r font-medium ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? 'Wait...' : 'Go'}
      </button>
    </div>
    
    <div className="flex mb-8">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-gray-700 font-medium">上传基础图片（可选，将自动调整为 512x768）</label>
        {baseImagePreview && (
          <button 
            type="button" 
            onClick={clearBaseImage}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            清除图片
          </button>
        )}
      </div>
      <input 
        type="file" 
        accept="image/*"
        onChange={handleImageUpload}
        className="w-full text-sm"
        ref={fileInputRef}
      />
      
      {baseImagePreview && (
        <div className="mt-3">
          <div className="text-center text-sm text-gray-500 mb-2">图片已调整为 512 x 768</div>
          <div className="flex justify-center">
            <div className="max-w-xs">
              <img 
                src={baseImagePreview} 
                alt="上传的图片" 
                className="max-w-full h-auto rounded-lg mx-auto"
                width="512"
                height="768"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  </form>

  {error && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}
  
  {prediction && (       
    <>
      {extractedPrompt && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">生成的 Prompt:</h3>
          <p className="text-gray-700">{extractedPrompt}</p>
        </div>
      )}
      <div className="image-wrapper mt-5 flex justify-center">             
        <div className="max-w-2xl">
          <Image               
            src={imageUrl}
            alt="Generated image"               
            className="max-w-full h-auto rounded-lg mx-auto"
            width={512}
            height={512}
            style={{ objectFit: 'contain' }}
            priority
          />  
        </div>
      </div>         
    </>     
  )}   
</div>                
  );
} 