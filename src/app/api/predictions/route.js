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
    const{ prompt } =await request.json();
    // 使用用户提供的prompt，如果为空则使用默认值
    const userPrompt = prompt?.trim() || "Studio Ghibli style husky";
    
    try {
        // const prediction = await replicate.predictions.create(options);
        const stream = await openai.chat.completions.create({
            model: "gpt-4o-image",
            stream: true,
            messages: [
                { role: "user", content: userPrompt },
            ]
        });

        console.log("开始流式生成");
        
        // 用于收集完整响应的变量
        let fullContent = "";
        let finishedResponse = null;
        
        // 处理流式响应
        for await (const chunk of stream) {
            console.log("收到新的块:", chunk);
            
            // 从块中提取内容
            if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                fullContent += chunk.choices[0].delta.content;
            }
            
            // 检查是否是最后一个块
            if (chunk.choices && chunk.choices[0] && chunk.choices[0].finish_reason) {
                console.log("生成完成，原因:", chunk.choices[0].finish_reason);

                console.log(chunk.choices[0].delta.content);
                
                // 构建最终响应对象
                finishedResponse = {
                    id: chunk.id,
                    model: chunk.model,
                    created: chunk.created,
                    choices: [{
                        message: {
                            role: "assistant",
                            content: chunk.choices[0].delta.content
                        },
                        finish_reason: chunk.choices[0].finish_reason,
                        index: 0
                    }]
                };
            }
        }
        
        console.log("流式生成完成");
        console.log("完整内容:", fullContent);
        
        // 返回完整响应
        if (finishedResponse) {
            return NextResponse.json(finishedResponse, {status:201});
        } else {
            return NextResponse.json({error: "生成未完成"}, {status:500});
        }
        
    } catch (error) {
        console.error("处理请求时出错:", error);
        return NextResponse.json({error: error.message}, {status:500});
    }
}
