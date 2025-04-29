import { MongoClient } from 'mongodb';

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'image_generation';
const COLLECTION_NAME = 'tasks';

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

let client = null;
let collection = null;

// 初始化MongoDB连接
async function initMongoDB() {
  if (!client) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        if (!MONGODB_URI) {
          throw new Error('MONGODB_URI 环境变量未设置');
        }

        client = new MongoClient(MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
        });
        
        await client.connect();
        const db = client.db(DB_NAME);
        collection = db.collection(COLLECTION_NAME);
        
        // 创建索引
        await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 }); // 1小时后自动删除
        await collection.createIndex({ id: 1 }, { unique: true });
        
        console.log('MongoDB连接成功');
        return collection;
      } catch (error) {
        retries++;
        console.error(`MongoDB连接失败 (尝试 ${retries}/${MAX_RETRIES}):`, error);
        
        if (retries === MAX_RETRIES) {
          throw new Error(`MongoDB连接失败，已重试${MAX_RETRIES}次: ${error.message}`);
        }
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  return collection;
}

// 确保MongoDB连接
async function ensureConnection() {
  try {
    if (!collection) {
      await initMongoDB();
    }
    
    // 验证连接是否仍然有效
    if (client) {
      try {
        await client.db().command({ ping: 1 });
        return collection;
      } catch (error) {
        console.error('MongoDB连接验证失败:', error);
        // 重置连接
        client = null;
        collection = null;
      }
    }
    
    // 重新尝试连接
    return await initMongoDB();
  } catch (error) {
    console.error('确保MongoDB连接失败:', error);
    throw error;
  }
}

// 创建新任务并返回ID
export async function createTask(initialData = {}) {
  try {
    const collection = await ensureConnection();
    if (!collection) {
      throw new Error('无法获取MongoDB集合');
    }
    
    const id = crypto.randomUUID();
    const task = {
      id,
      status: "pending",
      createdAt: new Date(),
      ...initialData
    };
    
    await collection.insertOne(task);
    return id;
  } catch (error) {
    console.error('创建任务失败:', error);
    throw error;
  }
}

// 从数据库读取任务
export async function getTask(id) {
  try {
    const collection = await ensureConnection();
    if (!collection) {
      throw new Error('无法获取MongoDB集合');
    }
    
    console.log('读取任务:', id);
    const task = await collection.findOne({ id });
    console.log('读取任务结果:', task);
    return task;
  } catch (error) {
    console.error('读取任务失败:', error);
    return null;
  }
}

// 更新任务状态
export async function updateTask(id, status, data = {}) {
  try {
    const collection = await ensureConnection();
    if (!collection) {
      throw new Error('无法获取MongoDB集合');
    }
    
    const task = await getTask(id) || { 
      id,
      status: "pending",
      createdAt: new Date()
    };
    
    const updatedTask = {
      ...task,
      ...data,
      status,
      updatedAt: new Date()
    };
    
    await collection.updateOne(
      { id },
      { $set: updatedTask },
      { upsert: true }
    );
    
    return updatedTask;
  } catch (error) {
    console.error('更新任务失败:', error);
    return null;
  }
}

// 删除任务
export async function deleteTask(id) {
  try {
    const collection = await ensureConnection();
    if (!collection) {
      throw new Error('无法获取MongoDB集合');
    }
    
    const result = await collection.deleteOne({ id });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('删除任务失败:', error);
    return false;
  }
}

// 清理过期任务
export async function cleanupTasks(maxAgeMs = 60 * 60 * 1000) {
  try {
    const collection = await ensureConnection();
    if (!collection) {
      throw new Error('无法获取MongoDB集合');
    }
    
    const cutoffDate = new Date(Date.now() - maxAgeMs);
    const result = await collection.deleteMany({
      updatedAt: { $lt: cutoffDate }
    });
    console.log(`清理了 ${result.deletedCount} 个过期任务`);
    return true;
  } catch (error) {
    console.error('清理任务失败:', error);
    return false;
  }
}

// 获取所有任务
export async function getAllTasks() {
  try {
    const collection = await ensureConnection();
    if (!collection) {
      throw new Error('无法获取MongoDB集合');
    }
    
    return await collection.find({}).toArray();
  } catch (error) {
    console.error('获取所有任务失败:', error);
    return [];
  }
}

// 获取特定状态的任务
export async function getTasksByStatus(status) {
  try {
    const collection = await ensureConnection();
    if (!collection) {
      throw new Error('无法获取MongoDB集合');
    }
    
    return await collection.find({ status }).toArray();
  } catch (error) {
    console.error('获取任务失败:', error);
    return [];
  }
}

// 关闭MongoDB连接
export async function closeConnection() {
  if (client) {
    try {
      await client.close();
    } catch (error) {
      console.error('关闭MongoDB连接失败:', error);
    } finally {
      client = null;
      collection = null;
    }
  }
} 