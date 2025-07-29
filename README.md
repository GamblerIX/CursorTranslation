<!--
 * @description: Cursor 简体中文汉化补丁 - 重构优化版
 * @author: liutq
-->
<div align="center">
  <h1>Cursor 简体中文汉化补丁</h1>
  <p>
    一个通过脚本直接修补 Cursor 应用文件，从而实现深度汉化的非官方工具。
  </p>
  <p>
    <strong>[重构优化版] - 更稳定、更安全、更易用</strong>
  </p>
</div>

# Cursor 中文补丁工具

一个为 Cursor 编辑器提供中文本地化的非官方补丁工具。经过全面重构，提供更好的稳定性和用户体验。

## [功能特性]

- **一键汉化**: 自动检测 Cursor 安装路径并应用汉化补丁
- **智能诊断**: 内置诊断工具，自动检测和修复常见问题
- **两种模式**:
    - **直接翻译**: 将界面英文替换为中文
    - **双语模式**: 保留英文，在下方换行显示中文，方便对照学习
- **安全备份**: 首次运行时自动备份原始文件，支持完整性验证
- **轻松还原**: 支持一键还原到原始英文界面
- **跨平台**: 支持 macOS, Windows, 和 Linux
- **原子性操作**: 确保文件写入的安全性，避免损坏
- **自动测试**: 内置测试框架，确保代码质量

## [环境要求]

