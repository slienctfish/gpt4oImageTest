import{NextResponse }from"next/server";
import openAI from "openai";

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
    if(!process.env.OPENAI_API_KEY){
        throw new Error(
            'The OPENAI_API_TOKEN environment variable is not set. See README.md forinstructions on how to set it.'
        );
    }
    const requestData = await request.json();
    const { prompt, image, imageType } = requestData;
    
    // 使用用户提供的prompt，如果为空则使用默认值
    const userPrompt = prompt?.trim() || "Studio Ghibli style husky";
    
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
        
        // 调用 OpenAI API
        const stream = await openai.chat.completions.create({
            model: "sora-image",
            stream: true,
            messages: messages
        });

        console.log("开始流式生成");
        
        // 用于收集完整响应的变量
        let fullContent = "";
        let finishedResponse = null;
        let image_url = null;
        
        // 处理流式响应
        for await (const chunk of stream) {
            // console.log("收到新的块:", chunk);
            
            try {
                // 安全地打印和处理 delta.content
                if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                    console.log(chunk.choices[0].delta.content);
                    console.log('----')
                    fullContent += chunk.choices[0].delta.content;
                }
                if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content && !chunk.choices[0].finish_reason) {
                    image_url = chunk.choices[0].delta.content;
                }
                
                // 检查是否是最后一个块
                if (chunk.choices && chunk.choices[0] && chunk.choices[0].finish_reason) {
                    console.log("生成完成，原因:", chunk.choices[0].finish_reason);
                    
                    // 构建最终响应对象
                    finishedResponse = {
                        id: chunk.id,
                        model: chunk.model,
                        created: chunk.created,
                        choices: [{
                            message: {
                                role: "assistant",
                                content: image_url
                            },
                            finish_reason: chunk.choices[0].finish_reason,
                            index: 0
                        }]
                    };
                }
            } catch (err) {
                console.error("处理数据块时出错:", err, "数据块:", JSON.stringify(chunk));
            }
        }
        
        console.log("流式生成完成");
        console.log("完整内容:", fullContent);
        
        // 提取JSON指令（如果存在）
        let imageGenerationParams = null;
        try {
            // 尝试从完整内容中提取JSON（通常包含在```json 和 ``` 之间）
            const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                imageGenerationParams = JSON.parse(jsonMatch[1]);
                console.log("提取的图像生成参数:", imageGenerationParams);
            }
        } catch (err) {
            console.error("解析JSON指令时出错:", err);
        }
        
        // 返回完整响应，包括可能提取的图像生成参数
        if (finishedResponse) {
            return NextResponse.json({
                ...finishedResponse,
                imageGenerationParams: imageGenerationParams || null,
                status: "pending", // 表示图像尚未生成，需要前端或其他服务进一步处理
                message: "已收到图像生成指令，请继续处理"
            }, {status:201});
        } else {
            return NextResponse.json({error: "生成未完成"}, {status:500});
        }
        
    } catch (error) {
        console.error("处理请求时出错:", error);
        return NextResponse.json({error: error.message}, {status:500});
    }
}
