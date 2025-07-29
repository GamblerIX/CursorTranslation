const fs = require('fs');
const path = require('path');
const os = require('os');

// --- 配置 ---
const JS_FILE_NAME = 'workbench.desktop.main.js';
const JS_FILE_SUB_PATH = path.join('out', 'vs', 'workbench');
const BACKUP_SUFFIX = '.original';
const TEMP_SUFFIX = '.temp';
// --- 配置结束 ---

/**
 * 日志工具类
 */
class Logger {
    static info(message) {
        console.log(`[INFO] ${message}`);
    }
    
    static success(message) {
        console.log(`[OK] ${message}`);
    }
    
    static warning(message) {
        console.warn(`[WARN] ${message}`);
    }
    
    static error(message) {
        console.error(`[ERROR] ${message}`);
    }
    
    static step(message) {
        console.log(`[STEP] ${message}`);
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
            return fs.readFileSync(filePath, 'utf-8');
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
            return this.safeWriteFile(target, content);
        } catch (error) {
            Logger.error(`复制文件失败: ${source} -> ${target}`);
            Logger.error(`错误详情: ${error.message}`);
            return false;
        }
    }

    /**
     * 验证文件完整性
     * @param {string} filePath 文件路径
     * @param {boolean} isJSFile 是否为JavaScript文件
     * @returns {boolean} 文件是否有效
     */
    static validateFile(filePath, isJSFile = true) {
        try {
            const content = this.safeReadFile(filePath);
            if (!content) return false;
            
            // 检查文件大小是否合理（至少1KB）
            const stats = fs.statSync(filePath);
            const isValidSize = stats.size > 1024;
            
            if (!isJSFile) {
                // 对于非JS文件，只检查大小
                return isValidSize;
            }
            
            // 检查文件是否包含基本的JavaScript结构
            const hasBasicJSStructure = content.includes('function') || 
                                     content.includes('var ') || 
                                     content.includes('const ') || 
                                     content.includes('let ');
            
            return hasBasicJSStructure && isValidSize;
        } catch (error) {
            Logger.error(`验证文件失败: ${filePath}`);
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
            
            // 将嵌套的翻译对象扁平化为单层键值对
            const translations = Object.values(groupedTranslations).reduce((acc, group) => {
                return { ...acc, ...group };
            }, {});
            
            Logger.success(`成功加载 ${Object.keys(translations).length} 个翻译条目`);
            return translations;
        } catch (error) {
            Logger.error(`解析翻译文件失败: ${error.message}`);
            return null;
        }
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
     * @returns {{content: string, replacementsCount: number, notFound: string[]}}
     */
    static applyTranslations(content, translations, mode) {
        let replacementsCount = 0;
        let notFound = [];
        
        Logger.step('正在查找并替换词条...');
        
        for (const [original, translated] of Object.entries(translations)) {
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
        }

        return { content, replacementsCount, notFound };
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
     * @returns {boolean} 是否成功
     */
    static applyTranslations(mode, cursorPath) {
        Logger.info(`开始应用中文语言补丁 (模式: ${mode})...`);
        const { targetFile, backupFile } = CursorPathFinder.getPlatformPaths(cursorPath);

        // 1. 检查原始文件是否存在
        if (!fs.existsSync(targetFile)) {
            Logger.error(`在路径 ${targetFile} 中找不到目标文件。`);
            Logger.info('请确认 Cursor 安装正确，或手动指定正确的路径。');
            return false;
        }

        // 2. 验证原始文件完整性
        if (!FileUtils.validateFile(targetFile)) {
            Logger.error('目标文件可能已损坏或格式不正确');
            return false;
        }

        // 3. 创建或验证备份
        if (!this.createBackup(targetFile, backupFile)) {
            return false;
        }

        // 4. 加载翻译
        const projectRoot = path.resolve(__dirname, '..');
        const translations = TranslationProcessor.loadTranslations(projectRoot);
        if (!translations) {
            return false;
        }

        // 5. 从备份文件读取内容，确保每次都从纯净的原始版本开始
        Logger.step('正在读取原始 JS 文件内容...');
        const content = FileUtils.safeReadFile(backupFile);
        if (!content) {
            Logger.error('无法读取备份文件');
            return false;
        }

        // 6. 执行文本替换
        const result = TranslationProcessor.applyTranslations(content, translations, mode);
        
        Logger.success(`成功替换 ${result.replacementsCount} 个词条。`);
        if (result.notFound.length > 0) {
            Logger.warning(`有 ${result.notFound.length} 个词条在文件中未找到，这可能是因为 Cursor 版本更新。`);
            if (result.notFound.length <= 10) {
                Logger.warning(`未找到的词条: ${result.notFound.join('", "')}`);
            } else {
                Logger.warning(`未找到的词条: ${result.notFound.slice(0, 10).join('", "')}...`);
            }
        }

        if (result.replacementsCount === 0) {
            Logger.error('未执行任何替换。请检查:');
            Logger.error('1. `zh-cn.json` 中的英文原文是否与代码中的完全一致。');
            Logger.error('2. Cursor 是否为最新版本。');
            return false;
        }

        // 7. 将修改后的内容写回目标文件
        Logger.step(`正在将翻译后的内容写入: ${targetFile}`);
        if (!FileUtils.safeWriteFile(targetFile, result.content)) {
            return false;
        }

        // 8. 验证修改后的文件
        if (!FileUtils.validateFile(targetFile)) {
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
    console.log('--- Cursor 汉化脚本 v2.0 ---');
    const args = process.argv.slice(2);

    const isRestore = args.includes('restore');
    let mode = 'direct';
    if (args.includes('bilingual')) {
        mode = 'bilingual';
    }

    // 查找路径参数，它不是 'restore', 'bilingual', 或 'direct'
    const pathArg = args.find(arg => !['restore', 'bilingual', 'direct'].includes(arg));

    if (isRestore) {
        Logger.info('模式: 还原');
    } else {
        Logger.info(`模式: ${mode === 'bilingual' ? '双语 (保留原文)' : '直接翻译'}`);
    }

    const cursorPath = CursorPathFinder.findCursorPath(pathArg);
    if (!cursorPath) {
        process.exit(1);
    }

    let success = false;
    if (isRestore) {
        success = PatchApplier.restoreOriginal(cursorPath);
    } else {
        success = PatchApplier.applyTranslations(mode, cursorPath);
    }

    if (!success) {
        Logger.error('操作失败，请检查错误信息并重试');
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