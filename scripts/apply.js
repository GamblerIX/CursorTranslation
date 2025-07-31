const fs = require('fs');
const path = require('path');
const os = require('os');

const { VersionValidator } = require('./version-validator.js');

// --- 配置常量 ---
const JS_FILE_NAME = 'workbench.desktop.main.js';
const JS_FILE_SUB_PATH = path.join('out', 'vs', 'workbench');
const BACKUP_SUFFIX = '.original';
const TEMP_SUFFIX = '.temp';
const MAX_TRANSLATION_LENGTH = 500;
const MIN_TRANSLATIONS_REQUIRED = 10;
// --- 配置结束 ---



/**
 * 日志工具类
 */
class Logger {
    static info(message) {
        console.log(message);
    }
    
    static success(message) {
        console.log(`\x1b[32m${message}\x1b[0m`);
    }
    
    static warning(message) {
        console.log(`\x1b[33m${message}\x1b[0m`);
    }
    
    static error(message) {
        console.log(`\x1b[31m${message}\x1b[0m`);
    }
    
    static debug(message) {
        if (message.includes('文件验证通过:') || message.includes('成功复制文件:')) {
            const action = message.includes('文件验证通过:') ? '文件验证通过' : '文件复制成功';
            console.log(`\x1b[36m[DEBUG]\x1b[0m ${action}`);
        } else {
            console.log(`\x1b[36m[DEBUG]\x1b[0m ${message}`);
        }
    }
}

/**
 * 文件操作工具类
 */
class FileUtils {
    /**
     * 安全地读取文件
     * @param {string} filePath 文件路径
     * @returns {string|null} 文件内容或null
     */
    static safeReadFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            return content;
        } catch (error) {
            Logger.error(`读取文件失败: ${filePath}`);
            Logger.error(`错误详情: ${error.message}`);
            return null;
        }
    }

    /**
     * 安全地写入文件
     * @param {string} filePath 文件路径
     * @param {string} content 文件内容
     * @returns {boolean} 是否成功
     */
    static safeWriteFile(filePath, content) {
        try {
            // 确保目录存在
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // 先写入临时文件，再重命名，确保原子性
            const tempPath = `${filePath}${TEMP_SUFFIX}`;
            fs.writeFileSync(tempPath, content, 'utf-8');
            fs.renameSync(tempPath, filePath);
            return true;
        } catch (error) {
            Logger.error(`写入文件失败: ${filePath}`);
            Logger.error(`错误详情: ${error.message}`);
            return false;
        }
    }

    /**
     * 安全地复制文件
     * @param {string} source 源文件路径
     * @param {string} target 目标文件路径
     * @returns {boolean} 是否成功
     */
    static safeCopyFile(source, target) {
        try {
            const content = this.safeReadFile(source);
            if (content === null) {
                return false;
            }
            const result = this.safeWriteFile(target, content);
            if (result) {
                Logger.debug(`成功复制文件: ${source} -> ${target}`);
            }
            return result;
        } catch (error) {
            Logger.error(`复制文件失败: ${source} -> ${target}`);
            Logger.error(`错误详情: ${error.message}`);
            return false;
        }
    }

    /**
     * 验证文件完整性
     * @param {string} filePath 文件路径
     * @param {boolean} isJSFile 是否为JS文件
     * @returns {boolean} 是否有效
     */
    static validateFile(filePath, isJSFile = true) {
        try {
            if (!fs.existsSync(filePath)) {
                Logger.debug(`文件不存在: ${filePath}`);
                return false;
            }

            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                Logger.warning(`文件为空: ${filePath}`);
                return false;
            }

            if (isJSFile) {
                const content = fs.readFileSync(filePath, 'utf-8');
                // 检查是否为有效的JavaScript文件
                if (!content.includes('function') && !content.includes('var') && !content.includes('const')) {
                    Logger.warning(`文件可能不是有效的JavaScript文件: ${filePath}`);
                    return false;
                }
            }

            Logger.debug(`文件验证通过: ${filePath}`);
            return true;
        } catch (error) {
            Logger.error(`文件验证失败: ${filePath}`);
            Logger.error(`错误详情: ${error.message}`);
            return false;
        }
    }
}

