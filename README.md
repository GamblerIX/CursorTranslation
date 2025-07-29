# Cursor 中文补丁工具

[![Node.js](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://cursor.sh/)

> 为 Cursor 编辑器提供中文本地化的非官方补丁工具

## 📋 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [故障排除](#故障排除)
- [项目状态](#项目状态)
- [贡献指南](#贡献指南)
- [开源协议](#开源协议)

## ✨ 功能特性

- 🚀 **一键汉化** - 自动检测 Cursor 安装路径并应用汉化补丁
- 🔧 **智能诊断** - 内置诊断工具，自动检测和修复常见问题
- 🌐 **双语模式** - 支持直接翻译或中英对照显示
- 💾 **安全备份** - 自动备份原始文件，支持完整性验证
- 🔄 **轻松还原** - 一键还原到原始英文界面
- 🖥️ **跨平台** - 支持 Windows、macOS 和 Linux
- ⚡ **原子操作** - 确保文件写入安全性，避免损坏
- 🧪 **自动测试** - 内置测试框架，确保代码质量

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) v16 或更高版本

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/GamblerIX/CursorTranslation.git
   cd CursorTranslation
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **运行诊断**（推荐）
   ```bash
   npm run diagnose
   ```

4. **应用汉化**
   ```bash
   # 直接翻译模式
   npm run apply
   
   # 双语模式（中英对照）
   npm run apply:bilingual
   ```

## 📖 使用指南

### 汉化模式

#### 直接翻译模式
将界面英文完全替换为中文，适合中文用户使用。

#### 双语模式
保留英文原文，在下方显示中文翻译，适合学习对照。

### 自定义安装路径

如果工具无法自动找到 Cursor 安装位置，可手动指定：

```bash
# Windows 示例
npm run apply -- "C:\\Users\\用户名\\AppData\\Local\\Programs\\Cursor"

# macOS 示例  
npm run apply -- "/Applications/Cursor.app"

# Linux 示例
npm run apply -- "/usr/local/bin/cursor"
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run apply` | 应用直接翻译模式 |
| `npm run apply:bilingual` | 应用双语模式 |
| `npm run restore` | 还原英文界面 |
| `npm run diagnose` | 运行诊断检查 |
| `npm run diagnose:fix` | 自动修复问题 |
| `npm run diagnose:report` | 生成详细报告 |
| `npm test` | 运行测试 |

## 🔧 故障排除

### 常见问题

#### 1. Cursor 启动失败
**症状**: 汉化后 Cursor 提示文件损坏或无法启动

**解决方案**:
```bash
npm run diagnose:fix
# 如果问题持续，重新安装 Cursor
```

#### 2. 权限错误
**症状**: 脚本运行时提示权限不足

**解决方案**:
- **Windows**: 以管理员身份运行终端
- **macOS/Linux**: 使用 `sudo` 运行命令

#### 3. 汉化不完整
**症状**: 部分界面仍显示英文

**解决方案**:
```bash
npm run diagnose:report
# 检查 Cursor 版本兼容性
# 更新翻译文件后重新应用
```

#### 4. 无法添加项目
**症状**: 删除所有项目后无法添加新项目

**解决方案**:
```bash
npm run restore
# 重启 Cursor
npm run apply
```

## 📊 项目状态

| 项目 | 状态 |
|------|------|
| **支持的 Cursor 版本** | 1.20.0 及以上 |
| **翻译完成度** | 约 70% |
| **重构状态** | ✅ 已完成 |
| **稳定性** | ✅ 大幅提升 |

## ⚠️ 重要提醒

- **操作前请完全退出 Cursor**
- **首次运行会自动备份原始文件**
- **Cursor 更新后可能需要重新应用汉化**
- **建议在重要环境中谨慎使用**

### 设置访问方式

汉化后如果"首选项"菜单消失，可通过以下方式访问：

- **Windows/Linux**: `Ctrl + Shift + P` → 输入"Cursor Settings"
- **macOS**: `Cmd + Shift + P` → 输入"Cursor Settings"

## 🤝 贡献指南

### 贡献翻译

1. 编辑 `translations/zh-cn.json` 文件
2. 添加或修改翻译条目：
   ```json
   {
     "英文原文": "中文翻译",
     "Another Text": "另一个翻译"
   }
   ```
3. 运行 `npm run apply` 测试效果
4. 提交 Pull Request

### 贡献代码

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/新功能`)
3. 提交更改 (`git commit -m '添加新功能'`)
4. 推送分支 (`git push origin feature/新功能`)
5. 创建 Pull Request

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

## 📝 更新日志

### v2.0.0 (2024-12)
- ✨ 全面重构，提升稳定性和用户体验
- 🔧 新增智能诊断工具
- 🧪 添加自动化测试框架
- 💾 原子性文件操作，确保安全
- 📚 完善文档和故障排除指南

### v1.x.x
- 基础汉化功能
- 双语模式支持
- 跨平台兼容性

---

**免责声明**: 本项目为非官方工具，通过修改 Cursor 核心文件实现汉化。使用前请备份重要数据，自行承担使用风险。 