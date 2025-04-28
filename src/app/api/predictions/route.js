import { NextResponse } from "next/server";
import openAI from "openai";
import { updateGenerationTask } from "./[id]/route";
import { createTask } from "../storage";

const openai = new openAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.laozhang.ai/v1"
});

// In production and preview deployments (on Vercel), the VERcEL URL environment variableis set.
//In development (on your local machine),the NGRoK HoST environment variable is set.
const WEBHOOK_HOST = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NGROK_HOST;

export async function POST(request) {
    // 检查是否设置了 OPENAI_API_KEY 环境变量
    if(!process.env.OPENAI_API_KEY){
        throw new Error(
            'The OPENAI_API_TOKEN environment variable is not set. See README.md forinstructions on how to set it.'
        );
    }
    // 获取请求数据
    const requestData = await request.json();
    const { prompt, image, imageType } = requestData;
    
    // 使用用户提供的prompt，如果为空则使用默认值
    const userPrompt = prompt?.trim() || "Studio Ghibli style husky";
    
    // 创建新任务并获取任务ID
    const taskId = createTask({ prompt: userPrompt });
    console.log('创建新任务:', taskId);
    
    // 启动后台处理（不等待完成）
    processImageGeneration(taskId, userPrompt, image, imageType).catch(error => {
        console.error("背景处理出错:", error);
        updateGenerationTask(taskId, "failed", { error: error.message });
    });
    
    // 立即返回任务ID
    return NextResponse.json({
        id: taskId,
        status: "pending",
        message: "图像生成任务已启动"
    }, { status: 202 });
}

// 后台处理函数
async function processImageGeneration(taskId, userPrompt, image, imageType) {
    try {
        let messages = [];
        
        // 如果有图片，将图片添加到消息中
        if (image) {
            console.log("包含图片处理请求");
            
            // 创建包含图片的消息
            const imageContent = {
                type: "image_url",
                image_url: {
                    url: `data:${imageType};base64,${image}`
                }
            };
            
            // 添加带有图片和文本的用户消息
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: userPrompt },
                    imageContent
                ]
            });
        } else {
            // 如果没有图片，只添加文本消息
            messages.push({ role: "user", content: userPrompt });
        }
        
        // 更新任务状态为处理中
        updateGenerationTask(taskId, "processing");
        
        // 调用 OpenAI API
        const stream = await openai.chat.completions.create({
            model: "sora-image",
            stream: true,
            messages: messages
        });

        console.log("开始流式生成");
        
        // 用于收集完整响应的变量
        let fullContent = "";
        let image_url = null;
        
        // 处理流式响应
        for await (const chunk of stream) {
            try {
                // 安全地打印和处理 delta.content
                if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                    console.log(chunk.choices[0].delta.content);
                    console.log('----');
                    fullContent += chunk.choices[0].delta.content;
                }
                
                if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content && !chunk.choices[0].finish_reason) {
                    image_url = chunk.choices[0].delta.content;
                    
                    // 更新任务状态，包含部分结果
                    updateGenerationTask(taskId, "processing", { 
                        partial_content: fullContent,
                        partial_image_url: extractImageUrl(image_url)
                    });
                }
                
                // 检查是否是最后一个块
                if (chunk.choices && chunk.choices[0] && chunk.choices[0].finish_reason) {
                    console.log("生成完成，原因:", chunk.choices[0].finish_reason);
                    
                    // 任务完成，更新最终状态
                    updateGenerationTask(taskId, "completed", {
                        content: fullContent,
                        image_url: extractImageUrl(fullContent || image_url),
                        finish_reason: chunk.choices[0].finish_reason
                    });
                }
            } catch (err) {
                console.error("处理数据块时出错:", err);
                // 更新错误信息但不中断处理
                updateGenerationTask(taskId, "processing", { 
                    error_message: err.message 
                });
            }
        }
        
        console.log("流式生成完成");
        console.log("完整内容:", fullContent);
        
        // 如果还没有标记为完成（可能是由于某些错误），标记为完成
        const currentTask = updateGenerationTask(taskId, "completed", {
            content: fullContent,
            image_url: extractImageUrl(fullContent || image_url)
        });
        
        return currentTask;
    } catch (error) {
        console.error("处理请求时出错:", error);
        updateGenerationTask(taskId, "failed", { error: error.message });
        throw error;
    }
}

// 提取图片URL的辅助函数
function extractImageUrl(content) {
    if (!content) return null;
    
    // 尝试多种可能的图片链接格式
    const patterns = [
        // 标准格式
        /!\[(图片|image)\]\((https:\/\/[^)]+)\)/,
        // 仅匹配URL格式
        /(https:\/\/tokensceshi\.oss[^)\s]+)/
    ];
    
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            // 根据匹配到的正则返回正确的捕获组
            return pattern.toString().includes('tokensceshi') ? match[1] : match[2];
        }
    }
    
    return null;
}