/**
 * Cursor路径查找器
 */
class CursorPathFinder {
    /**
     * 自动寻找或使用指定的 Cursor 安装路径
     * @param {string | undefined} customPath 用户提供的自定义路径
     * @returns {string | null} Cursor 的安装路径或 null
     */
    static findCursorPath(customPath) {
        if (customPath) {
            if (fs.existsSync(customPath)) {
                Logger.success(`使用了自定义路径: ${customPath}`);
                return customPath;
            } else {
                Logger.error(`自定义路径不存在: ${customPath}`);
                return null;
            }
        }

        const platform = os.platform();
        const potentialPaths = this.getPotentialPaths(platform);

        for (const p of potentialPaths) {
            if (fs.existsSync(p)) {
                Logger.success(`自动检测到 Cursor 安装路径: ${p}`);
                return p;
            }
        }

        Logger.error('未能自动检测到 Cursor 安装路径。');
        Logger.info('请在命令后面添加您的 Cursor 安装路径作为参数。');
        Logger.info('例如: npm run apply -- "/path/to/your/cursor/installation"');
        return null;
    }

    /**
     * 获取平台特定的潜在路径
     * @param {string} platform 平台
     * @returns {string[]} 潜在路径数组
     */
    static getPotentialPaths(platform) {
        if (platform === 'darwin') { // macOS
            return ['/Applications/Cursor.app'];
        } else if (platform === 'win32') { // Windows
            const localAppData = process.env.LOCALAPPDATA;
            const programFiles = process.env.ProgramFiles;
            const programFilesX86 = process.env['ProgramFiles(x86)'];
            
            return [
                localAppData && path.join(localAppData, 'Programs', 'Cursor'),
                programFiles && path.join(programFiles, 'Cursor'),
                programFilesX86 && path.join(programFilesX86, 'Cursor'),
                path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Cursor'),
            ].filter(Boolean);
        } else { // Linux
            return [
                path.join(os.homedir(), '.local/share/cursor'),
                '/opt/cursor',
                '/usr/local/cursor',
                path.join(os.homedir(), '.cursor')
            ];
        }
    }

    /**
     * 获取平台特定的资源文件路径
     * @param {string} cursorPath Cursor 安装根路径
     * @returns {{appPath: string, targetFile: string, backupFile: string}}
     */
    static getPlatformPaths(cursorPath) {
        let appPath;
        const platform = os.platform();

        if (platform === 'darwin') {
            appPath = path.join(cursorPath, 'Contents', 'Resources', 'app');
        } else { // Windows, Linux
            appPath = path.join(cursorPath, 'resources', 'app');
        }

        const targetFile = path.join(appPath, JS_FILE_SUB_PATH, JS_FILE_NAME);
        const backupFile = `${targetFile}${BACKUP_SUFFIX}`;

        return { appPath, targetFile, backupFile };
    }
}

/**
 * 翻译处理器
 */
