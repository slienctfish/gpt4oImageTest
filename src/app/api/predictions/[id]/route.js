import { NextResponse } from "next/server";
import openAI from "openai";
import { getTask, updateTask, deleteTask } from "../../storage";

const openai = new openAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.laozhang.ai/v1"
});

export async function GET(request, { params }) {
    const id = params.id;
    console.log('请求任务状态:', id);
    
    // 从MongoDB获取任务
    const task = await getTask(id);
    
    // 检查任务是否存在
    if (!task) {
        return NextResponse.json({ error: "没有找到该任务" }, { status: 404 });
    }
    
    // 如果任务已完成或失败，可以设置定时清理
    if (task.status === "completed" || task.status === "failed") {
        // 考虑在一定时间后清除任务，避免文件过多
        setTimeout(() => {
            deleteTask(id);
            console.log('清理完成的任务:', id);
        }, 60 * 2 * 1000); // 2分钟后清理
    }
    
    return NextResponse.json(task);
}

// 更新任务状态的函数现在使用文件存储
export async function updateGenerationTask(id, status, data = {}) {
    console.log('更新任务状态:', id, status);
    
    // 使用文件存储更新任务
    const updatedTask = await updateTask(id, status, data);
    console.log('更新后的任务:', updatedTask);
    
    return updatedTask;
}

// 获取任务状态的函数
export async function getGenerationTask(id) {
    return await getTask(id);
} 