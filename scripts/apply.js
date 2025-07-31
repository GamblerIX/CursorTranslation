const fs = require('fs');
const path = require('path');
const os = require('os');

const { VersionValidator } = require('./version-validator.js');

const JS_FILE_NAME = 'workbench.desktop.main.js';
const JS_FILE_SUB_PATH = path.join('out', 'vs', 'workbench');
const BACKUP_SUFFIX = '.original';
const TEMP_SUFFIX = '.temp';
const MAX_TRANSLATION_LENGTH = 500;
const MIN_TRANSLATIONS_REQUIRED = 10;

class Logger {
    static quietMode = true;
    
    static setVerboseMode(verbose) {
        this.quietMode = !verbose;
    }
    
    static info(message) {
        if (!this.quietMode) {
            console.log(message);
        }
    }
    
    static success(message) {
        console.log(`\x1b[32m${message}\x1b[0m`);
    }
    
    static warning(message) {
        if (!this.quietMode) {
            console.log(`\x1b[33m${message}\x1b[0m`);
        }
    }
    
    static error(message) {
        console.log(`\x1b[31m${message}\x1b[0m`);
    }
    
    static debug(message) {
        if (!this.quietMode) {
            if (message.includes('文件验证通过:') || message.includes('成功复制文件:')) {
                const action = message.includes('文件验证通过:') ? '文件验证通过' : '文件复制成功';
                console.log(`\x1b[36m[DEBUG]\x1b[0m ${action}`);
            } else {
                console.log(`\x1b[36m[DEBUG]\x1b[0m ${message}`);
            }
        }
    }
}

class FileUtils {
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

    static safeWriteFile(filePath, content) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
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

class CursorPathFinder {
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

    static getPotentialPaths(platform) {
        if (platform === 'darwin') {
            return ['/Applications/Cursor.app'];
        } else if (platform === 'win32') {
            const localAppData = process.env.LOCALAPPDATA;
            const programFiles = process.env.ProgramFiles;
            const programFilesX86 = process.env['ProgramFiles(x86)'];
            
            return [
                localAppData && path.join(localAppData, 'Programs', 'Cursor'),
                programFiles && path.join(programFiles, 'Cursor'),
                programFilesX86 && path.join(programFilesX86, 'Cursor'),
                path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Cursor'),
            ].filter(Boolean);
        } else {
            return [
                path.join(os.homedir(), '.local/share/cursor'),
                '/opt/cursor',
                '/usr/local/cursor',
                path.join(os.homedir(), '.cursor')
            ];
        }
    }

