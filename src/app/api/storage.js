import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// 定义存储文件路径，使用临时目录
const storagePath = path.join(process.cwd(), 'temp_storage');

// 确保存储目录存在
try {
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
} catch (error) {
  console.error('创建存储目录失败:', error);
}

// 任务文件的基本路径
const getTaskFilePath = (id) => path.join(storagePath, `task_${id}.json`);

// 保存任务到文件
export const saveTask = (id, data) => {
  try {
    const filePath = getTaskFilePath(id);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('保存任务失败:', error);
    return false;
  }
};

// 从文件读取任务
export const getTask = (id) => {
  try {
    const filePath = getTaskFilePath(id);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取任务失败:', error);
    return null;
  }
};

// 更新任务状态
export const updateTask = (id, status, data = {}) => {
  try {
    const task = getTask(id) || { 
      id,
      status: "pending",
      createdAt: Date.now()
    };
    
    const updatedTask = {
      ...task,
      ...data,
      status,
      updatedAt: Date.now()
    };
    
    saveTask(id, updatedTask);
    return updatedTask;
  } catch (error) {
    console.error('更新任务失败:', error);
    return null;
  }
};

// 删除任务
export const deleteTask = (id) => {
  try {
    const filePath = getTaskFilePath(id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('删除任务失败:', error);
    return false;
  }
};

// 创建新任务并返回ID
export const createTask = (initialData = {}) => {
  const id = randomUUID();
  const task = {
    id,
    status: "pending",
    createdAt: Date.now(),
    ...initialData
  };
  
  saveTask(id, task);
  return id;
};

// 清理过期任务（可选）
export const cleanupTasks = (maxAgeMs = 60 * 60 * 1000) => {
  try {
    const files = fs.readdirSync(storagePath);
    const now = Date.now();
    
    files.forEach(file => {
      if (file.startsWith('task_')) {
        const filePath = path.join(storagePath, file);
        const stats = fs.statSync(filePath);
        
        // 如果文件超过指定时间未修改，则删除
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      }
    });
    
    return true;
  } catch (error) {
    console.error('清理任务失败:', error);
    return false;
  }
}; 