class TranslationProcessor {
    /**
     * 加载翻译文件
     * @param {string} projectRoot 项目根目录
     * @returns {Object|null} 翻译对象或null
     */
    static loadTranslations(projectRoot) {
        const translationMapPath = path.join(projectRoot, 'translations', 'zh-cn.json');
        Logger.step(`正在读取翻译文件: ${translationMapPath}`);
        
        try {
            const content = FileUtils.safeReadFile(translationMapPath);
            if (!content) {
                Logger.error('翻译文件读取失败');
                return null;
            }
            
            const groupedTranslations = JSON.parse(content);
            
            // 验证翻译文件结构
            if (!this.validateTranslationStructure(groupedTranslations)) {
                Logger.error('翻译文件结构无效');
                return null;
            }
            
            // 将嵌套的翻译对象扁平化为单层键值对
            const translations = this.flattenTranslations(groupedTranslations);
            
            // 验证翻译内容
            const validationResult = this.validateTranslations(translations);
            if (!validationResult.isValid) {
                Logger.warning(`翻译验证发现问题: ${validationResult.issues.join(', ')}`);
            }
            
            Logger.success(`成功加载 ${Object.keys(translations).length} 个翻译条目`);
            return translations;
        } catch (error) {
            Logger.error(`解析翻译文件失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 验证翻译文件结构
     * @param {Object} groupedTranslations 分组翻译对象
     * @returns {boolean} 是否有效
     */
    static validateTranslationStructure(groupedTranslations) {
        if (!groupedTranslations || typeof groupedTranslations !== 'object') {
            return false;
        }
        
        // 检查是否至少有一个分组
        const groups = Object.keys(groupedTranslations);
        if (groups.length === 0) {
            return false;
        }
        
        // 检查每个分组是否包含翻译对象
        for (const groupName of groups) {
            const group = groupedTranslations[groupName];
            if (!group || typeof group !== 'object') {
                Logger.warning(`分组 "${groupName}" 结构无效`);
                return false;
            }
        }
        
        return true;
    }

    /**
     * 扁平化翻译对象
     * @param {Object} groupedTranslations 分组翻译对象
     * @returns {Object} 扁平化翻译对象
     */
    static flattenTranslations(groupedTranslations) {
        const translations = {};
        
        for (const [groupName, group] of Object.entries(groupedTranslations)) {
            for (const [key, value] of Object.entries(group)) {
                // 跳过空值或无效翻译
                if (!value || typeof value !== 'string' || value.trim() === '') {
                    Logger.warning(`跳过无效翻译: ${groupName}.${key}`);
                    continue;
                }
                
                // 使用完整路径作为键，避免冲突
                const fullKey = `${groupName}.${key}`;
                translations[fullKey] = value;
            }
        }
        
        return translations;
    }

    /**
     * 验证翻译内容
     * @param {Object} translations 翻译对象
     * @returns {{isValid: boolean, issues: string[], stats: Object}} 验证结果
     */
    static validateTranslations(translations) {
        const issues = [];
        const stats = {
            total: Object.keys(translations).length,
            emptyKeys: 0,
            emptyValues: 0,
            specialChars: 0,
            tooLong: 0,
            valid: 0
        };
        
        for (const [key, value] of Object.entries(translations)) {
            // 检查翻译键是否为空
            if (!key || key.trim() === '') {
                issues.push(`发现空键`);
                stats.emptyKeys++;
                continue;
            }
            
            // 检查翻译值是否为空
            if (!value || value.trim() === '') {
                issues.push(`键 "${key}" 的翻译为空`);
                stats.emptyValues++;
                continue;
            }
            
            // 检查翻译值是否包含特殊字符
            if (value.includes('\\n') || value.includes('\\t') || value.includes('\\r')) {
                issues.push(`键 "${key}" 包含转义字符，可能影响显示`);
                stats.specialChars++;
            }
            
            // 检查翻译值长度是否合理
            if (value.length > MAX_TRANSLATION_LENGTH) {
                issues.push(`键 "${key}" 的翻译过长 (${value.length} 字符)`);
                stats.tooLong++;
            }
            
            stats.valid++;
        }
        
        Logger.debug(`翻译验证统计: 总计${stats.total}, 有效${stats.valid}, 空键${stats.emptyKeys}, 空值${stats.emptyValues}, 特殊字符${stats.specialChars}, 过长${stats.tooLong}`);
        
        return {
            isValid: issues.length === 0,
            issues,
            stats
        };
    }

    /**
     * 转义正则表达式特殊字符
     * @param {string} string 要转义的字符串
     * @returns {string} 转义后的字符串
     */
    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 应用翻译到内容
     * @param {string} content 原始内容
     * @param {Object} translations 翻译对象
     * @param {string} mode 翻译模式
     * @returns {{content: string, replacementsCount: number, notFound: string[], errors: string[]}}
     */
    static applyTranslations(content, translations, mode) {
        let replacementsCount = 0;
        let notFound = [];
        let errors = [];
        
        Logger.step('正在查找并替换词条...');
        
        // 按长度排序，优先替换长字符串，避免部分替换问题
        const sortedEntries = Object.entries(translations).sort((a, b) => b[0].length - a[0].length);
        
        // 批量处理，每100个条目显示一次进度
        const batchSize = 100;
        const totalEntries = sortedEntries.length;
        
        for (let i = 0; i < sortedEntries.length; i++) {
            const [original, translated] = sortedEntries[i];
            
            // 显示进度
            if (i % batchSize === 0) {
                const progress = Math.round((i / totalEntries) * 100);
                Logger.debug(`翻译进度: ${progress}% (${i}/${totalEntries})`);
            }
            
            try {
                // 使用正则表达式全局替换，确保替换所有出现的地方
                // 通过 `("...")` 或 `('...')` 来定位，避免错误替换
                const regex = new RegExp(`(["'])${this.escapeRegExp(original)}\\1`, 'g');
                const originalContent = content;
                
                let replacementString;
                if (mode === 'bilingual') {
                    // 在替换字符串中，需要转义 `$` 字符，防止其被误认为特殊替换模式
                    const escapedOriginalForReplacement = original.replace(/\$/g, '$$$$');
                    replacementString = `$1${escapedOriginalForReplacement}\\n${translated}$1`;
                } else { // 'direct' 模式
                    replacementString = `$1${translated}$1`;
                }
                
                content = content.replace(regex, replacementString);

                if (originalContent !== content) {
                    replacementsCount++;
                } else {
                    notFound.push(original);
                }
            } catch (error) {
                errors.push(`处理翻译 "${original}" 时出错: ${error.message}`);
            }
        }

        // 记录统计信息
        Logger.info(`翻译统计: 成功替换 ${replacementsCount} 个，未找到 ${notFound.length} 个，错误 ${errors.length} 个`);
        
        if (notFound.length > 0) {
            Logger.warning(`未找到的翻译: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? '...' : ''}`);
        }
        
        if (errors.length > 0) {
            Logger.error(`翻译错误: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
        }

        return { content, replacementsCount, notFound, errors };
    }

    /**
     * 创建翻译回退机制
     * @param {Object} translations 主翻译对象
     * @returns {Object} 包含回退机制的翻译对象
     */
    static createFallbackTranslations(translations) {
        const fallbackTranslations = { ...translations };
        
        // 添加常用词汇的回退翻译
        const commonFallbacks = {
            'Settings': '设置',
            'Preferences': '偏好设置',
            'General': '常规',
            'Advanced': '高级',
            'Cancel': '取消',
            'OK': '确定',
            'Apply': '应用',
            'Save': '保存',
            'Close': '关闭',
            'Open': '打开',
            'Edit': '编辑',
            'Delete': '删除',
            'Add': '添加',
            'Remove': '移除',
            'Search': '搜索',
            'Find': '查找',
            'Replace': '替换',
            'Copy': '复制',
            'Paste': '粘贴',
            'Cut': '剪切',
            'Undo': '撤销',
            'Redo': '重做'
        };
        
        // 只添加主翻译中没有的常用翻译
        for (const [key, value] of Object.entries(commonFallbacks)) {
            if (!fallbackTranslations[key]) {
                fallbackTranslations[key] = value;
            }
        }
        
        return fallbackTranslations;
    }
}

/**
 * 补丁应用器
 */
class PatchApplier {
    /**
     * 将翻译应用到 Cursor 核心文件
     * @param {('direct'|'bilingual')} mode 翻译模式
     * @param {string} cursorPath Cursor 安装路径
     * @param {boolean} isFast 是否快速模式
     * @returns {boolean} 是否成功
     */
    static applyTranslations(mode, cursorPath, isFast = false) {
        const monitor = new PerformanceMonitor();
        Logger.info(`开始应用中文语言补丁 (模式: ${mode})...`);
        const { targetFile, backupFile } = CursorPathFinder.getPlatformPaths(cursorPath);

        // 1. 检查原始文件是否存在
        if (!fs.existsSync(targetFile)) {
            Logger.error(`在路径 ${targetFile} 中找不到目标文件。`);
            Logger.info('请确认 Cursor 安装正确，或手动指定正确的路径。');
            return false;
        }

        // 2. 验证原始文件完整性（快速模式跳过详细验证）
        if (!isFast && !FileUtils.validateFile(targetFile)) {
            Logger.error('目标文件可能已损坏或格式不正确');
            return false;
        }

        // 3. 创建或验证备份
        if (!this.createBackup(targetFile, backupFile)) {
            return false;
        }

        // 4. 加载翻译
        monitor.start('loadTranslations');
        const projectRoot = path.resolve(__dirname, '..');
        let translations = TranslationProcessor.loadTranslations(projectRoot);
        monitor.end('loadTranslations');
        
        if (!translations) {
            Logger.error('无法加载翻译文件，尝试使用回退翻译...');
            // 尝试使用回退翻译
            translations = TranslationProcessor.createFallbackTranslations({});
            if (Object.keys(translations).length === 0) {
                Logger.error('无法创建回退翻译，操作失败');
                return false;
            }
            Logger.warning('使用基础回退翻译，翻译覆盖率可能较低');
        }

        // 5. 从备份文件读取内容，确保每次都从纯净的原始版本开始
        monitor.start('readFile');
        Logger.step('正在读取原始 JS 文件内容...');
        const content = FileUtils.safeReadFile(backupFile);
        monitor.end('readFile');
        
        if (!content) {
            Logger.error('无法读取备份文件');
            return false;
        }

        // 6. 执行文本替换
        monitor.start('applyTranslations');
        const result = TranslationProcessor.applyTranslations(content, translations, mode);
        monitor.end('applyTranslations');
        
        // 7. 处理替换结果
        if (result.errors.length > 0) {
            Logger.error(`翻译过程中出现 ${result.errors.length} 个错误`);
            if (result.errors.length <= 3) {
                Logger.error(`错误详情: ${result.errors.join(', ')}`);
            }
        }
        
        Logger.success(`成功替换 ${result.replacementsCount} 个词条。`);
        
        if (result.notFound.length > 0) {
            Logger.warning(`有 ${result.notFound.length} 个词条在文件中未找到，这可能是因为 Cursor 版本更新。`);
            if (result.notFound.length <= 10) {
                Logger.warning(`未找到的词条: ${result.notFound.join('", "')}`);
            } else {
                Logger.warning(`未找到的词条: ${result.notFound.slice(0, 10).join('", "')}...`);
            }
        }

        // 检查替换效果
        if (result.replacementsCount === 0) {
            Logger.error('未执行任何替换。可能的原因:');
            Logger.error('1. `zh-cn.json` 中的英文原文与代码中的不完全一致');
            Logger.error('2. Cursor 版本更新导致文本变化');
            Logger.error('3. 翻译文件格式问题');
            
            // 尝试使用更宽松的匹配
            Logger.info('尝试使用更宽松的匹配模式...');
            const fallbackResult = this.tryFallbackTranslation(content, mode);
            if (fallbackResult.replacementsCount > 0) {
                Logger.success(`使用回退模式成功替换 ${fallbackResult.replacementsCount} 个词条`);
                return this.finalizeTranslation(targetFile, fallbackResult.content, backupFile);
            }
            
            return false;
        }

        // 7. 最终化翻译
        const totalTime = monitor.getTotalTime();
        Logger.info(`总耗时: ${totalTime}ms`);
        return this.finalizeTranslation(targetFile, result.content, backupFile, isFast);
    }

    /**
     * 尝试回退翻译
     * @param {string} content 原始内容
     * @param {string} mode 翻译模式
     * @returns {{content: string, replacementsCount: number, notFound: string[], errors: string[]}}
     */
    static tryFallbackTranslation(content, mode) {
        Logger.info('尝试使用回退翻译模式...');
        
        // 创建更宽松的翻译规则
        const fallbackTranslations = {
            'Settings': '设置',
            'Preferences': '偏好设置',
            'General': '常规',
            'Advanced': '高级',
            'Cancel': '取消',
            'OK': '确定',
            'Apply': '应用',
            'Save': '保存',
            'Close': '关闭',
            'Open': '打开',
            'Edit': '编辑',
            'Delete': '删除',
            'Add': '添加',
            'Remove': '移除',
            'Search': '搜索',
            'Find': '查找',
            'Replace': '替换',
            'Copy': '复制',
            'Paste': '粘贴',
            'Cut': '剪切',
            'Undo': '撤销',
            'Redo': '重做',
            'File': '文件',
            'View': '视图',
            'Help': '帮助',
            'Tools': '工具',
            'Window': '窗口',
            'Terminal': '终端',
            'Debug': '调试',
            'Run': '运行',
            'Stop': '停止',
            'Start': '开始',
            'End': '结束',
            'Next': '下一个',
            'Previous': '上一个',
            'Back': '返回',
            'Forward': '前进',
            'Home': '主页',
            'Page Up': '向上翻页',
            'Page Down': '向下翻页',
            'Insert': '插入',
            'Enter': '回车',
            'Tab': '制表符',
            'Space': '空格',
            'Escape': '退出',
            'F1': 'F1',
            'F2': 'F2',
            'F3': 'F3',
            'F4': 'F4',
            'F5': 'F5',
            'F6': 'F6',
            'F7': 'F7',
            'F8': 'F8',
            'F9': 'F9',
            'F10': 'F10',
            'F11': 'F11',
            'F12': 'F12'
        };
        
        return TranslationProcessor.applyTranslations(content, fallbackTranslations, mode);
    }

    /**
     * 最终化翻译
     * @param {string} targetFile 目标文件
     * @param {string} content 翻译后的内容
     * @param {string} backupFile 备份文件路径
     * @returns {boolean} 是否成功
     */
    static finalizeTranslation(targetFile, content, backupFile, isFast = false) {
        // 将修改后的内容写回目标文件
        Logger.step(`正在将翻译后的内容写入: ${targetFile}`);
        if (!FileUtils.safeWriteFile(targetFile, content)) {
            return false;
        }

        // 验证修改后的文件（快速模式跳过验证）
        if (!isFast && !FileUtils.validateFile(targetFile)) {
            Logger.error('修改后的文件验证失败，正在还原...');
            this.restoreFromBackup(targetFile, backupFile);
            return false;
        }

        Logger.success('\n[SUCCESS] 补丁成功应用！请完全重启 Cursor (Cmd+Q 或 Ctrl+Q) 以查看效果。');
        return true;
    }

    /**
     * 创建备份文件
     * @param {string} targetFile 目标文件
     * @param {string} backupFile 备份文件路径
     * @returns {boolean} 是否成功
     */
    static createBackup(targetFile, backupFile) {
        if (!fs.existsSync(backupFile)) {
            Logger.info('检测到首次运行，正在创建原始文件备份...');
            if (!FileUtils.safeCopyFile(targetFile, backupFile)) {
                Logger.error('备份创建失败');
                return false;
            }
            Logger.success(`备份已创建于: ${backupFile}`);
        } else {
            Logger.info('备份文件已存在，跳过备份步骤。');
        }
        return true;
    }

    /**
     * 从备份还原原始文件
     * @param {string} cursorPath Cursor 安装路径
     * @returns {boolean} 是否成功
     */
    static restoreOriginal(cursorPath) {
        Logger.info('开始还原原始英文文件...');
        const { targetFile, backupFile } = CursorPathFinder.getPlatformPaths(cursorPath);

        if (fs.existsSync(backupFile)) {
            if (!this.restoreFromBackup(targetFile, backupFile)) {
                return false;
            }
            
            // 删除备份文件
            try {
                fs.unlinkSync(backupFile);
                Logger.success('备份文件已删除。');
            } catch (error) {
                Logger.warning('删除备份文件失败，但不影响还原结果');
            }
            
            Logger.success('\n[SUCCESS] 还原成功！请重启 Cursor。');
            return true;
        } else {
            Logger.warning('未找到备份文件，无需还原。');
            return true;
        }
    }

    /**
     * 从备份文件还原
     * @param {string} targetFile 目标文件
     * @param {string} backupFile 备份文件
     * @returns {boolean} 是否成功
     */
    static restoreFromBackup(targetFile, backupFile) {
        if (!FileUtils.safeCopyFile(backupFile, targetFile)) {
            Logger.error('还原文件失败');
            return false;
        }
        Logger.success('已从备份还原原始文件。');
        return true;
    }
}

/**
 * 脚本主入口
 */
function main() {
    try {
        console.log('--- Cursor 汉化脚本 v2.1 ---');
        const args = process.argv.slice(2);

        const isRestore = args.includes('restore');
        const isFast = args.includes('fast');
        let mode = 'direct';
        if (args.includes('bilingual')) {
            mode = 'bilingual';
        }

        const pathArg = args.find(arg => !['restore', 'bilingual', 'direct', 'fast'].includes(arg));

        if (!isRestore) {
            try {
                const TranslationMerger = require('./translation-merger');
                const merger = new TranslationMerger();
                const mergeResult = merger.run();
                
                if (mergeResult.merged) {
                    Logger.success(`翻译合并完成，新增 ${mergeResult.stats.added.translations} 个词条`);
                }
            } catch (error) {
                Logger.warning(`翻译合并检查失败: ${error.message}`);
            }
        }

        const cursorPath = CursorPathFinder.findCursorPath(pathArg);
        
        if (!cursorPath) {
            Logger.error('无法找到 Cursor 安装路径');
            process.exit(1);
        }

        if (!isRestore) {
            try {
                const versionInfo = VersionValidator.detectCursorVersion(cursorPath);
                const compatibility = VersionValidator.validateCompatibility(versionInfo);
                
                if (compatibility.isCompatible) {
                    Logger.success(`版本验证通过 (置信度: ${compatibility.confidence}%)`);
                } else {
                    Logger.warning('版本兼容性检查未通过');
                    
                    if (process.env.CI || process.env.NON_INTERACTIVE) {
                        Logger.error('在非交互模式下检测到版本不兼容，退出执行');
                        process.exit(1);
                    }
                }
            } catch (error) {
                Logger.warning(`版本验证失败: ${error.message}`);
            }
        }

        let success = false;
        if (isRestore) {
            success = PatchApplier.restoreOriginal(cursorPath);
        } else {
            success = PatchApplier.applyTranslations(mode, cursorPath, isFast);
        }

        if (success) {
            Logger.success('操作成功完成');
            process.exit(0);
        } else {
            Logger.error('操作失败，请检查错误信息并重试');
            process.exit(1);
        }
    } catch (error) {
        Logger.error(`脚本执行出错: ${error.message}`);
        process.exit(1);
    }
}

// 错误处理
process.on('uncaughtException', (error) => {
    Logger.error(`未捕获的异常: ${error.message}`);
    Logger.error(`堆栈: ${error.stack}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    Logger.error(`未处理的 Promise 拒绝: ${reason}`);
    process.exit(1);
});

// 导出工具类供其他脚本使用
module.exports = { Logger, FileUtils, CursorPathFinder, TranslationProcessor, PatchApplier };

if (require.main === module) {
    main();
}