import { MongoClient } from 'mongodb';

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'image_generation';
const COLLECTION_NAME = 'tasks';

let client = null;
let collection = null;

// 初始化MongoDB连接
async function initMongoDB() {
  if (!client) {
    try {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db(DB_NAME);
      collection = db.collection(COLLECTION_NAME);
      
      // 创建索引
      await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 }); // 1小时后自动删除
      await collection.createIndex({ id: 1 }, { unique: true });
      
      console.log('MongoDB连接成功');
    } catch (error) {
      console.error('MongoDB连接失败:', error);
      throw error;
    }
  }
  return collection;
}

// 确保MongoDB连接
async function ensureConnection() {
  if (!collection) {
    await initMongoDB();
  }
  return collection;
}

// 创建新任务并返回ID
export async function createTask(initialData = {}) {
  const collection = await ensureConnection();
  const id = crypto.randomUUID();
  const task = {
    id,
    status: "pending",
    createdAt: new Date(),
    ...initialData
  };
  
  try {
    await collection.insertOne(task);
    return id;
  } catch (error) {
    console.error('创建任务失败:', error);
    throw error;
  }
}

// 从数据库读取任务
export async function getTask(id) {
  const collection = await ensureConnection();
  try {
    console.log('读取任务:', id);
    let a = await collection.findOne({ id });
    console.log('读取任务结果:', a);
    return a;
  } catch (error) {
    console.error('读取任务失败:', error);
    return null;
  }
}

// 更新任务状态
export async function updateTask(id, status, data = {}) {
  const collection = await ensureConnection();
  try {
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
  const collection = await ensureConnection();
  try {
    const result = await collection.deleteOne({ id });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('删除任务失败:', error);
    return false;
  }
}

// 清理过期任务
export async function cleanupTasks(maxAgeMs = 60 * 60 * 1000) {
  const collection = await ensureConnection();
  try {
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
  const collection = await ensureConnection();
  try {
    return await collection.find({}).toArray();
  } catch (error) {
    console.error('获取所有任务失败:', error);
    return [];
  }
}

// 获取特定状态的任务
export async function getTasksByStatus(status) {
  const collection = await ensureConnection();
  try {
    return await collection.find({ status }).toArray();
  } catch (error) {
    console.error('获取任务失败:', error);
    return [];
  }
}

// 关闭MongoDB连接
export async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    collection = null;
  }
} 