    static getPlatformPaths(cursorPath) {
        let appPath;
        const platform = os.platform();

        if (platform === 'darwin') {
            appPath = path.join(cursorPath, 'Contents', 'Resources', 'app');
        } else {
            appPath = path.join(cursorPath, 'resources', 'app');
        }

        const targetFile = path.join(appPath, JS_FILE_SUB_PATH, JS_FILE_NAME);
        const backupFile = `${targetFile}${BACKUP_SUFFIX}`;

        return { appPath, targetFile, backupFile };
    }
}

class TranslationProcessor {
    static loadTranslations(projectRoot) {
        const translationMapPath = path.join(projectRoot, 'translations', 'zh-cn.json');
        Logger.info(`正在读取翻译文件: ${translationMapPath}`);
        
        try {
            const content = FileUtils.safeReadFile(translationMapPath);
            if (!content) {
                Logger.error('翻译文件读取失败');
                return null;
            }
            
            const groupedTranslations = JSON.parse(content);
            
            if (!this.validateTranslationStructure(groupedTranslations)) {
                Logger.error('翻译文件结构无效');
                return null;
            }
            
            const translations = this.flattenTranslations(groupedTranslations);
            
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

    static validateTranslationStructure(groupedTranslations) {
        if (!groupedTranslations || typeof groupedTranslations !== 'object') {
            return false;
        }
        
        const groups = Object.keys(groupedTranslations);
        if (groups.length === 0) {
            return false;
        }
        
        for (const groupName of groups) {
            const group = groupedTranslations[groupName];
            if (!group || typeof group !== 'object') {
                Logger.warning(`分组 "${groupName}" 结构无效`);
                return false;
            }
        }
        
        return true;
    }

    static flattenTranslations(groupedTranslations) {
        const translations = {};
        
        for (const [groupName, group] of Object.entries(groupedTranslations)) {
            for (const [key, value] of Object.entries(group)) {
                if (!value || typeof value !== 'string' || value.trim() === '') {
                    Logger.warning(`跳过无效翻译: ${groupName}.${key}`);
                    continue;
                }
                
                translations[key] = value;
            }
        }
        
        return translations;
    }

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
            if (!key || key.trim() === '') {
                issues.push(`发现空键`);
                stats.emptyKeys++;
                continue;
            }
            
            if (!value || value.trim() === '') {
                issues.push(`键 "${key}" 的翻译为空`);
                stats.emptyValues++;
                continue;
            }
            
            if (value.includes('\\n') || value.includes('\\t') || value.includes('\\r')) {
                issues.push(`键 "${key}" 包含转义字符，可能影响显示`);
                stats.specialChars++;
            }
            
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

    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    static applyTranslations(content, translations, mode) {
        let replacementsCount = 0;
        let notFound = [];
        let errors = [];
        
        Logger.info('正在查找并替换词条...');
        
        const sortedEntries = Object.entries(translations).sort((a, b) => b[0].length - a[0].length);
        
        const batchSize = 100;
        const totalEntries = sortedEntries.length;
        
        for (let i = 0; i < sortedEntries.length; i++) {
            const [original, translated] = sortedEntries[i];
            
            if (i % batchSize === 0) {
                const progress = Math.round((i / totalEntries) * 100);
                Logger.debug(`翻译进度: ${progress}% (${i}/${totalEntries})`);
            }
            
            try {
                const regex = new RegExp(`(["'])${this.escapeRegExp(original)}\\1`, 'g');
                const originalContent = content;
                
                let replacementString;
                if (mode === 'bilingual') {
                    const escapedOriginalForReplacement = original.replace(/\$/g, '$$$$');
                    replacementString = `$1${escapedOriginalForReplacement}\\n${translated}$1`;
                } else {
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

        Logger.info(`翻译统计: 成功替换 ${replacementsCount} 个，未找到 ${notFound.length} 个，错误 ${errors.length} 个`);
        
        if (notFound.length > 0) {
            Logger.warning(`未找到的翻译: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? '...' : ''}`);
        }
        
        if (errors.length > 0) {
            Logger.error(`翻译错误: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
        }

        return { content, replacementsCount, notFound, errors };
    }

    static createFallbackTranslations(translations) {
        const fallbackTranslations = { ...translations };
        
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
        
        for (const [key, value] of Object.entries(commonFallbacks)) {
            if (!fallbackTranslations[key]) {
                fallbackTranslations[key] = value;
            }
        }
        
        return fallbackTranslations;
    }
}

class PatchApplier {
    static applyTranslations(mode, cursorPath, isFast = false) {
        Logger.info(`开始应用中文语言补丁 (模式: ${mode})...`);
        const { targetFile, backupFile } = CursorPathFinder.getPlatformPaths(cursorPath);

        if (!fs.existsSync(targetFile)) {
            Logger.error(`在路径 ${targetFile} 中找不到目标文件。`);
            Logger.info('请确认 Cursor 安装正确，或手动指定正确的路径。');
            return false;
        }

        if (!isFast && !FileUtils.validateFile(targetFile)) {
            Logger.error('目标文件可能已损坏或格式不正确');
            return false;
        }

        if (!this.createBackup(targetFile, backupFile)) {
            return false;
        }

        const projectRoot = path.resolve(__dirname, '..');
        let translations = TranslationProcessor.loadTranslations(projectRoot);
        
        if (!translations) {
            Logger.error('无法加载翻译文件，尝试使用回退翻译...');
            translations = TranslationProcessor.createFallbackTranslations({});
            if (Object.keys(translations).length === 0) {
                Logger.error('无法创建回退翻译，操作失败');
                return false;
            }
            Logger.warning('使用基础回退翻译，翻译覆盖率可能较低');
        }

        Logger.info('正在读取原始 JS 文件内容...');
        const content = FileUtils.safeReadFile(backupFile);
        
        if (!content) {
            Logger.error('无法读取备份文件');
            return false;
        }

        const result = TranslationProcessor.applyTranslations(content, translations, mode);
        
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

        if (result.replacementsCount === 0) {
            Logger.error('未执行任何替换。可能的原因:');
            Logger.error('1. `zh-cn.json` 中的英文原文与代码中的不完全一致');
            Logger.error('2. Cursor 版本更新导致文本变化');
            Logger.error('3. 翻译文件格式问题');
            
            Logger.info('尝试使用更宽松的匹配模式...');
            const fallbackResult = this.tryFallbackTranslation(content, mode);
            if (fallbackResult.replacementsCount > 0) {
                Logger.success(`使用回退模式成功替换 ${fallbackResult.replacementsCount} 个词条`);
                return this.finalizeTranslation(targetFile, fallbackResult.content, backupFile);
            }
            
            return false;
        }

        return this.finalizeTranslation(targetFile, result.content, backupFile, isFast);
    }

    static tryFallbackTranslation(content, mode) {
        Logger.info('尝试使用回退翻译模式...');
        
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

    static finalizeTranslation(targetFile, content, backupFile, isFast = false) {
        Logger.info(`正在将翻译后的内容写入: ${targetFile}`);
        if (!FileUtils.safeWriteFile(targetFile, content)) {
            return false;
        }

        if (!isFast && !FileUtils.validateFile(targetFile)) {
            Logger.error('修改后的文件验证失败，正在还原...');
            this.restoreFromBackup(targetFile, backupFile);
            return false;
        }

        Logger.success('\n[SUCCESS] 补丁成功应用！请完全重启 Cursor (Cmd+Q 或 Ctrl+Q) 以查看效果。');
        return true;
    }

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

    static restoreOriginal(cursorPath) {
        Logger.info('开始还原原始英文文件...');
        const { targetFile, backupFile } = CursorPathFinder.getPlatformPaths(cursorPath);

        if (fs.existsSync(backupFile)) {
            if (!this.restoreFromBackup(targetFile, backupFile)) {
                return false;
            }
            
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

    static restoreFromBackup(targetFile, backupFile) {
        if (!FileUtils.safeCopyFile(backupFile, targetFile)) {
            Logger.error('还原文件失败');
            return false;
        }
        Logger.success('已从备份还原原始文件。');
        return true;
    }
}

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

process.on('uncaughtException', (error) => {
    Logger.error(`未捕获的异常: ${error.message}`);
    Logger.error(`堆栈: ${error.stack}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    Logger.error(`未处理的 Promise 拒绝: ${reason}`);
    process.exit(1);
});

module.exports = { Logger, FileUtils, CursorPathFinder, TranslationProcessor, PatchApplier };

if (require.main === module) {
    main();
}