- [Node.js](https://nodejs.org/) v16 或更高版本

## [快速开始]

### 1. 下载项目

```bash
git clone https://github.com/kociii/cursor-chinese-pack.git
cd cursor-chinese-pack
```

或者直接从 [GitHub 仓库](https://github.com/kociii/cursor-chinese-pack) 下载 ZIP 压缩包并解压。

### 2. 安装依赖

```bash
npm install
```

### 3. 诊断和修复（推荐）

在应用汉化前，建议先运行诊断工具检查系统状态：

```bash
# 生成诊断报告
npm run diagnose

# 自动修复常见问题
npm run diagnose:fix

# 生成详细报告
npm run diagnose:report
```

### 4. 应用补丁

**重要提示**: 在操作前，请确保已完全退出 Cursor。

#### 模式一：直接翻译

```bash
npm run apply
```

#### 模式二：双语模式 (中英对照)

```bash
npm run apply:bilingual
```

---

**自定义路径**:

如果工具未能自动找到您的 Cursor 安装位置，你可以在命令后手动指定路径：

```bash
# macOS 示例
npm run apply -- "/Applications/Cursor.app"

# Windows 示例
npm run apply -- "C:\\Users\\yourname\\AppData\\Local\\Programs\\Cursor"
```

### 5. 还原英文

```bash
npm run restore
```

### 6. 运行测试

```bash
npm test
```

## [故障排除]

### 常见问题及解决方案

#### 1. Cursor 提示损坏
**症状**: 运行汉化后，Cursor 启动时提示文件损坏或无法启动。

**解决方案**:
```bash
# 1. 运行诊断工具
npm run diagnose

# 2. 自动修复问题
npm run diagnose:fix

# 3. 如果问题仍然存在，重新安装 Cursor
```

#### 2. 无法添加新项目
**症状**: 删除所有项目后，无法添加新的项目到 Cursor。

**解决方案**:
```bash
# 1. 还原到英文版本
npm run restore

# 2. 重新启动 Cursor
# 3. 重新应用汉化
npm run apply
```

#### 3. 汉化效果不完整
**症状**: 部分界面仍然是英文，或翻译不准确。

**解决方案**:
```bash
# 1. 检查 Cursor 版本兼容性
npm run diagnose:report

# 2. 更新翻译文件（需要社区贡献）
# 3. 重新应用汉化
npm run apply
```

#### 4. 权限错误
**症状**: 脚本运行时提示权限不足或文件访问被拒绝。

**解决方案**:
- **Windows**: 以管理员身份运行 PowerShell 或命令提示符
- **macOS**: 使用 `sudo` 运行命令
- **Linux**: 使用 `sudo` 运行命令

#### 5. 备份文件损坏
**症状**: 还原时提示备份文件损坏或不存在。

**解决方案**:
```bash
# 1. 运行诊断工具检查备份状态
npm run diagnose

# 2. 如果备份损坏，删除损坏的备份文件
# 3. 重新安装 Cursor
# 4. 重新应用汉化
npm run apply
```

## [项目状态]

- **当前支持的 Cursor 版本**：0.20.0 及以下
- **最近更新日期**：2024年12月
- **完成度**：约 70%（主要界面元素已翻译）
- **重构状态**：✅ 已完成，稳定性大幅提升

## [注意事项]

- **设置访问问题**: 应用汉化补丁后，Cursor 的"首选项"菜单项可能会暂时消失。此时，你可以通过以下方式访问设置：
  - **macOS**: 按下 `Cmd + Shift + P`，然后输入"Cursor Settings"（或"设置"）
  - **Windows/Linux**: 按下 `Ctrl + Shift + P`，然后输入"Cursor Settings"（或"设置"）

- **Cursor 版本更新**：当 Cursor 更新后，其核心文件 `workbench.desktop.main.js` 可能会发生变动，这可能导致汉化失效或显示不全。届时，需要社区协作，从新版 Cursor 中提取最新的字符串，更新到 `translations/zh-cn.json` 中。

- **管理员权限**：在 Windows 系统上，如果汉化失败，请尝试**以管理员身份运行终端**。

- **原子性操作**：重构后的工具使用原子性文件写入，确保即使在写入过程中断也不会导致文件损坏。

## [重构改进]

### 稳定性提升
- [OK] 原子性文件操作，避免文件损坏
- [OK] 文件完整性验证机制
- [OK] 智能错误恢复和自动修复
- [OK] 增强的备份和还原机制

### 用户体验改进
- [OK] 友好的错误提示和详细日志
- [OK] 内置诊断工具，自动检测问题
- [OK] 完善的故障排除指南
- [OK] 自动化测试确保代码质量

### 代码质量提升
- [OK] 面向对象设计，模块化架构
- [OK] 统一的错误处理机制
- [OK] 完整的测试覆盖
- [OK] 更好的代码可维护性

## [免责声明]

- 本项目是一个非官方工具，通过修改 Cursor 的核心 `workbench.desktop.main.js` 文件来实现汉化。
- 每次 Cursor 更新后，你可能需要重新运行此脚本。
- 请自行承担使用本工具可能带来的任何风险。建议在操作前自行备份重要数据。
- 重构后的工具提供了更好的安全性和稳定性，但仍建议在重要环境中谨慎使用。

## [贡献]

欢迎提交 PR 或 Issue 来帮助改进本项目。请访问 [GitHub 仓库](https://github.com/kociii/cursor-chinese-pack/issues) 提交问题或建议。

### 如何贡献翻译

我们非常欢迎社区贡献，以保持翻译的准确和全面！

1.  核心翻译文件位于 `translations/zh-cn.json`。
2.  该文件是一个 **JSON 键值对 (key-value)** 对象。
3.  `key` 是需要翻译的**英文原文**，`value` 是对应的**中文译文**。
4.  您可以添加新的键值对或修改现有的中文译文。
    ```json
    {
      "Original English Text": "翻译后的中文",
      "Another String to Translate": "另一个翻译好的字符串"
    }
    ```
5.  **重要**：请确保您的修改符合 JSON 格式。`key` 和 `value` 都必须是使用双引号 `"` 包裹的字符串。
6.  完成修改后，重新运行 `npm run apply` 即可在您的本地看到更改。欢迎通过 Pull Request 将您的贡献提交到本项目！

### 如何贡献代码

1. Fork 本项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## [开源协议]

本项目基于 [MIT License](LICENSE) 开源。

## [更新日志]

### v2.0.0 (2024-12-XX)
- [NEW] 全面重构，提升稳定性和用户体验
- [FIX] 新增诊断工具，自动检测和修复问题
- [TEST] 添加测试框架，确保代码质量
- [SAFE] 原子性文件操作，避免文件损坏
- [DOC] 完善文档和故障排除指南
- [OPT] 优化错误处理和日志输出

### v1.x.x (历史版本)
- 基础汉化功能
- 双语模式支持
- 跨平台兼容性 