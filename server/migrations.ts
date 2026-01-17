/**
 * 数据库迁移脚本
 * 在应用启动时自动执行，确保数据库结构与代码同步
 */

import mysql from 'mysql2/promise';
import postgres from 'postgres';

export async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[Migrations] DATABASE_URL not set, skipping migrations');
    return;
  }

  console.log('[Migrations] Starting database migrations...');
  console.log('[Migrations] Database URL type:', dbUrl.startsWith('postgres') ? 'PostgreSQL' : 'MySQL');

  try {
    if (dbUrl.startsWith('postgres')) {
      await runPostgresMigrations(dbUrl);
    } else {
      await runMysqlMigrations(dbUrl);
    }
    
    console.log('[Migrations] ✅ All migrations completed successfully');
  } catch (error: any) {
    console.error('[Migrations] ❌ Migration failed:', error.message);
    console.error('[Migrations] Full error:', error);
    // 不抛出错误，让服务器继续启动
  }
}

async function runMysqlMigrations(dbUrl: string) {
  console.log('[Migrations] Connecting to MySQL...');
  const connection = await mysql.createConnection(dbUrl);
  console.log('[Migrations] Connected to MySQL successfully');
  
  try {
    // 检查users表是否存在
    console.log('[Migrations] Checking if users table exists...');
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'users'"
    ) as any;
    
    if (!tables || tables.length === 0) {
      console.log('[Migrations] Users table does not exist, skipping column migrations');
      return;
    }
    
    // 获取users表的所有列
    console.log('[Migrations] Getting users table columns...');
    const [columns] = await connection.execute(
      'SHOW COLUMNS FROM users'
    ) as any;
    
    const columnNames = columns.map((col: any) => col.Field);
    console.log('[Migrations] Current columns:', columnNames.join(', '));
    
    // 检查并添加username字段
    if (!columnNames.includes('username')) {
      console.log('[Migrations] Adding username column...');
      await connection.execute('ALTER TABLE users ADD COLUMN username VARCHAR(64)');
      console.log('[Migrations] ✓ Added username column');
    } else {
      console.log('[Migrations] ✓ username column already exists');
    }
    
    // 检查并添加password字段
    if (!columnNames.includes('password')) {
      console.log('[Migrations] Adding password column...');
      await connection.execute('ALTER TABLE users ADD COLUMN password VARCHAR(256)');
      console.log('[Migrations] ✓ Added password column');
    } else {
      console.log('[Migrations] ✓ password column already exists');
    }
    
    // 检查并添加brandName字段
    if (!columnNames.includes('brandName')) {
      console.log('[Migrations] Adding brandName column...');
      await connection.execute('ALTER TABLE users ADD COLUMN brandName VARCHAR(128)');
      console.log('[Migrations] ✓ Added brandName column');
    } else {
      console.log('[Migrations] ✓ brandName column already exists');
    }
    
    // 检查并添加username唯一索引
    console.log('[Migrations] Checking unique index on username...');
    const [indexes] = await connection.execute(
      "SHOW INDEX FROM users WHERE Key_name = 'unique_username'"
    ) as any;
    
    if (!indexes || indexes.length === 0) {
      try {
        console.log('[Migrations] Adding unique index on username...');
        await connection.execute('ALTER TABLE users ADD UNIQUE KEY unique_username (username)');
        console.log('[Migrations] ✓ Added unique index on username');
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log('[Migrations] ✓ Unique index already exists');
        } else {
          console.warn('[Migrations] Warning: Could not add unique index:', error.message);
        }
      }
    } else {
      console.log('[Migrations] ✓ unique_username index already exists');
    }
    
    console.log('[Migrations] MySQL migrations completed');
  } finally {
    await connection.end();
    console.log('[Migrations] MySQL connection closed');
  }
}

async function runPostgresMigrations(dbUrl: string) {
  console.log('[Migrations] Connecting to PostgreSQL...');
  const sql = postgres(dbUrl);
  console.log('[Migrations] Connected to PostgreSQL successfully');
  
  try {
    // 检查users表是否存在
    console.log('[Migrations] Checking if users table exists...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    
    if (tables.length === 0) {
      console.log('[Migrations] Users table does not exist, skipping column migrations');
      return;
    }
    
    // 获取users表的所有列
    console.log('[Migrations] Getting users table columns...');
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
    
    const columnNames = columns.map((col: any) => col.column_name);
    console.log('[Migrations] Current columns:', columnNames.join(', '));
    
    // 检查并添加username字段
    if (!columnNames.includes('username')) {
      console.log('[Migrations] Adding username column...');
      await sql`ALTER TABLE users ADD COLUMN username VARCHAR(64)`;
      console.log('[Migrations] ✓ Added username column');
    } else {
      console.log('[Migrations] ✓ username column already exists');
    }
    
    // 检查并添加password字段
    if (!columnNames.includes('password')) {
      console.log('[Migrations] Adding password column...');
      await sql`ALTER TABLE users ADD COLUMN password VARCHAR(256)`;
      console.log('[Migrations] ✓ Added password column');
    } else {
      console.log('[Migrations] ✓ password column already exists');
    }
    
    // 检查并添加brandName字段
    if (!columnNames.includes('brandName')) {
      console.log('[Migrations] Adding brandName column...');
      await sql`ALTER TABLE users ADD COLUMN "brandName" VARCHAR(128)`;
      console.log('[Migrations] ✓ Added brandName column');
    } else {
      console.log('[Migrations] ✓ brandName column already exists');
    }
    
    // 检查并添加username唯一索引
    console.log('[Migrations] Checking unique constraint on username...');
    const constraints = await sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' AND constraint_name = 'unique_username'
    `;
    
    if (constraints.length === 0) {
      try {
        console.log('[Migrations] Adding unique constraint on username...');
        await sql`ALTER TABLE users ADD CONSTRAINT unique_username UNIQUE (username)`;
        console.log('[Migrations] ✓ Added unique constraint on username');
      } catch (error: any) {
        if (error.code === '42P07') {
          console.log('[Migrations] ✓ Unique constraint already exists');
        } else {
          console.warn('[Migrations] Warning: Could not add unique constraint:', error.message);
        }
      }
    } else {
      console.log('[Migrations] ✓ unique_username constraint already exists');
    }
    
    console.log('[Migrations] PostgreSQL migrations completed');
  } finally {
    await sql.end();
    console.log('[Migrations] PostgreSQL connection closed');
  }
}
